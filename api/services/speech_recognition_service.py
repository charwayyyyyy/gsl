import torch
import torchaudio
import whisper
import numpy as np
from typing import Optional, Dict, List, AsyncGenerator
import asyncio
import logging
import tempfile
import wave
import io
from pathlib import Path
import time
from dataclasses import dataclass
import json

logger = logging.getLogger(__name__)

@dataclass
class SpeechRecognitionConfig:
    """Configuration for speech recognition service"""
    model_name: str = "base"  # tiny, base, small, medium, large
    language: str = "en"  # English as default, will be configurable for Ghanaian languages
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    sample_rate: int = 16000  # Whisper expects 16kHz
    chunk_duration: float = 2.0  # seconds per chunk
    overlap_duration: float = 0.5  # overlap between chunks
    vad_threshold: float = 0.5  # Voice Activity Detection threshold
    min_speech_duration: float = 0.1  # minimum speech duration
    max_silence_duration: float = 2.0  # maximum silence before splitting
    beam_size: int = 5  # beam search size for decoding
    best_of: int = 5  # number of candidates to consider
    temperature: float = 0.0  # sampling temperature (0 = greedy)
    patience: float = 1.0  # beam search patience
    length_penalty: float = 1.0  # length penalty for beam search
    suppress_tokens: str = "-1"  # suppress special tokens
    initial_prompt: str = ""  # initial prompt for context
    condition_on_previous_text: bool = True  # condition on previous text
    fp16: bool = True  # use half precision if available
    compression_ratio_threshold: float = 2.4  # compression ratio threshold
    logprob_threshold: float = -1.0  # log probability threshold
    no_speech_threshold: float = 0.6  # no speech threshold

class SpeechRecognitionService:
    """Service for speech recognition using OpenAI Whisper"""
    
    def __init__(self, config: SpeechRecognitionConfig):
        self.config = config
        self.model = None
        self.is_loaded = False
        self.audio_buffer = []
        self.processing_buffer = []
        self.is_processing = False
        self.last_speech_time = 0
        self.silence_start_time = None
        self.current_transcription = ""
        
        # Audio processing state
        self.sample_rate = config.sample_rate
        self.chunk_size = int(config.chunk_duration * config.sample_rate)
        self.overlap_size = int(config.overlap_duration * config.sample_rate)
        
        # Voice Activity Detection (simple energy-based)
        self.vad_energy_threshold = config.vad_threshold
        
        logger.info(f"SpeechRecognitionService initialized with model: {config.model_name}")
    
    async def load_model(self):
        """Load Whisper model"""
        try:
            logger.info(f"Loading Whisper model: {self.config.model_name}")
            
            # Load model
            self.model = whisper.load_model(
                self.config.model_name,
                device=self.config.device,
                download_root=None  # Use default cache directory
            )
            
            # Set model to evaluation mode
            self.model.eval()
            
            self.is_loaded = True
            logger.info(f"Whisper model loaded successfully on {self.config.device}")
            
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise RuntimeError(f"Failed to load Whisper model: {e}")
    
    def unload_model(self):
        """Unload model to free memory"""
        if self.model:
            del self.model
            self.model = None
            self.is_loaded = False
            
            # Force garbage collection
            import gc
            gc.collect()
            
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            logger.info("Whisper model unloaded")
    
    def resample_audio(self, audio_data: np.ndarray, original_rate: int) -> np.ndarray:
        """Resample audio to 16kHz if needed"""
        if original_rate == self.sample_rate:
            return audio_data
        
        try:
            # Convert to torch tensor
            audio_tensor = torch.FloatTensor(audio_data)
            
            # Resample using torchaudio
            resampler = torchaudio.transforms.Resample(
                orig_freq=original_rate,
                new_freq=self.sample_rate
            )
            
            resampled = resampler(audio_tensor)
            return resampled.numpy()
            
        except Exception as e:
            logger.warning(f"Failed to resample audio: {e}, using original")
            return audio_data
    
    def apply_voice_activity_detection(self, audio_chunk: np.ndarray) -> Dict:
        """Apply simple energy-based Voice Activity Detection"""
        try:
            # Calculate frame energy
            frame_size = int(0.025 * self.sample_rate)  # 25ms frames
            hop_length = int(0.01 * self.sample_rate)   # 10ms hop
            
            # Calculate energy
            energy = []
            for i in range(0, len(audio_chunk) - frame_size + 1, hop_length):
                frame = audio_chunk[i:i + frame_size]
                frame_energy = np.sum(frame ** 2) / len(frame)
                energy.append(frame_energy)
            
            energy = np.array(energy)
            
            # Normalize energy
            if len(energy) > 0:
                energy = energy / (np.max(energy) + 1e-8)
            
            # Detect speech
            speech_frames = np.sum(energy > self.vad_energy_threshold)
            total_frames = len(energy)
            speech_ratio = speech_frames / total_frames if total_frames > 0 else 0
            
            # Calculate speech duration
            speech_duration = speech_ratio * len(audio_chunk) / self.sample_rate
            
            return {
                'has_speech': speech_ratio > 0.1,  # At least 10% speech
                'speech_ratio': speech_ratio,
                'speech_duration': speech_duration,
                'energy': energy.tolist()
            }
            
        except Exception as e:
            logger.error(f"Error in VAD: {e}")
            return {'has_speech': True, 'speech_ratio': 1.0, 'speech_duration': len(audio_chunk) / self.sample_rate}
    
    def normalize_audio(self, audio_data: np.ndarray) -> np.ndarray:
        """Normalize audio to [-1, 1] range"""
        try:
            # Remove DC offset
            audio_data = audio_data - np.mean(audio_data)
            
            # Normalize to [-1, 1]
            max_val = np.max(np.abs(audio_data))
            if max_val > 0:
                audio_data = audio_data / max_val
            
            return audio_data
            
        except Exception as e:
            logger.error(f"Error normalizing audio: {e}")
            return audio_data
    
    def preprocess_audio(self, audio_data: np.ndarray, sample_rate: int) -> np.ndarray:
        """Preprocess audio for Whisper"""
        try:
            # Resample if necessary
            audio_data = self.resample_audio(audio_data, sample_rate)
            
            # Normalize audio
            audio_data = self.normalize_audio(audio_data)
            
            # Convert to float32
            audio_data = audio_data.astype(np.float32)
            
            return audio_data
            
        except Exception as e:
            logger.error(f"Error preprocessing audio: {e}")
            return audio_data
    
    async def transcribe_audio_chunk(self, audio_chunk: np.ndarray) -> Dict:
        """Transcribe a single audio chunk"""
        if not self.is_loaded:
            await self.load_model()
        
        try:
            # Apply VAD
            vad_result = self.apply_voice_activity_detection(audio_chunk)
            
            if not vad_result['has_speech']:
                return {
                    'text': '',
                    'confidence': 0.0,
                    'has_speech': False,
                    'speech_ratio': vad_result['speech_ratio'],
                    'timestamp': time.time()
                }
            
            # Transcribe using Whisper
            result = self.model.transcribe(
                audio_chunk,
                language=self.config.language,
                task="transcribe",
                temperature=self.config.temperature,
                beam_size=self.config.beam_size,
                best_of=self.config.best_of,
                patience=self.config.patience,
                length_penalty=self.config.length_penalty,
                suppress_tokens=self.config.suppress_tokens,
                initial_prompt=self.config.initial_prompt,
                condition_on_previous_text=self.config.condition_on_previous_text,
                fp16=self.config.fp16 and torch.cuda.is_available(),
                compression_ratio_threshold=self.config.compression_ratio_threshold,
                logprob_threshold=self.config.logprob_threshold,
                no_speech_threshold=self.config.no_speech_threshold
            )
            
            # Extract transcription and confidence
            text = result["text"].strip()
            
            # Calculate average confidence from segments if available
            confidence = 0.0
            if "segments" in result and result["segments"]:
                avg_logprob = np.mean([seg.get("avg_logprob", 0) for seg in result["segments"]])
                # Convert log probability to confidence (0-1)
                confidence = min(max(np.exp(avg_logprob), 0.0), 1.0)
            
            return {
                'text': text,
                'confidence': confidence,
                'has_speech': True,
                'speech_ratio': vad_result['speech_ratio'],
                'language': result.get("language", self.config.language),
                'segments': result.get("segments", []),
                'timestamp': time.time()
            }
            
        except Exception as e:
            logger.error(f"Error transcribing audio chunk: {e}")
            return {
                'text': '',
                'confidence': 0.0,
                'has_speech': False,
                'error': str(e),
                'timestamp': time.time()
            }
    
    async def process_audio_stream(self, audio_generator: AsyncGenerator[Dict, None]) -> AsyncGenerator[Dict, None]:
        """Process continuous audio stream"""
        self.is_processing = True
        self.audio_buffer = []
        self.current_transcription = ""
        
        try:
            async for audio_data in audio_generator:
                if not self.is_processing:
                    break
                
                try:
                    # Extract audio data and sample rate
                    audio_chunk = audio_data.get('data', np.array([]))
                    sample_rate = audio_data.get('sample_rate', self.sample_rate)
                    
                    if len(audio_chunk) == 0:
                        continue
                    
                    # Preprocess audio
                    processed_audio = self.preprocess_audio(audio_chunk, sample_rate)
                    
                    # Add to buffer
                    self.audio_buffer.extend(processed_audio)
                    
                    # Check if we have enough audio for processing
                    if len(self.audio_buffer) >= self.chunk_size:
                        # Extract chunk with overlap
                        chunk = np.array(self.audio_buffer[:self.chunk_size])
                        
                        # Keep overlap for next iteration
                        self.audio_buffer = self.audio_buffer[self.chunk_size - self.overlap_size:]
                        
                        # Transcribe chunk
                        result = await self.transcribe_audio_chunk(chunk)
                        
                        # Update current transcription
                        if result['text'] and result['confidence'] > 0.5:
                            self.current_transcription += " " + result['text']
                            result['full_text'] = self.current_transcription.strip()
                        
                        yield result
                        
                except Exception as e:
                    logger.error(f"Error processing audio chunk: {e}")
                    yield {
                        'text': '',
                        'confidence': 0.0,
                        'has_speech': False,
                        'error': str(e),
                        'timestamp': time.time()
                    }
                    
        except Exception as e:
            logger.error(f"Error in audio stream processing: {e}")
            raise
        finally:
            self.is_processing = False
    
    async def transcribe_audio_file(self, audio_file_path: str) -> Dict:
        """Transcribe audio file"""
        if not self.is_loaded:
            await self.load_model()
        
        try:
            # Load audio file
            audio_data, sample_rate = torchaudio.load(audio_file_path)
            
            # Convert to mono if stereo
            if audio_data.shape[0] > 1:
                audio_data = torch.mean(audio_data, dim=0, keepdim=True)
            
            # Convert to numpy
            audio_data = audio_data.squeeze().numpy()
            
            # Preprocess
            processed_audio = self.preprocess_audio(audio_data, sample_rate)
            
            # Transcribe
            result = await self.transcribe_audio_chunk(processed_audio)
            
            return result
            
        except Exception as e:
            logger.error(f"Error transcribing audio file: {e}")
            return {
                'text': '',
                'confidence': 0.0,
                'has_speech': False,
                'error': str(e),
                'timestamp': time.time()
            }
    
    def get_supported_languages(self) -> List[str]:
        """Get list of supported languages"""
        if not self.model:
            return []
        
        try:
            # Get tokenizer
            tokenizer = self.model.tokenizer
            
            # Get language tokens
            language_tokens = []
            for token, token_id in tokenizer.token_to_id.items():
                if token.startswith("<") and token.endswith(">") and len(token) == 4:
                    # This is likely a language token like "<en>"
                    lang_code = token[1:3]
                    language_tokens.append(lang_code)
            
            return sorted(list(set(language_tokens)))
            
        except Exception as e:
            logger.error(f"Error getting supported languages: {e}")
            return []
    
    def get_model_info(self) -> Dict:
        """Get model information"""
        return {
            'model_name': self.config.model_name,
            'language': self.config.language,
            'device': self.config.device,
            'sample_rate': self.config.sample_rate,
            'chunk_duration': self.config.chunk_duration,
            'overlap_duration': self.config.overlap_duration,
            'is_loaded': self.is_loaded,
            'supported_languages': self.get_supported_languages(),
            'buffer_size': len(self.audio_buffer),
            'current_transcription': self.current_transcription
        }
    
    def reset_transcription(self):
        """Reset current transcription"""
        self.current_transcription = ""
        self.audio_buffer.clear()
    
    def stop_processing(self):
        """Stop audio processing"""
        self.is_processing = False
        self.reset_transcription()

# Advanced features
class AdvancedSpeechRecognitionService(SpeechRecognitionService):
    """Advanced speech recognition with additional features"""
    
    def __init__(self, config: SpeechRecognitionConfig):
        super().__init__(config)
        self.speaker_diarization = None
        self.noise_suppression = None
        
    async def load_advanced_models(self):
        """Load advanced models for speaker diarization and noise suppression"""
        try:
            # Load speaker diarization model (placeholder)
            # In practice, you might use pyannote.audio or similar
            logger.info("Loading advanced speech models...")
            
            # Load noise suppression model (placeholder)
            # In practice, you might use RNNoise or similar
            
            logger.info("Advanced models loaded")
            
        except Exception as e:
            logger.error(f"Failed to load advanced models: {e}")
    
    def apply_noise_suppression(self, audio_data: np.ndarray) -> np.ndarray:
        """Apply noise suppression"""
        # Placeholder for noise suppression
        # In practice, implement actual noise suppression
        return audio_data
    
    def apply_speaker_diarization(self, audio_data: np.ndarray) -> List[Dict]:
        """Apply speaker diarization"""
        # Placeholder for speaker diarization
        # In practice, implement actual speaker diarization
        return [{
            'speaker': 'speaker_0',
            'start_time': 0.0,
            'end_time': len(audio_data) / self.sample_rate,
            'confidence': 1.0
        }]

# Usage example and testing
if __name__ == "__main__":
    # Initialize configuration
    config = SpeechRecognitionConfig(
        model_name="base",
        language="en",
        chunk_duration=3.0,
        overlap_duration=0.5
    )
    
    # Initialize service
    service = SpeechRecognitionService(config)
    
    # Print model info
    print("Model Info:", service.get_model_info())
    
    # Test with dummy audio data
    dummy_audio = np.random.randn(48000).astype(np.float32)  # 3 seconds at 16kHz
    
    async def test_transcription():
        result = await service.transcribe_audio_chunk(dummy_audio)
        print("Test result:", result)
    
    asyncio.run(test_transcription())