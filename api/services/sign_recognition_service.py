import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import mediapipe as mp
import cv2
from pathlib import Path
import json
import logging
from concurrent.futures import ThreadPoolExecutor
import asyncio

logger = logging.getLogger(__name__)

@dataclass
class SignRecognitionConfig:
    """Configuration for sign recognition model"""
    input_dim: int = 258  # MediaPipe pose + hands + face landmarks
    hidden_dim: int = 512
    num_layers: int = 6
    num_heads: int = 8
    dropout: float = 0.1
    num_classes: int = 1000  # Number of GSL signs
    max_sequence_length: int = 150  # frames
    confidence_threshold: float = 0.7
    sequence_overlap: int = 30
    
class PositionalEncoding(nn.Module):
    """Positional encoding for transformer"""
    def __init__(self, d_model: int, max_len: int = 5000):
        super().__init__()
        
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * 
                           (-np.log(10000.0) / d_model))
        
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0).transpose(0, 1)
        
        self.register_buffer('pe', pe)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.pe[:x.size(0), :]

class SignTransformer(nn.Module):
    """Transformer-based model for sign language recognition"""
    
    def __init__(self, config: SignRecognitionConfig):
        super().__init__()
        self.config = config
        
        # Input projection
        self.input_projection = nn.Linear(config.input_dim, config.hidden_dim)
        
        # Positional encoding
        self.positional_encoding = PositionalEncoding(config.hidden_dim)
        
        # Transformer encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=config.hidden_dim,
            nhead=config.num_heads,
            dim_feedforward=config.hidden_dim * 4,
            dropout=config.dropout,
            activation='gelu'
        )
        self.transformer_encoder = nn.TransformerEncoder(
            encoder_layer, 
            num_layers=config.num_layers
        )
        
        # Classification head
        self.classifier = nn.Sequential(
            nn.LayerNorm(config.hidden_dim),
            nn.Linear(config.hidden_dim, config.hidden_dim // 2),
            nn.GELU(),
            nn.Dropout(config.dropout),
            nn.Linear(config.hidden_dim // 2, config.num_classes)
        )
        
        # Attention pooling
        self.attention_pool = nn.Sequential(
            nn.Linear(config.hidden_dim, 1),
            nn.Softmax(dim=1)
        )
        
    def forward(self, x: torch.Tensor, mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        Forward pass
        Args:
            x: Input tensor of shape (batch_size, seq_len, input_dim)
            mask: Optional attention mask
        Returns:
            Classification logits of shape (batch_size, num_classes)
        """
        batch_size, seq_len, _ = x.shape
        
        # Project input
        x = self.input_projection(x)  # (batch_size, seq_len, hidden_dim)
        
        # Add positional encoding
        x = x.transpose(0, 1)  # (seq_len, batch_size, hidden_dim)
        x = self.positional_encoding(x)
        
        # Apply transformer
        if mask is not None:
            x = self.transformer_encoder(x, src_key_padding_mask=mask)
        else:
            x = self.transformer_encoder(x)
        
        # Transpose back
        x = x.transpose(0, 1)  # (batch_size, seq_len, hidden_dim)
        
        # Attention pooling
        attention_weights = self.attention_pool(x)  # (batch_size, seq_len, 1)
        pooled = torch.sum(x * attention_weights, dim=1)  # (batch_size, hidden_dim)
        
        # Classification
        logits = self.classifier(pooled)  # (batch_size, num_classes)
        
        return logits, attention_weights.squeeze(-1)

class SignRecognitionService:
    """Service for sign language recognition using transformer models"""
    
    def __init__(self, config: SignRecognitionConfig, model_path: Optional[str] = None):
        self.config = config
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Initialize model
        self.model = SignTransformer(config).to(self.device)
        
        # Load pre-trained weights if available
        if model_path and Path(model_path).exists():
            self.load_model(model_path)
        
        # MediaPipe setup
        self.mp_holistic = mp.solutions.holistic
        self.holistic = self.mp_holistic.Holistic(
            static_image_mode=False,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # State management
        self.frame_buffer = []
        self.prediction_buffer = []
        self.is_processing = False
        
        # Thread pool for async processing
        self.executor = ThreadPoolExecutor(max_workers=2)
        
        logger.info(f"SignRecognitionService initialized on {self.device}")
    
    def load_model(self, model_path: str):
        """Load pre-trained model weights"""
        try:
            checkpoint = torch.load(model_path, map_location=self.device)
            self.model.load_state_dict(checkpoint['model_state_dict'])
            logger.info(f"Loaded model from {model_path}")
        except Exception as e:
            logger.error(f"Failed to load model from {model_path}: {e}")
            raise
    
    def save_model(self, model_path: str):
        """Save model weights"""
        torch.save({
            'model_state_dict': self.model.state_dict(),
            'config': self.config,
            'timestamp': torch.tensor([torch.time.time()])
        }, model_path)
        logger.info(f"Saved model to {model_path}")
    
    def extract_landmarks(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """Extract MediaPipe landmarks from frame"""
        try:
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process with MediaPipe
            results = self.holistic.process(rgb_frame)
            
            if not results:
                return None
            
            # Extract landmarks
            landmarks = []
            
            # Pose landmarks (33 points, 3D coordinates)
            if results.pose_landmarks:
                pose_landmarks = []
                for landmark in results.pose_landmarks.landmark:
                    pose_landmarks.extend([landmark.x, landmark.y, landmark.z, landmark.visibility])
                landmarks.extend(pose_landmarks)
            else:
                landmarks.extend([0.0] * (33 * 4))
            
            # Hand landmarks (21 points each, 3D coordinates)
            for hand_landmarks in [results.left_hand_landmarks, results.right_hand_landmarks]:
                if hand_landmarks:
                    for landmark in hand_landmarks.landmark:
                        landmarks.extend([landmark.x, landmark.y, landmark.z])
                else:
                    landmarks.extend([0.0] * (21 * 3))
            
            # Face landmarks (468 points, 3D coordinates)
            if results.face_landmarks:
                # Sample key face landmarks to reduce dimensionality
                key_face_indices = [10, 152, 234, 454, 33, 263, 61, 291, 0, 17]  # Key facial points
                for idx in key_face_indices:
                    landmark = results.face_landmarks.landmark[idx]
                    landmarks.extend([landmark.x, landmark.y, landmark.z])
            else:
                landmarks.extend([0.0] * (10 * 3))
            
            return np.array(landmarks, dtype=np.float32)
            
        except Exception as e:
            logger.error(f"Error extracting landmarks: {e}")
            return None
    
    def preprocess_sequence(self, landmarks_sequence: List[np.ndarray]) -> torch.Tensor:
        """Preprocess landmark sequence for model input"""
        try:
            # Pad or truncate sequence
            if len(landmarks_sequence) > self.config.max_sequence_length:
                landmarks_sequence = landmarks_sequence[-self.config.max_sequence_length:]
            
            # Convert to numpy array
            sequence = np.stack(landmarks_sequence)
            
            # Normalize landmarks
            sequence = self.normalize_landmarks(sequence)
            
            # Convert to tensor
            sequence_tensor = torch.FloatTensor(sequence).unsqueeze(0)  # Add batch dimension
            
            return sequence_tensor
            
        except Exception as e:
            logger.error(f"Error preprocessing sequence: {e}")
            return None
    
    def normalize_landmarks(self, landmarks: np.ndarray) -> np.ndarray:
        """Normalize landmarks to improve model performance"""
        try:
            # Center landmarks around origin
            # Use nose landmark (index 0 in pose) as reference point
            nose_x = landmarks[:, 0] if landmarks.shape[1] > 0 else 0
            nose_y = landmarks[:, 1] if landmarks.shape[1] > 1 else 0
            
            # Normalize pose landmarks
            for i in range(0, min(33 * 4, landmarks.shape[1]), 4):
                if i + 1 < landmarks.shape[1]:
                    landmarks[:, i] -= nose_x
                    landmarks[:, i + 1] -= nose_y
            
            # Scale to unit variance
            pose_landmarks = landmarks[:, :33*4]
            if pose_landmarks.size > 0:
                mean = np.mean(pose_landmarks, axis=0)
                std = np.std(pose_landmarks, axis=0)
                std[std == 0] = 1  # Avoid division by zero
                landmarks[:, :33*4] = (pose_landmarks - mean) / std
            
            return landmarks
            
        except Exception as e:
            logger.error(f"Error normalizing landmarks: {e}")
            return landmarks
    
    async def predict_sign(self, frame: np.ndarray) -> Optional[Dict]:
        """Predict sign from video frame"""
        try:
            # Extract landmarks
            landmarks = self.extract_landmarks(frame)
            if landmarks is None:
                return None
            
            # Add to frame buffer
            self.frame_buffer.append(landmarks)
            
            # Check if we have enough frames
            if len(self.frame_buffer) < self.config.max_sequence_length:
                return None
            
            # Keep only recent frames
            if len(self.frame_buffer) > self.config.max_sequence_length + self.config.sequence_overlap:
                self.frame_buffer = self.frame_buffer[-self.config.max_sequence_length:]
            
            # Preprocess sequence
            sequence = self.preprocess_sequence(self.frame_buffer)
            if sequence is None:
                return None
            
            # Move to device
            sequence = sequence.to(self.device)
            
            # Make prediction
            self.model.eval()
            with torch.no_grad():
                logits, attention_weights = self.model(sequence)
                probabilities = F.softmax(logits, dim=-1)
                confidence, predicted_class = torch.max(probabilities, dim=-1)
            
            # Check confidence threshold
            if confidence.item() < self.config.confidence_threshold:
                return None
            
            result = {
                'predicted_class': predicted_class.item(),
                'confidence': confidence.item(),
                'probabilities': probabilities.cpu().numpy().tolist(),
                'attention_weights': attention_weights.cpu().numpy().tolist(),
                'timestamp': torch.time.time()
            }
            
            # Add to prediction buffer for temporal smoothing
            self.prediction_buffer.append(result)
            
            # Temporal smoothing
            if len(self.prediction_buffer) >= 3:
                return self.temporal_smoothing()
            
            return result
            
        except Exception as e:
            logger.error(f"Error predicting sign: {e}")
            return None
    
    def temporal_smoothing(self) -> Dict:
        """Apply temporal smoothing to predictions"""
        try:
            # Get recent predictions
            recent_predictions = self.prediction_buffer[-5:]
            
            # Extract classes and confidences
            classes = [pred['predicted_class'] for pred in recent_predictions]
            confidences = [pred['confidence'] for pred in recent_predictions]
            
            # Find most frequent class
            from collections import Counter
            class_counts = Counter(classes)
            most_common_class = class_counts.most_common(1)[0][0]
            
            # Average confidence for most common class
            avg_confidence = np.mean([
                conf for cls, conf in zip(classes, confidences) 
                if cls == most_common_class
            ])
            
            # Return smoothed prediction
            return {
                'predicted_class': most_common_class,
                'confidence': avg_confidence,
                'smoothed': True,
                'timestamp': torch.time.time()
            }
            
        except Exception as e:
            logger.error(f"Error in temporal smoothing: {e}")
            return self.prediction_buffer[-1] if self.prediction_buffer else None
    
    def reset_buffers(self):
        """Reset frame and prediction buffers"""
        self.frame_buffer.clear()
        self.prediction_buffer.clear()
    
    async def process_video_stream(self, frame_callback):
        """Process continuous video stream"""
        self.is_processing = True
        
        try:
            while self.is_processing:
                # Get frame from callback
                frame = await frame_callback()
                if frame is None:
                    await asyncio.sleep(0.001)
                    continue
                
                # Process frame
                result = await self.predict_sign(frame)
                
                if result:
                    yield result
                
                await asyncio.sleep(0.033)  # ~30 FPS
                
        except Exception as e:
            logger.error(f"Error in video stream processing: {e}")
            raise
        finally:
            self.is_processing = False
    
    def stop_processing(self):
        """Stop video processing"""
        self.is_processing = False
        self.reset_buffers()
    
    def get_model_info(self) -> Dict:
        """Get model information"""
        return {
            'model_type': 'SignTransformer',
            'input_dim': self.config.input_dim,
            'num_classes': self.config.num_classes,
            'confidence_threshold': self.config.confidence_threshold,
            'device': str(self.device),
            'buffer_size': len(self.frame_buffer),
            'prediction_buffer_size': len(self.prediction_buffer)
        }

# Training utilities
class SignRecognitionTrainer:
    """Trainer for sign recognition model"""
    
    def __init__(self, model: SignTransformer, config: SignRecognitionConfig):
        self.model = model
        self.config = config
        self.device = next(model.parameters()).device
        
        # Loss function
        self.criterion = nn.CrossEntropyLoss()
        
        # Optimizer
        self.optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=1e-4,
            weight_decay=0.01
        )
        
        # Learning rate scheduler
        self.scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer,
            T_max=100,
            eta_min=1e-6
        )
        
        logger.info("SignRecognitionTrainer initialized")
    
    def train_epoch(self, dataloader, epoch: int) -> Dict:
        """Train for one epoch"""
        self.model.train()
        total_loss = 0
        correct = 0
        total = 0
        
        for batch_idx, (sequences, labels) in enumerate(dataloader):
            sequences, labels = sequences.to(self.device), labels.to(self.device)
            
            # Forward pass
            self.optimizer.zero_grad()
            logits, _ = self.model(sequences)
            loss = self.criterion(logits, labels)
            
            # Backward pass
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            self.optimizer.step()
            
            # Statistics
            total_loss += loss.item()
            _, predicted = torch.max(logits.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
            if batch_idx % 10 == 0:
                logger.info(f'Epoch {epoch}, Batch {batch_idx}, Loss: {loss.item():.4f}')
        
        accuracy = 100 * correct / total
        avg_loss = total_loss / len(dataloader)
        
        self.scheduler.step()
        
        return {
            'epoch': epoch,
            'loss': avg_loss,
            'accuracy': accuracy,
            'learning_rate': self.scheduler.get_last_lr()[0]
        }
    
    def validate(self, dataloader) -> Dict:
        """Validate model"""
        self.model.eval()
        total_loss = 0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for sequences, labels in dataloader:
                sequences, labels = sequences.to(self.device), labels.to(self.device)
                
                logits, _ = self.model(sequences)
                loss = self.criterion(logits, labels)
                
                total_loss += loss.item()
                _, predicted = torch.max(logits.data, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
        
        accuracy = 100 * correct / total
        avg_loss = total_loss / len(dataloader)
        
        return {
            'loss': avg_loss,
            'accuracy': accuracy
        }

# Usage example and testing
if __name__ == "__main__":
    # Initialize configuration
    config = SignRecognitionConfig(
        num_classes=500,  # Adjust based on GSL dictionary
        confidence_threshold=0.8
    )
    
    # Initialize service
    service = SignRecognitionService(config)
    
    # Print model info
    print("Model Info:", service.get_model_info())
    
    # Test with dummy data
    dummy_frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
    result = asyncio.run(service.predict_sign(dummy_frame))
    print("Test result:", result)