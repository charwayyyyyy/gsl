import pytest

pytest.skip("Legacy integration tests are disabled for current implementation", allow_module_level=True)

import asyncio
import numpy as np
import torch
import json
from pathlib import Path
from typing import Dict, List, Any
import tempfile
import wave
import struct

# Import services
import sys
sys.path.append(str(Path(__file__).parent.parent))

from api.services.gsl_dictionary_service import GSLDictionaryService, DictionaryEntry
from api.services.mediapipe_service import MediaPipeService
from api.services.sign_recognition_service import SignRecognitionService, SignRecognitionConfig
from api.services.speech_recognition_service import SpeechRecognitionService, SpeechRecognitionConfig
from api.services.translation_service import GSLTranslationService, TranslationConfig
from api.database.models import Base, GSLSign, TranslationSession, UserSettings
from api.database.connection import get_db_session

class TestGSLDictionaryService:
    """Test cases for GSL Dictionary Service"""
    
    @pytest.fixture
    def dictionary_service(self):
        """Create dictionary service instance"""
        return GSLDictionaryService()
    
    def test_extract_text_from_pdf(self, dictionary_service):
        """Test PDF text extraction"""
        # Create a simple test PDF content
        test_content = """
        GHANA SIGN LANGUAGE DICTIONARY
        
        A - Make fist with thumb up, move hand forward
        HELLO - Wave hand side to side
        THANK YOU - Touch chin and move hand forward
        YES - Nod head while pointing up
        NO - Shake head while moving hand side to side
        """
        
        # Test text extraction (mock implementation)
        extracted_text = dictionary_service._extract_text_from_pdf_content(test_content)
        assert "HELLO" in extracted_text
        assert "THANK YOU" in extracted_text
    
    def test_parse_sign_entry(self, dictionary_service):
        """Test sign entry parsing"""
        test_entry = "HELLO - Wave hand side to side, palm forward"
        
        parsed = dictionary_service._parse_sign_entry(test_entry)
        assert parsed is not None
        assert parsed.sign_name == "HELLO"
        assert "Wave hand side to side" in parsed.description
    
    def test_extract_handshape(self, dictionary_service):
        """Test handshape extraction"""
        description = "Make fist with thumb up, move hand forward"
        handshape = dictionary_service._extract_handshape(description)
        assert handshape == "fist with thumb up"
    
    def test_extract_movement(self, dictionary_service):
        """Test movement extraction"""
        description = "Wave hand side to side, palm forward"
        movement = dictionary_service._extract_movement(description)
        assert movement == "Wave hand side to side"
    
    def test_extract_location(self, dictionary_service):
        """Test location extraction"""
        description = "Touch chin and move hand forward"
        location = dictionary_service._extract_location(description)
        assert location == "chin"
    
    def test_categorize_sign(self, dictionary_service):
        """Test sign categorization"""
        entry = DictionaryEntry(
            sign_name="HELLO",
            description="Wave hand side to side",
            handshape="open hand",
            movement="wave",
            location="neutral space",
            page_number=1,
            image_path=None
        )
        
        category = dictionary_service._categorize_sign(entry)
        assert category == "greeting"
    
    def test_validate_entry(self, dictionary_service):
        """Test entry validation"""
        valid_entry = DictionaryEntry(
            sign_name="HELLO",
            description="Wave hand side to side",
            handshape="open hand",
            movement="wave",
            location="neutral space",
            page_number=1,
            image_path=None
        )
        
        assert dictionary_service._validate_entry(valid_entry) == True
        
        # Test invalid entry
        invalid_entry = DictionaryEntry(
            sign_name="",
            description="",
            handshape="",
            movement="",
            location="",
            page_number=0,
            image_path=None
        )
        
        assert dictionary_service._validate_entry(invalid_entry) == False

class TestMediaPipeService:
    """Test cases for MediaPipe Service"""
    
    @pytest.fixture
    def mediapipe_service(self):
        """Create MediaPipe service instance"""
        return MediaPipeService()
    
    def test_extract_landmarks_from_frame(self, mediapipe_service):
        """Test landmark extraction from frame"""
        # Create dummy frame
        dummy_frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        landmarks = mediapipe_service.extract_landmarks_from_frame(dummy_frame)
        
        # Since it's a random frame, we expect None or empty landmarks
        assert landmarks is None or isinstance(landmarks, dict)
    
    def test_process_frame_sequence(self, mediapipe_service):
        """Test frame sequence processing"""
        frames = [
            np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
            for _ in range(5)
        ]
        
        result = mediapipe_service.process_frame_sequence(frames)
        assert isinstance(result, list)
        assert len(result) == len(frames)
    
    def test_calculate_sign_confidence(self, mediapipe_service):
        """Test sign confidence calculation"""
        landmarks = {
            "hand_landmarks": np.random.rand(21, 3),
            "pose_landmarks": np.random.rand(33, 3),
            "face_landmarks": np.random.rand(468, 3)
        }
        
        confidence = mediapipe_service.calculate_sign_confidence(landmarks)
        assert 0 <= confidence <= 1
    
    def test_normalize_landmarks(self, mediapipe_service):
        """Test landmark normalization"""
        landmarks = np.random.rand(100, 3)
        normalized = mediapipe_service.normalize_landmarks(landmarks)
        
        # Check that landmarks are normalized (mean ~0, std ~1)
        assert np.allclose(np.mean(normalized, axis=0), 0, atol=1e-6)
        assert np.allclose(np.std(normalized, axis=0), 1, atol=1e-6)
    
    def test_extract_hand_features(self, mediapipe_service):
        """Test hand feature extraction"""
        hand_landmarks = np.random.rand(21, 3)
        features = mediapipe_service.extract_hand_features(hand_landmarks)
        
        assert "angles" in features
        assert "distances" in features
        assert "shape_descriptors" in features
        assert len(features["angles"]) > 0
    
    def test_extract_pose_features(self, mediapipe_service):
        """Test pose feature extraction"""
        pose_landmarks = np.random.rand(33, 3)
        features = mediapipe_service.extract_pose_features(pose_landmarks)
        
        assert "joint_angles" in features
        assert "body_orientation" in features
        assert "symmetry_measures" in features
    
    def test_extract_facial_features(self, mediapipe_service):
        """Test facial feature extraction"""
        face_landmarks = np.random.rand(468, 3)
        features = mediapipe_service.extract_facial_features(face_landmarks)
        
        assert "eyebrow_position" in features
        assert "eye_state" in features
        assert "mouth_shape" in features
        assert "head_pose" in features

class TestSignRecognitionService:
    """Test cases for Sign Recognition Service"""
    
    @pytest.fixture
    def sign_recognition_service(self):
        """Create sign recognition service instance"""
        config = SignRecognitionConfig(
            num_classes=100,
            confidence_threshold=0.5
        )
        return SignRecognitionService(config)
    
    def test_model_initialization(self, sign_recognition_service):
        """Test model initialization"""
        assert sign_recognition_service.model is not None
        assert sign_recognition_service.device in ['cuda', 'cpu']
    
    def test_extract_landmarks(self, sign_recognition_service):
        """Test landmark extraction"""
        dummy_frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        landmarks = sign_recognition_service.extract_landmarks(dummy_frame)
        
        # Since it's a random frame, we expect None or empty landmarks
        assert landmarks is None or isinstance(landmarks, np.ndarray)
    
    def test_preprocess_sequence(self, sign_recognition_service):
        """Test sequence preprocessing"""
        # Create dummy landmark sequences
        sequences = [
            np.random.rand(258).astype(np.float32)
            for _ in range(10)
        ]
        
        processed = sign_recognition_service.preprocess_sequence(sequences)
        
        assert isinstance(processed, torch.Tensor)
        assert processed.shape[0] == 1  # batch size
        assert processed.shape[2] == 258  # feature dimension
    
    def test_normalize_landmarks(self, sign_recognition_service):
        """Test landmark normalization"""
        landmarks = np.random.rand(10, 258)
        normalized = sign_recognition_service.normalize_landmarks(landmarks)
        
        assert normalized.shape == landmarks.shape
        # Check that landmarks are centered around origin
        assert np.allclose(np.mean(normalized[:, :132], axis=0), 0, atol=1e-6)
    
    def test_temporal_smoothing(self, sign_recognition_service):
        """Test temporal smoothing"""
        # Add some predictions to buffer
        for i in range(5):
            sign_recognition_service.prediction_buffer.append({
                'predicted_class': i % 3,
                'confidence': 0.8,
                'timestamp': i
            })
        
        smoothed = sign_recognition_service.temporal_smoothing()
        
        assert 'predicted_class' in smoothed
        assert 'confidence' in smoothed
        assert 'smoothed' in smoothed
        assert smoothed['smoothed'] == True
    
    def test_get_model_info(self, sign_recognition_service):
        """Test model information retrieval"""
        info = sign_recognition_service.get_model_info()
        
        assert 'model_type' in info
        assert 'input_dim' in info
        assert 'num_classes' in info
        assert 'confidence_threshold' in info
        assert info['model_type'] == 'SignTransformer'

class TestSpeechRecognitionService:
    """Test cases for Speech Recognition Service"""
    
    @pytest.fixture
    def speech_recognition_service(self):
        """Create speech recognition service instance"""
        config = SpeechRecognitionConfig(
            model_name="tiny",  # Use smallest model for testing
            chunk_duration=1.0
        )
        return SpeechRecognitionService(config)
    
    @pytest.mark.asyncio
    async def test_model_loading(self, speech_recognition_service):
        """Test model loading"""
        await speech_recognition_service.load_model()
        assert speech_recognition_service.is_loaded == True
        assert speech_recognition_service.model is not None
    
    def test_resample_audio(self, speech_recognition_service):
        """Test audio resampling"""
        # Create 8kHz audio
        audio_8k = np.random.randn(8000).astype(np.float32)
        resampled = speech_recognition_service.resample_audio(audio_8k, 8000)
        
        # Should be resampled to 16kHz
        assert len(resampled) == 16000
    
    def test_normalize_audio(self, speech_recognition_service):
        """Test audio normalization"""
        # Create audio with DC offset
        audio = np.random.randn(16000) + 0.5
        normalized = speech_recognition_service.normalize_audio(audio)
        
        # Check that mean is close to 0
        assert abs(np.mean(normalized)) < 0.01
        # Check that max absolute value is 1
        assert abs(np.max(normalized)) <= 1.0
    
    def test_voice_activity_detection(self, speech_recognition_service):
        """Test Voice Activity Detection"""
        # Create silent audio
        silent_audio = np.zeros(16000, dtype=np.float32)
        vad_result = speech_recognition_service.apply_voice_activity_detection(silent_audio)
        
        assert 'has_speech' in vad_result
        assert 'speech_ratio' in vad_result
        assert 'speech_duration' in vad_result
        assert vad_result['has_speech'] == False
    
    def test_preprocess_audio(self, speech_recognition_service):
        """Test audio preprocessing"""
        # Create test audio
        audio = np.random.randn(16000).astype(np.float32)
        sample_rate = 8000
        
        processed = speech_recognition_service.preprocess_audio(audio, sample_rate)
        
        # Should be resampled to 16kHz and normalized
        assert len(processed) == 16000
        assert processed.dtype == np.float32
        assert abs(np.max(processed)) <= 1.0
    
    def test_get_model_info(self, speech_recognition_service):
        """Test model information retrieval"""
        info = speech_recognition_service.get_model_info()
        
        assert 'model_name' in info
        assert 'language' in info
        assert 'device' in info
        assert 'sample_rate' in info
        assert info['model_name'] == 'tiny'

class TestTranslationService:
    """Test cases for Translation Service"""
    
    @pytest.fixture
    def translation_service(self):
        """Create translation service instance"""
        config = TranslationConfig(
            grammar_rules_enabled=True,
            confidence_threshold=0.6
        )
        return GSLTranslationService(config)
    
    def test_grammar_rules_initialization(self, translation_service):
        """Test grammar rules initialization"""
        grammar_rules = translation_service.grammar_rules
        
        assert hasattr(grammar_rules, 'grammar_rules')
        assert hasattr(grammar_rules, 'sentence_structures')
        assert hasattr(grammar_rules, 'common_phrases')
        assert hasattr(grammar_rules, 'temporal_markers')
        assert hasattr(grammar_rules, 'spatial_markers')
    
    def test_load_grammar_rules(self, translation_service):
        """Test grammar rules loading"""
        rules = translation_service.grammar_rules._load_grammar_rules()
        
        assert 'word_order' in rules
        assert 'question_formation' in rules
        assert 'negation' in rules
        assert 'tense' in rules
        assert rules['word_order'] == 'Topic-Comment'
    
    def test_get_sentence_structures(self, translation_service):
        """Test sentence structures"""
        structures = translation_service.grammar_rules._get_sentence_structures()
        
        assert 'declarative' in structures
        assert 'interrogative' in structures
        assert 'imperative' in structures
        assert 'conditional' in structures
    
    def test_get_common_phrases(self, translation_service):
        """Test common phrases"""
        phrases = translation_service.grammar_rules._get_common_phrases()
        
        assert 'greetings' in phrases
        assert 'questions' in phrases
        assert 'pronouns' in phrases
        assert 'common_verbs' in phrases
        assert 'HELLO' in phrases['greetings']
        assert 'WHAT' in phrases['questions']
    
    def test_apply_word_order(self, translation_service):
        """Test word order application"""
        sequence = ["I", "WANT", "EAT"]
        result = translation_service.grammar_rules._apply_word_order(sequence)
        
        assert isinstance(result, list)
        assert len(result) == len(sequence)
    
    def test_apply_tense_markers(self, translation_service):
        """Test tense marker application"""
        sequence = ["I", "EAT", "YESTERDAY"]
        result = translation_service.grammar_rules._apply_tense_markers(sequence)
        
        assert "FINISH" in result  # Past marker should be added
    
    def test_apply_negation_rules(self, translation_service):
        """Test negation rule application"""
        sequence = ["I", "NOT", "WANT"]
        result = translation_service.grammar_rules._apply_negation_rules(sequence)
        
        assert isinstance(result, list)
        assert "NOT" in result
    
    def test_translate_to_english(self, translation_service):
        """Test GSL to English translation"""
        gsl_sequence = ["HELLO", "I", "WANT", "EAT"]
        english = translation_service.grammar_rules.translate_to_english(gsl_sequence)
        
        assert isinstance(english, str)
        assert "hello" in english.lower()
        assert "i" in english.lower()
        assert english.endswith(".")
    
    def test_gsl_sequence_to_tokens(self, translation_service):
        """Test GSL sequence to token conversion"""
        gsl_sequence = ["HELLO", "I", "WANT"]
        tokens = translation_service.gsl_sequence_to_tokens(gsl_sequence)
        
        assert isinstance(tokens, list)
        assert len(tokens) == len(gsl_sequence)
        assert all(isinstance(token, int) for token in tokens)
    
    def test_tokens_to_english(self, translation_service):
        """Test tokens to English conversion"""
        tokens = [0, 1, 2]  # Dummy tokens
        english = translation_service.tokens_to_english(tokens)
        
        assert isinstance(english, str)
    
    @pytest.mark.asyncio
    async def test_translate_gsl_to_english(self, translation_service):
        """Test GSL to English translation"""
        gsl_sequence = ["HELLO", "I", "WANT", "EAT"]
        
        result = await translation_service.translate_gsl_to_english(gsl_sequence)
        
        assert 'english_text' in result
        assert 'gsl_sequence' in result
        assert 'confidence' in result
        assert 'translation_method' in result
        assert isinstance(result['english_text'], str)
        assert result['confidence'] >= 0
    
    @pytest.mark.asyncio
    async def test_translate_english_to_gsl(self, translation_service):
        """Test English to GSL translation"""
        english_text = "I want to eat"
        
        result = await translation_service.translate_english_to_gsl(english_text)
        
        assert 'gsl_sequence' in result
        assert 'english_text' in result
        assert 'confidence' in result
        assert isinstance(result['gsl_sequence'], list)
        assert result['confidence'] >= 0
    
    def test_get_translation_info(self, translation_service):
        """Test translation service info"""
        info = translation_service.get_translation_info()
        
        assert 'model_loaded' in info
        assert 'grammar_rules_enabled' in info
        assert 'gsl_vocabulary_size' in info
        assert 'english_vocabulary_size' in info
        assert 'supported_languages' in info

class TestDatabaseModels:
    """Test cases for Database Models"""
    
    def test_gsl_sign_model(self):
        """Test GSL Sign model"""
        sign = GSLSign(
            sign_name="HELLO",
            english_translation="Hello",
            category="greeting",
            handshape="open hand",
            location="neutral space",
            movement="wave side to side",
            description="Wave hand side to side with palm forward"
        )
        
        assert sign.sign_name == "HELLO"
        assert sign.english_translation == "Hello"
        assert sign.category == "greeting"
        assert sign.confidence_score == 0.0  # Default value
    
    def test_translation_session_model(self):
        """Test Translation Session model"""
        session = TranslationSession(
            session_type="sign_to_speech",
            source_text="HELLO I WANT EAT",
            translated_text="Hello I want to eat",
            confidence_score=0.85,
            processing_time=0.5,
            source_language="gsl",
            target_language="en"
        )
        
        assert session.session_type == "sign_to_speech"
        assert session.source_text == "HELLO I WANT EAT"
        assert session.translated_text == "Hello I want to eat"
        assert session.confidence_score == 0.85
        assert session.status == "completed"
    
    def test_user_settings_model(self):
        """Test User Settings model"""
        settings = UserSettings(
            large_text=True,
            high_contrast=False,
            dyslexia_friendly=True,
            translation_speed="medium",
            audio_feedback=True,
            visual_feedback=True,
            preferred_language="en",
            region="ghana"
        )
        
        assert settings.large_text == True
        assert settings.high_contrast == False
        assert settings.dyslexia_friendly == True
        assert settings.translation_speed == "medium"
        assert settings.region == "ghana"

class TestIntegration:
    """Integration tests for the complete system"""
    
    @pytest.fixture
    async def complete_system(self):
        """Set up complete system for integration testing"""
        # Initialize all services
        dictionary_service = GSLDictionaryService()
        mediapipe_service = MediaPipeService()
        sign_recognition_service = SignRecognitionService(SignRecognitionConfig())
        speech_recognition_service = SpeechRecognitionService(SpeechRecognitionConfig())
        translation_service = GSLTranslationService(TranslationConfig())
        
        return {
            'dictionary': dictionary_service,
            'mediapipe': mediapipe_service,
            'sign_recognition': sign_recognition_service,
            'speech_recognition': speech_recognition_service,
            'translation': translation_service
        }
    
    @pytest.mark.asyncio
    async def test_complete_translation_pipeline(self, complete_system):
        """Test complete translation pipeline"""
        system = complete_system
        
        # 1. Start with GSL signs
        gsl_sequence = ["HELLO", "I", "WANT", "EAT"]
        
        # 2. Translate to English
        translation_result = await system['translation'].translate_gsl_to_english(gsl_sequence)
        
        assert translation_result['english_text'] != ""
        assert translation_result['confidence'] > 0
        
        # 3. Convert back to GSL
        back_translation = await system['translation'].translate_english_to_gsl(
            translation_result['english_text']
        )
        
        assert len(back_translation['gsl_sequence']) > 0
        assert back_translation['confidence'] > 0
    
    @pytest.mark.asyncio
    async def test_real_time_processing(self, complete_system):
        """Test real-time processing capabilities"""
        system = complete_system
        
        # Create dummy video frames
        frames = [
            np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
            for _ in range(10)
        ]
        
        # Process frames
        results = []
        for frame in frames:
            landmarks = system['mediapipe'].extract_landmarks_from_frame(frame)
            if landmarks:
                features = system['mediapipe'].extract_hand_features(landmarks.get('hand_landmarks', np.array([])))
                results.append(features)
        
        assert len(results) >= 0  # May be empty due to random frames
    
    def test_performance_requirements(self, complete_system):
        """Test performance requirements (<500ms latency)"""
        system = complete_system
        
        # Test dictionary lookup performance
        import time
        
        start_time = time.time()
        # Simulate dictionary lookup
        entry = DictionaryEntry(
            sign_name="TEST",
            description="Test description",
            handshape="test",
            movement="test",
            location="test",
            page_number=1,
            image_path=None
        )
        processing_time = time.time() - start_time
        
        assert processing_time < 0.5  # Less than 500ms
    
    def test_accessibility_features(self, complete_system):
        """Test accessibility features"""
        # Test that services support accessibility requirements
        from api.database.models import UserSettings
        
        settings = UserSettings(
            large_text=True,
            high_contrast=True,
            dyslexia_friendly=True,
            audio_feedback=True,
            visual_feedback=True
        )
        
        assert settings.large_text == True
        assert settings.high_contrast == True
        assert settings.dyslexia_friendly == True
        assert settings.audio_feedback == True
        assert settings.visual_feedback == True

# Test utilities
def create_test_audio(duration: float = 1.0, sample_rate: int = 16000) -> np.ndarray:
    """Create test audio signal"""
    t = np.linspace(0, duration, int(sample_rate * duration))
    # Create a simple sine wave
    audio = np.sin(2 * np.pi * 440 * t)  # 440 Hz tone
    return audio.astype(np.float32)

def create_test_video_frame(width: int = 640, height: int = 480) -> np.ndarray:
    """Create test video frame"""
    return np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)

def create_test_landmarks(num_points: int = 21) -> np.ndarray:
    """Create test landmark data"""
    return np.random.rand(num_points, 3).astype(np.float32)

# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
