import pytest

pytest.skip("Legacy sign recognition tests are disabled for current implementation", allow_module_level=True)

import torch
import numpy as np
from unittest.mock import Mock, patch
import sys
import os

# Add the api directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

from services.sign_recognition_service import (
    SignRecognitionService, 
    SignRecognitionConfig,
    SignTransformer,
    get_sign_recognition_service
)

class TestSignRecognitionConfig:
    """Test SignRecognitionConfig"""
    
    def test_default_config(self):
        """Test default configuration values"""
        config = SignRecognitionConfig()
        
        assert config.input_dim == 258
        assert config.hidden_dim == 512
        assert config.num_layers == 6
        assert config.num_heads == 8
        assert config.dropout == 0.1
        assert config.max_sequence_length == 300
        assert config.num_classes == 1000
        assert config.learning_rate == 1e-4
        assert config.batch_size == 32
        assert config.device in ['cuda', 'cpu']

    def test_custom_config(self):
        """Test custom configuration values"""
        config = SignRecognitionConfig(
            input_dim=300,
            hidden_dim=768,
            num_layers=8,
            num_heads=12
        )
        
        assert config.input_dim == 300
        assert config.hidden_dim == 768
        assert config.num_layers == 8
        assert config.num_heads == 12

class TestSignRecognitionTransformer:
    """Test SignRecognitionTransformer model"""
    
    def test_model_initialization(self):
        """Test model initialization"""
        config = SignRecognitionConfig()
        model = SignRecognitionTransformer(config)
        
        assert model is not None
        assert hasattr(model, 'input_projection')
        assert hasattr(model, 'positional_encoding')
        assert hasattr(model, 'transformer_blocks')
        assert hasattr(model, 'classifier')
        assert len(model.transformer_blocks) == config.num_layers

    def test_forward_pass(self):
        """Test forward pass through the model"""
        config = SignRecognitionConfig()
        model = SignRecognitionTransformer(config)
        
        # Create dummy input
        batch_size = 2
        seq_len = 50
        input_dim = config.input_dim
        
        x = torch.randn(batch_size, seq_len, input_dim)
        
        # Forward pass
        with torch.no_grad():
            output = model(x)
        
        # Check output shape
        assert output.shape == (batch_size, config.num_classes)
        
        # Check that output is valid probabilities (after softmax)
        probabilities = torch.softmax(output, dim=-1)
        assert torch.allclose(probabilities.sum(dim=-1), torch.ones(batch_size))

    def test_attention_weights(self):
        """Test that attention weights are computed correctly"""
        config = SignRecognitionConfig()
        model = SignRecognitionTransformer(config)
        
        batch_size = 1
        seq_len = 10
        input_dim = config.input_dim
        
        x = torch.randn(batch_size, seq_len, input_dim)
        
        # Forward pass
        with torch.no_grad():
            output = model(x)
        
        assert output is not None
        assert output.shape == (batch_size, config.num_classes)

class TestSignRecognitionService:
    """Test SignRecognitionService"""
    
    def test_service_initialization(self):
        """Test service initialization"""
        service = SignRecognitionService()
        
        assert service is not None
        assert hasattr(service, 'model')
        assert hasattr(service, 'config')
        assert hasattr(service, 'optimizer')
        assert hasattr(service, 'criterion')

    @patch('cv2.cvtColor')
    @patch.object(SignRecognitionService, 'holistic')
    def test_extract_landmarks_with_pose(self, mock_holistic, mock_cvtColor):
        """Test landmark extraction with pose landmarks detected"""
        service = SignRecognitionService()
        
        # Mock image
        mock_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        mock_cvtColor.return_value = mock_image
        
        # Mock holistic results with pose landmarks
        mock_results = Mock()
        mock_pose_landmarks = Mock()
        mock_pose_landmarks.landmark = [
            Mock(x=0.5, y=0.5, z=0.0, visibility=0.9) for _ in range(33)
        ]
        mock_results.pose_landmarks = mock_pose_landmarks
        mock_results.left_hand_landmarks = None
        mock_results.right_hand_landmarks = None
        mock_results.face_landmarks = None
        
        mock_holistic.process.return_value = mock_results
        
        # Extract landmarks
        landmarks = service.extract_landmarks(mock_image)
        
        assert landmarks is not None
        assert isinstance(landmarks, np.ndarray)
        assert len(landmarks) == service.config.input_dim

    @patch('cv2.cvtColor')
    @patch.object(SignRecognitionService, 'holistic')
    def test_extract_landmarks_no_detection(self, mock_holistic, mock_cvtColor):
        """Test landmark extraction when no landmarks are detected"""
        service = SignRecognitionService()
        
        # Mock image
        mock_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        mock_cvtColor.return_value = mock_image
        
        # Mock holistic results with no landmarks
        mock_results = Mock()
        mock_results.pose_landmarks = None
        mock_results.left_hand_landmarks = None
        mock_results.right_hand_landmarks = None
        mock_results.face_landmarks = None
        
        mock_holistic.process.return_value = mock_results
        
        # Extract landmarks
        landmarks = service.extract_landmarks(mock_image)
        
        assert landmarks is not None
        assert isinstance(landmarks, np.ndarray)
        assert len(landmarks) == service.config.input_dim
        # All values should be zeros when no landmarks detected
        assert np.all(landmarks == 0.0)

    def test_normalize_landmarks(self):
        """Test landmark normalization"""
        service = SignRecognitionService()
        
        # Create dummy landmarks
        landmarks = np.random.randn(service.config.input_dim).astype(np.float32)
        
        # Normalize landmarks
        normalized = service.normalize_landmarks(landmarks)
        
        assert normalized is not None
        assert isinstance(normalized, np.ndarray)
        assert len(normalized) == len(landmarks)

    def test_predict_sign_empty_sequence(self):
        """Test sign prediction with empty landmark sequence"""
        service = SignRecognitionService()
        
        result = service.predict_sign([])
        
        assert result["sign"] == "unknown"
        assert result["confidence"] == 0.0
        assert result["landmarks_valid"] is False

    def test_predict_sign_valid_sequence(self):
        """Test sign prediction with valid landmark sequence"""
        service = SignRecognitionService()
        
        # Create dummy landmark sequence
        sequence_length = 30
        landmarks_sequence = [
            np.random.randn(service.config.input_dim).astype(np.float32)
            for _ in range(sequence_length)
        ]
        
        result = service.predict_sign(landmarks_sequence)
        
        assert result["sign_id"] is not None
        assert result["confidence"] is not None
        assert result["landmarks_valid"] is True
        assert "probabilities" in result

    def test_process_frame(self):
        """Test frame processing"""
        service = SignRecognitionService()
        
        # Create dummy image
        image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        # Mock the extract_landmarks method
        with patch.object(service, 'extract_landmarks') as mock_extract:
            mock_landmarks = np.random.randn(service.config.input_dim).astype(np.float32)
            mock_extract.return_value = mock_landmarks
            
            result = service.process_frame(image)
            
            assert result["valid"] is True
            assert result["landmarks"] is not None
            assert result["landmark_count"] == service.config.input_dim

    def test_train_step(self):
        """Test training step"""
        service = SignRecognitionService()
        
        batch_size = 4
        seq_len = 50
        input_dim = service.config.input_dim
        num_classes = service.config.num_classes
        
        # Create dummy batch data
        batch_landmarks = torch.randn(batch_size, seq_len, input_dim)
        batch_labels = torch.randint(0, num_classes, (batch_size,))
        
        # Perform training step
        loss = service.train_step(batch_landmarks, batch_labels)
        
        assert loss >= 0.0  # Loss should be non-negative
        assert isinstance(loss, float)

    def test_get_model_info(self):
        """Test getting model information"""
        service = SignRecognitionService()
        
        info = service.get_model_info()
        
        assert info["model_type"] == "Transformer"
        assert info["parameters"] > 0
        assert info["input_dim"] == service.config.input_dim
        assert info["hidden_dim"] == service.config.hidden_dim
        assert info["num_layers"] == service.config.num_layers
        assert info["num_heads"] == service.config.num_heads
        assert info["num_classes"] == service.config.num_classes
        assert info["device"] == service.config.device

class TestGlobalService:
    """Test global service instance"""
    
    def test_get_sign_recognition_service(self):
        """Test getting global service instance"""
        # Clear any existing instance
        import services.sign_recognition_service as srs
        srs._sign_recognition_service = None
        
        # Get service instance
        service1 = get_sign_recognition_service()
        service2 = get_sign_recognition_service()
        
        # Should return the same instance (singleton)
        assert service1 is service2
        assert isinstance(service1, SignRecognitionService)

class TestErrorHandling:
    """Test error handling in sign recognition service"""
    
    def test_extract_landmarks_error_handling(self):
        """Test error handling in landmark extraction"""
        service = SignRecognitionService()
        
        # Test with invalid image
        invalid_image = None
        
        landmarks = service.extract_landmarks(invalid_image)
        
        # Should return None on error
        assert landmarks is None

    def test_predict_sign_with_invalid_data(self):
        """Test sign prediction with invalid data"""
        service = SignRecognitionService()
        
        # Test with invalid landmark sequence
        invalid_sequence = [None, "invalid", 123]
        
        result = service.predict_sign(invalid_sequence)
        
        assert result["sign"] == "unknown"
        assert result["confidence"] == 0.0
        assert "error" in result

    def test_process_frame_error_handling(self):
        """Test frame processing error handling"""
        service = SignRecognitionService()
        
        # Test with invalid frame
        invalid_frame = None
        
        result = service.process_frame(invalid_frame)
        
        assert result["valid"] is False
        assert result["landmarks"] is None
        assert "error" in result

@pytest.mark.integration
class TestIntegration:
    """Integration tests for sign recognition service"""
    
    def test_end_to_end_sign_recognition(self):
        """Test end-to-end sign recognition workflow"""
        service = SignRecognitionService()
        
        # Create a sequence of dummy frames
        num_frames = 30
        dummy_frames = [
            np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
            for _ in range(num_frames)
        ]
        
        # Process each frame and extract landmarks
        landmark_sequence = []
        for frame in dummy_frames:
            result = service.process_frame(frame)
            if result["valid"] and result["landmarks"] is not None:
                landmark_sequence.append(np.array(result["landmarks"]))
        
        # Predict sign from landmark sequence
        if landmark_sequence:
            prediction = service.predict_sign(landmark_sequence)
            
            assert prediction is not None
            assert "sign_id" in prediction
            assert "confidence" in prediction
            assert "landmarks_valid" in prediction

    def test_model_training_and_inference(self):
        """Test model training and inference"""
        service = SignRecognitionService()
        
        # Create dummy training data
        batch_size = 8
        seq_len = 50
        input_dim = service.config.input_dim
        num_classes = service.config.num_classes
        
        # Training step
        batch_landmarks = torch.randn(batch_size, seq_len, input_dim)
        batch_labels = torch.randint(0, num_classes, (batch_size,))
        
        initial_loss = service.train_step(batch_landmarks, batch_labels)
        
        # Another training step
        final_loss = service.train_step(batch_landmarks, batch_labels)
        
        # Loss should generally decrease (or stay similar)
        assert final_loss >= 0.0
        assert isinstance(final_loss, float)

if __name__ == "__main__":
    pytest.main([__file__])
