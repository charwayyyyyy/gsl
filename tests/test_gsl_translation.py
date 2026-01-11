import pytest
import torch
import numpy as np
from unittest.mock import Mock, patch
import sys
import os

# Add the api directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

from services.gsl_translation_engine import (
    GSLTranslationService,
    TranslationConfig,
    GSLVocabulary,
    GSLGrammarRules,
    get_gsl_translation_service
)

class TestTranslationConfig:
    """Test TranslationConfig"""
    
    def test_default_config(self):
        """Test default configuration values"""
        config = TranslationConfig()
        
        assert config.input_dim == 768
        assert config.hidden_dim == 512
        assert config.num_layers == 4
        assert config.num_heads == 8
        assert config.dropout == 0.1
        assert config.max_sequence_length == 512
        assert config.vocab_size == 50000
        assert config.gsl_vocab_size == 2000
        assert config.learning_rate == 1e-4
        assert config.device in ['cuda', 'cpu']
        assert config.support_ghanian_english is True
        assert config.support_twi_loanwords is True
        assert config.support_local_expressions is True

    def test_custom_config(self):
        """Test custom configuration values"""
        config = TranslationConfig(
            input_dim=1024,
            hidden_dim=768,
            num_layers=6,
            vocab_size=100000
        )
        
        assert config.input_dim == 1024
        assert config.hidden_dim == 768
        assert config.num_layers == 6
        assert config.vocab_size == 100000

class TestGSLVocabulary:
    """Test GSLVocabulary"""
    
    def test_vocabulary_initialization(self):
        """Test vocabulary initialization"""
        vocab = GSLVocabulary()
        
        assert vocab is not None
        assert hasattr(vocab, 'gsl_signs')
        assert hasattr(vocab, 'english_to_gsl')
        assert hasattr(vocab, 'ghanian_expressions')
        assert hasattr(vocab, 'twi_loanwords')
        
        # Check that basic signs are present
        assert "HELLO" in vocab.gsl_signs
        assert "THANK_YOU" in vocab.gsl_signs
        assert "WHO" in vocab.gsl_signs

    def test_get_gsl_sign_basic(self):
        """Test getting GSL sign for basic English word"""
        vocab = GSLVocabulary()
        
        signs = vocab.get_gsl_sign("hello")
        
        assert isinstance(signs, list)
        assert len(signs) > 0
        assert "HELLO" in signs

    def test_get_gsl_sign_unknown_word(self):
        """Test getting GSL sign for unknown English word"""
        vocab = GSLVocabulary()
        
        signs = vocab.get_gsl_sign("nonexistentword")
        
        assert isinstance(signs, list)
        assert len(signs) == 0  # Should return empty list for unknown words

    def test_get_english_translation(self):
        """Test getting English translation for GSL sign"""
        vocab = GSLVocabulary()
        
        translation = vocab.get_english_translation("HELLO")
        
        assert translation == "hello"

    def test_get_english_translation_unknown_sign(self):
        """Test getting English translation for unknown GSL sign"""
        vocab = GSLVocabulary()
        
        translation = vocab.get_english_translation("UNKNOWN_SIGN")
        
        assert translation == "unknown"

    def test_process_ghanian_expression_basic(self):
        """Test processing basic Ghanaian English expression"""
        vocab = GSLVocabulary()
        
        result = vocab.process_ghanian_expression("how are you")
        
        assert isinstance(result, list)
        assert "HELLO" in result
        assert "HOW" in result

    def test_process_ghanian_expression_with_twi_loanword(self):
        """Test processing expression with Twi loanword"""
        vocab = GSLVocabulary()
        
        result = vocab.process_ghanian_expression("akwaaba my friend")
        
        assert isinstance(result, list)
        assert "AKWAABA" in result  # Twi loanword

    def test_process_ghanian_expression_with_fingerspelling(self):
        """Test processing expression requiring fingerspelling"""
        vocab = GSLVocabulary()
        
        result = vocab.process_ghanian_expression("my name is john")
        
        assert isinstance(result, list)
        # Should include fingerspelling for unknown words
        assert any("FINGERSPELL_" in sign for sign in result)

class TestGSLGrammarRules:
    """Test GSLGrammarRules"""
    
    def test_grammar_rules_initialization(self):
        """Test grammar rules initialization"""
        grammar = GSLGrammarRules()
        
        assert grammar is not None
        assert hasattr(grammar, 'gsl_sentence_structure')
        assert hasattr(grammar, 'word_order_rules')
        assert hasattr(grammar, 'non_manual_markers')

    def test_detect_sentence_type_question(self):
        """Test detecting question sentence type"""
        grammar = GSLGrammarRules()
        
        sentence_type = grammar._detect_sentence_type("what is your name")
        
        assert sentence_type == "question"

    def test_detect_sentence_type_negative(self):
        """Test detecting negative sentence type"""
        grammar = GSLGrammarRules()
        
        sentence_type = grammar._detect_sentence_type("i don't know")
        
        assert sentence_type == "negative"

    def test_detect_sentence_type_emphasis(self):
        """Test detecting emphasis sentence type"""
        grammar = GSLGrammarRules()
        
        sentence_type = grammar._detect_sentence_type("i really like it")
        
        assert sentence_type == "emphasis"

    def test_detect_sentence_type_basic(self):
        """Test detecting basic sentence type"""
        grammar = GSLGrammarRules()
        
        sentence_type = grammar._detect_sentence_type("i like food")
        
        assert sentence_type == "basic"

    def test_reorder_for_question(self):
        """Test reordering signs for question structure"""
        grammar = GSLGrammarRules()
        
        gsl_signs = ["YOUR", "NAME", "WHAT"]
        reordered = grammar._reorder_for_question(gsl_signs, "what is your name")
        
        assert reordered[0] == "WHAT"  # Question word should be first

    def test_reorder_for_negative(self):
        """Test reordering signs for negative structure"""
        grammar = GSLGrammarRules()
        
        gsl_signs = ["I", "KNOW"]
        reordered = grammar._reorder_for_negative(gsl_signs)
        
        assert "NOT" in reordered  # Should add NOT sign

    def test_reorder_for_emphasis(self):
        """Test reordering signs for emphasis structure"""
        grammar = GSLGrammarRules()
        
        gsl_signs = ["I", "REALLY", "LIKE", "IT"]
        reordered = grammar._reorder_for_emphasis(gsl_signs)
        
        # Should reorder for emphasis (implementation specific)
        assert isinstance(reordered, list)
        assert len(reordered) == len(gsl_signs)

    def test_apply_gsl_grammar_question(self):
        """Test applying GSL grammar to question"""
        grammar = GSLGrammarRules()
        
        gsl_signs = ["WHAT", "YOUR", "NAME"]
        result = grammar.apply_gsl_grammar("what is your name", gsl_signs)
        
        assert isinstance(result, list)
        assert "WHAT" in result

class TestGSLTranslationService:
    """Test GSLTranslationService"""
    
    def test_service_initialization(self):
        """Test service initialization"""
        service = GSLTranslationService()
        
        assert service is not None
        assert hasattr(service, 'vocabulary')
        assert hasattr(service, 'grammar_rules')
        assert hasattr(service, 'model')
        assert hasattr(service, 'optimizer')
        assert hasattr(service, 'criterion')

    def test_translate_gsl_to_english_basic(self):
        """Test basic GSL to English translation"""
        service = GSLTranslationService()
        
        gsl_signs = ["HELLO", "HOW", "YOU"]
        result = service.translate_gsl_to_english(gsl_signs, use_neural=False)
        
        assert result["success"] is True
        assert "hello" in result["english_text"].lower()
        assert result["method"] == "rule_based"
        assert result["confidence"] == 0.7

    def test_translate_gsl_to_english_with_fingerspelling(self):
        """Test GSL to English translation with fingerspelling"""
        service = GSLTranslationService()
        
        gsl_signs = ["MY", "NAME", "FINGERSPELL_JOHN"]
        result = service.translate_gsl_to_english(gsl_signs, use_neural=False)
        
        assert result["success"] is True
        assert "john" in result["english_text"].lower()
        assert result["method"] == "rule_based"

    def test_translate_english_to_gsl_basic(self):
        """Test basic English to GSL translation"""
        service = GSLTranslationService()
        
        english_text = "hello how are you"
        result = service.translate_english_to_gsl(english_text, use_neural=False)
        
        assert result["success"] is True
        assert isinstance(result["gsl_signs"], list)
        assert len(result["gsl_signs"]) > 0
        assert result["method"] == "rule_based"
        assert result["confidence"] == 0.7

    def test_translate_english_to_gsl_with_ghanian_expression(self):
        """Test English to GSL translation with Ghanaian expression"""
        service = GSLTranslationService()
        
        english_text = "how are you"
        result = service.translate_english_to_gsl(english_text, use_neural=False)
        
        assert result["success"] is True
        assert isinstance(result["gsl_signs"], list)
        # Should recognize "how are you" as a Ghanaian expression
        assert "HELLO" in result["gsl_signs"] or "HOW" in result["gsl_signs"]

    def test_translate_gsl_to_english_empty(self):
        """Test GSL to English translation with empty input"""
        service = GSLTranslationService()
        
        gsl_signs = []
        result = service.translate_gsl_to_english(gsl_signs, use_neural=False)
        
        assert result["success"] is True
        assert result["english_text"] == ""
        assert result["method"] == "rule_based"

    def test_translate_english_to_gsl_empty(self):
        """Test English to GSL translation with empty input"""
        service = GSLTranslationService()
        
        english_text = ""
        result = service.translate_english_to_gsl(english_text, use_neural=False)
        
        assert result["success"] is True
        assert result["gsl_signs"] == []
        assert result["method"] == "rule_based"

    def test_train_step(self):
        """Test training step"""
        service = GSLTranslationService()
        
        # Create dummy training data
        batch_size = 2
        seq_len = 10
        
        gsl_sequences = torch.randint(0, service.config.gsl_vocab_size, (batch_size, seq_len))
        english_tokens = torch.randint(0, service.config.vocab_size, (batch_size, seq_len))
        target_tokens = torch.randint(0, service.config.vocab_size, (batch_size, seq_len))
        
        # Perform training step
        loss = service.train_step(gsl_sequences, english_tokens, target_tokens)
        
        assert loss >= 0.0  # Loss should be non-negative
        assert isinstance(loss, float)

    def test_get_translation_info(self):
        """Test getting translation service information"""
        service = GSLTranslationService()
        
        info = service.get_translation_info()
        
        assert info["service_type"] == "GSL-English Translation"
        assert info["model_parameters"] > 0
        assert info["gsl_vocabulary_size"] == len(service.vocabulary.gsl_signs)
        assert info["english_vocabulary_size"] == service.config.vocab_size
        assert info["supports_ghanian_english"] is True
        assert info["supports_twi_loanwords"] is True
        assert info["supports_local_expressions"] is True

class TestErrorHandling:
    """Test error handling in GSL translation service"""
    
    def test_translate_gsl_to_english_with_exception(self):
        """Test GSL to English translation with exception"""
        service = GSLTranslationService()
        
        # Mock the rule-based method to raise an exception
        with patch.object(service, '_rule_based_translate_gsl_to_english') as mock_method:
            mock_method.side_effect = Exception("Translation error")
            
            gsl_signs = ["HELLO"]
            result = service.translate_gsl_to_english(gsl_signs, use_neural=False)
            
            assert result["success"] is False
            assert result["english_text"] == ""
            assert "error" in result
            assert result["confidence"] == 0.0
            assert result["method"] == "error"

    def test_translate_english_to_gsl_with_exception(self):
        """Test English to GSL translation with exception"""
        service = GSLTranslationService()
        
        # Mock the rule-based method to raise an exception
        with patch.object(service, '_rule_based_translate_english_to_gsl') as mock_method:
            mock_method.side_effect = Exception("Translation error")
            
            english_text = "hello"
            result = service.translate_english_to_gsl(english_text, use_neural=False)
            
            assert result["success"] is False
            assert result["gsl_signs"] == []
            assert "error" in result
            assert result["confidence"] == 0.0
            assert result["method"] == "error"

    def test_train_step_with_invalid_data(self):
        """Test training step with invalid data"""
        service = GSLTranslationService()
        
        # Create invalid training data (wrong shapes)
        gsl_sequences = torch.randn(2, 10)  # Wrong type, should be integers
        english_tokens = torch.randn(2, 10)  # Wrong type, should be integers
        target_tokens = torch.randn(2, 10)  # Wrong type, should be integers
        
        # Should handle error gracefully
        loss = service.train_step(gsl_sequences, english_tokens, target_tokens)
        
        assert loss == 0.0  # Should return 0.0 on error

class TestGlobalService:
    """Test global service instance"""
    
    def test_get_gsl_translation_service(self):
        """Test getting global service instance"""
        # Clear any existing instance
        import services.gsl_translation_engine as gte
        gte._translation_service = None
        
        # Get service instance
        service1 = get_gsl_translation_service()
        service2 = get_gsl_translation_service()
        
        # Should return the same instance (singleton)
        assert service1 is service2
        assert isinstance(service1, GSLTranslationService)

@pytest.mark.integration
class TestIntegration:
    """Integration tests for GSL translation service"""
    
    def test_end_to_end_translation_workflow(self):
        """Test end-to-end translation workflow"""
        service = GSLTranslationService()
        
        # English to GSL translation
        english_text = "hello how are you"
        gsl_result = service.translate_english_to_gsl(english_text, use_neural=False)
        
        assert gsl_result["success"] is True
        assert len(gsl_result["gsl_signs"]) > 0
        
        # GSL back to English translation
        gsl_signs = gsl_result["gsl_signs"]
        english_result = service.translate_gsl_to_english(gsl_signs, use_neural=False)
        
        assert english_result["success"] is True
        assert english_result["english_text"] != ""

    def test_ghanian_expressions_translation(self):
        """Test translation of Ghanaian expressions"""
        service = GSLTranslationService()
        
        # Test various Ghanaian expressions
        expressions = [
            "how are you",
            "what is your name",
            "my name is",
            "thank you",
            "akwaaba"
        ]
        
        for expression in expressions:
            result = service.translate_english_to_gsl(expression, use_neural=False)
            
            assert result["success"] is True
            assert isinstance(result["gsl_signs"], list)
            assert len(result["gsl_signs"]) > 0

    def test_complex_sentence_translation(self):
        """Test translation of more complex sentences"""
        service = GSLTranslationService()
        
        complex_sentences = [
            "where is the bathroom",
            "how much does it cost",
            "can you help me please",
            "i don't understand"
        ]
        
        for sentence in complex_sentences:
            result = service.translate_english_to_gsl(sentence, use_neural=False)
            
            assert result["success"] is True
            assert isinstance(result["gsl_signs"], list)
            assert result["method"] == "rule_based"

    def test_training_and_translation(self):
        """Test training followed by translation"""
        service = GSLTranslationService()
        
        # Create dummy training data
        batch_size = 2
        seq_len = 5
        
        gsl_sequences = torch.randint(0, service.config.gsl_vocab_size, (batch_size, seq_len))
        english_tokens = torch.randint(0, service.config.vocab_size, (batch_size, seq_len))
        target_tokens = torch.randint(0, service.config.vocab_size, (batch_size, seq_len))
        
        # Perform training step
        loss = service.train_step(gsl_sequences, english_tokens, target_tokens)
        
        assert loss >= 0.0
        assert isinstance(loss, float)
        
        # Test translation after training
        translation_result = service.translate_english_to_gsl("hello", use_neural=False)
        
        assert translation_result["success"] is True
        assert len(translation_result["gsl_signs"]) > 0

if __name__ == "__main__":
    pytest.main([__file__])