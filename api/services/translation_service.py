try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
except Exception:
    torch = None
    nn = None
    F = None
from typing import Dict, List, Optional, Tuple, Any
import json
import time
import logging
import re
from dataclasses import dataclass
from pathlib import Path
import numpy as np
try:
    from transformers import MarianMTModel, MarianTokenizer, pipeline
except Exception:
    MarianMTModel = None
    MarianTokenizer = None
    pipeline = None
import asyncio
from concurrent.futures import ThreadPoolExecutor
from backend.dictionary.text_to_sign import TextToSignService

logger = logging.getLogger(__name__)

@dataclass
class TranslationConfig:
    """Configuration for GSL-English translation"""
    model_name: str = "Helsinki-NLP/opus-mt-en-ROMANCE"  # Base model, will be fine-tuned
    max_length: int = 512
    num_beams: int = 4
    temperature: float = 0.7
    top_k: int = 50
    top_p: float = 0.9
    repetition_penalty: float = 1.1
    length_penalty: float = 1.0
    early_stopping: bool = True
    do_sample: bool = True
    device: str = "cpu"
    batch_size: int = 1
    
    # GSL-specific settings
    gsl_vocabulary_size: int = 5000  # Estimated GSL vocabulary size
    grammar_rules_enabled: bool = True
    context_window: int = 3  # Number of previous signs to consider
    confidence_threshold: float = 0.6

class GSLGrammarRules:
    """Ghana Sign Language grammar rules and transformations"""
    
    def __init__(self):
        # Load grammar rules from JSON or define them here
        self.grammar_rules = self._load_grammar_rules()
        self.sentence_structures = self._get_sentence_structures()
        self.common_phrases = self._get_common_phrases()
        self.temporal_markers = self._get_temporal_markers()
        self.spatial_markers = self._get_spatial_markers()
    
    def _load_grammar_rules(self) -> Dict:
        """Load GSL grammar rules"""
        return {
            "word_order": "Topic-Comment",  # GSL typically uses Topic-Comment structure
            "question_formation": {
                "wh_questions": "final_position",  # WH-words at end
                "yes_no_questions": "eyebrow_raise",  # Non-manual marker
                "question_marks": False  # No manual question marks
            },
            "negation": {
                "position": "pre_verbal",  # Negation before verb
                "non_manual": "head_shake",  # Head shake for negation
                "manual_signs": ["NOT", "NONE", "NEVER"]
            },
            "tense": {
                "past_marker": "FINISH",  # Past tense marker
                "future_marker": "WILL",  # Future tense marker
                "present": "no_marker"  # Present tense usually unmarked
            },
            "classifiers": {
                "descriptive": True,
                "locative": True,
                "semantic": True
            },
            "fingerspelling": {
                "proper_names": True,
                "technical_terms": True,
                "borrowed_words": True
            }
        }
    
    def _get_sentence_structures(self) -> Dict:
        """Define common GSL sentence structures"""
        return {
            "declarative": [
                ["SUBJECT", "OBJECT", "VERB"],
                ["TOPIC", "COMMENT"],
                ["TIME", "SUBJECT", "OBJECT", "VERB"]
            ],
            "interrogative": [
                ["SUBJECT", "OBJECT", "VERB", "QUESTION_WORD"],
                ["TOPIC", "COMMENT", "QUESTION_MARK"]
            ],
            "imperative": [
                ["VERB", "OBJECT"],
                ["YOU", "VERB", "OBJECT"]
            ],
            "conditional": [
                ["CONDITION", "RESULT"],
                ["IF", "CONDITION", "THEN", "RESULT"]
            ]
        }
    
    def _get_common_phrases(self) -> Dict:
        """Common GSL phrases and their English equivalents"""
        return {
            "greetings": {
                "HELLO": "Hello",
                "GOOD_MORNING": "Good morning",
                "GOOD_AFTERNOON": "Good afternoon",
                "GOOD_EVENING": "Good evening",
                "GOODBYE": "Goodbye",
                "THANK_YOU": "Thank you",
                "PLEASE": "Please",
                "SORRY": "Sorry"
            },
            "questions": {
                "WHAT": "What",
                "WHO": "Who",
                "WHERE": "Where",
                "WHEN": "When",
                "WHY": "Why",
                "HOW": "How",
                "WHICH": "Which"
            },
            "pronouns": {
                "I": "I",
                "YOU": "You",
                "HE": "He",
                "SHE": "She",
                "WE": "We",
                "THEY": "They",
                "IT": "It"
            },
            "common_verbs": {
                "WANT": "want",
                "NEED": "need",
                "LIKE": "like",
                "KNOW": "know",
                "THINK": "think",
                "FEEL": "feel",
                "SEE": "see",
                "HEAR": "hear"
            }
        }
    
    def _get_temporal_markers(self) -> Dict:
        """Temporal markers in GSL"""
        return {
            "past": ["YESTERDAY", "LAST_WEEK", "LAST_MONTH", "LAST_YEAR", "AGO"],
            "present": ["NOW", "TODAY", "THIS_WEEK", "THIS_MONTH"],
            "future": ["TOMORROW", "NEXT_WEEK", "NEXT_MONTH", "NEXT_YEAR", "SOON"],
            "frequency": ["ALWAYS", "OFTEN", "SOMETIMES", "RARELY", "NEVER"]
        }
    
    def _get_spatial_markers(self) -> Dict:
        """Spatial markers in GSL"""
        return {
            "directions": ["UP", "DOWN", "LEFT", "RIGHT", "FORWARD", "BACKWARD"],
            "locations": ["HERE", "THERE", "FAR", "NEAR", "INSIDE", "OUTSIDE"],
            "positions": ["ABOVE", "BELOW", "BESIDE", "BETWEEN", "IN_FRONT", "BEHIND"]
        }
    
    def apply_grammar_rules(self, gsl_sequence: List[str], context: Optional[List[str]] = None) -> List[str]:
        """Apply GSL grammar rules to sign sequence"""
        try:
            # Apply word order rules
            ordered_sequence = self._apply_word_order(gsl_sequence)
            
            # Apply tense markers
            ordered_sequence = self._apply_tense_markers(ordered_sequence)
            
            # Apply negation rules
            ordered_sequence = self._apply_negation_rules(ordered_sequence)
            
            # Apply question formation
            ordered_sequence = self._apply_question_rules(ordered_sequence)
            
            return ordered_sequence
            
        except Exception as e:
            logger.error(f"Error applying grammar rules: {e}")
            return gsl_sequence
    
    def _apply_word_order(self, sequence: List[str]) -> List[str]:
        """Apply GSL word order rules"""
        # Simple implementation - in practice, this would be more complex
        if len(sequence) >= 3:
            # Basic Topic-Comment structure
            if sequence[0] in self.common_phrases["pronouns"].keys():
                # Likely a subject-predicate structure
                return sequence
        
        return sequence
    
    def _apply_tense_markers(self, sequence: List[str]) -> List[str]:
        """Apply tense markers"""
        # Check for temporal indicators
        for i, sign in enumerate(sequence):
            if sign in self.temporal_markers["past"]:
                # Add past marker if not present
                if "FINISH" not in sequence:
                    sequence.insert(i + 1, "FINISH")
            elif sign in self.temporal_markers["future"]:
                # Add future marker if not present
                if "WILL" not in sequence:
                    sequence.insert(i + 1, "WILL")
        
        return sequence
    
    def _apply_negation_rules(self, sequence: List[str]) -> List[str]:
        """Apply negation rules"""
        # Check for negation signs
        negation_signs = ["NOT", "NONE", "NEVER"]
        for sign in sequence:
            if sign in negation_signs:
                # Ensure negation is properly positioned
                # This is a simplified implementation
                break
        
        return sequence
    
    def _apply_question_rules(self, sequence: List[str]) -> List[str]:
        """Apply question formation rules"""
        question_words = list(self.common_phrases["questions"].keys())
        
        # Check if sequence contains question words
        has_question = any(sign in question_words for sign in sequence)
        
        if has_question:
            # Apply question formation rules
            # Move question words to final position if needed
            pass
        
        return sequence
    
    def translate_to_english(self, gsl_sequence: List[str]) -> str:
        """Translate GSL sequence to English"""
        try:
            english_words = []
            
            for sign in gsl_sequence:
                # Check common phrases first
                translated = False
                
                for category, phrases in self.common_phrases.items():
                    if sign in phrases:
                        english_words.append(phrases[sign])
                        translated = True
                        break
                
                if not translated:
                    # Use a simple mapping or keep the sign as is
                    english_words.append(sign.replace("_", " ").lower())
            
            # Apply English grammar rules
            from ..nlp.gsl_to_en import to_english
            return to_english(gsl_sequence)
            
        except Exception as e:
            logger.error(f"Error translating to English: {e}")
            return " ".join(gsl_sequence).replace("_", " ").lower()
    
    def _apply_english_grammar(self, sentence: str) -> str:
        """Apply basic English grammar corrections"""
        return sentence

if nn is not None and torch is not None:
    class GSLTranslationModel(nn.Module):
        """Neural translation model for GSL-English translation"""
        def __init__(self, config: TranslationConfig, gsl_vocab_size: int, english_vocab_size: int):
            super().__init__()
            self.config = config
            self.encoder_embedding = nn.Embedding(gsl_vocab_size, 512)
            self.decoder_embedding = nn.Embedding(english_vocab_size, 512)
            self.encoder = nn.TransformerEncoder(
                nn.TransformerEncoderLayer(d_model=512, nhead=8, dim_feedforward=2048, dropout=0.1, activation='relu'),
                num_layers=6
            )
            self.decoder = nn.TransformerDecoder(
                nn.TransformerDecoderLayer(d_model=512, nhead=8, dim_feedforward=2048, dropout=0.1, activation='relu'),
                num_layers=6
            )
            self.output_projection = nn.Linear(512, english_vocab_size)
            self.positional_encoding = self._create_positional_encoding(1000, 512)
            self.dropout = nn.Dropout(0.1)
        def _create_positional_encoding(self, max_len: int, d_model: int) -> torch.Tensor:
            pe = torch.zeros(max_len, d_model)
            position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
            div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-np.log(10000.0) / d_model))
            pe[:, 0::2] = torch.sin(position * div_term)
            pe[:, 1::2] = torch.cos(position * div_term)
            return pe.unsqueeze(0).transpose(0, 1)
        def forward(self, gsl_tokens: torch.Tensor, english_tokens: torch.Tensor, src_mask: Optional[torch.Tensor] = None, tgt_mask: Optional[torch.Tensor] = None) -> torch.Tensor:
            gsl_embedded = self.encoder_embedding(gsl_tokens) * np.sqrt(512)
            gsl_embedded = self.dropout(gsl_embedded + self.positional_encoding[:gsl_tokens.size(0), :])
            memory = self.encoder(gsl_embedded, src_key_padding_mask=src_mask)
            english_embedded = self.decoder_embedding(english_tokens) * np.sqrt(512)
            english_embedded = self.dropout(english_embedded + self.positional_encoding[:english_tokens.size(0), :])
            decoder_output = self.decoder(english_embedded, memory, tgt_key_padding_mask=tgt_mask)
            logits = self.output_projection(decoder_output)
            return logits

class GSLTranslationService:
    """Main translation service for GSL-English translation (Optimized for Render Free Tier)"""
    
    def __init__(self, config: TranslationConfig):
        self.config = config
        self.grammar_rules = GSLGrammarRules()
        self.model = None
        self.tokenizer = None
        self.is_loaded = True # Rule-based is always loaded
        self.text_to_sign_service = TextToSignService()
        
        # Minimal vocabulary mappings for rule-based fallback
        self.gsl_to_id = {}
        self.english_to_id = {}
        self._build_basic_vocabularies()
        
        logger.info("GSLTranslationService (Rule-based Optimized) initialized")
    
    async def load_model(self, model_path: Optional[str] = None):
        """No-op for Render Free Tier to save RAM"""
        pass

    def _build_basic_vocabularies(self):
        """Build basic GSL and English vocabularies"""
        gsl_signs = ["HELLO", "GOODBYE", "THANK_YOU", "PLEASE", "SORRY", "YES", "NO"]
        for i, sign in enumerate(gsl_signs):
            self.gsl_to_id[sign] = i
        
        english_words = ["hello", "goodbye", "thank", "you", "please", "sorry"]
        for i, word in enumerate(english_words):
            self.english_to_id[word] = i

    async def translate_gsl_to_english(self, gsl_sequence: List[str], context: Optional[List[str]] = None) -> Dict:
        """Translate GSL sign sequence to English using rule-based engine"""
        try:
            # Apply grammar rules
            if self.config.grammar_rules_enabled:
                gsl_sequence = self.grammar_rules.apply_grammar_rules(gsl_sequence, context)
            
            # Use the rule-based engine
            english_text = self.grammar_rules.translate_to_english(gsl_sequence)
            
            return {
                'english_text': english_text,
                'gsl_sequence': gsl_sequence,
                'confidence': 0.8,
                'translation_method': 'rule_based_optimized',
                'timestamp': time.time()
            }
            
        except Exception as e:
            logger.error(f"Error translating GSL to English: {e}")
            return {
                'english_text': "Translation error",
                'gsl_sequence': gsl_sequence,
                'confidence': 0.0,
                'error': str(e),
                'timestamp': time.time()
            }

    async def translate_english_to_gsl(self, english_text: str, context: Optional[List[str]] = None) -> Dict:
        """Translate English text to GSL sign sequence using rule-based engine"""
        try:
            translation = self.text_to_sign_service.translate_text(english_text)
            
            return {
                'gsl_sequence': translation.get('gsl_sequence', []),
                'english_text': english_text,
                'entries': translation.get('entries', []),
                'recognized_units': translation.get('recognized_units', []),
                'matched_count': int(translation.get('matched_count', 0) or 0),
                'unknown_count': int(translation.get('unknown_count', 0) or 0),
                'confidence': float(translation.get('confidence', 0.0) or 0.0),
                'translation_method': 'rule_based_optimized',
                'timestamp': time.time()
            }
        except Exception as e:
            logger.error(f"Error translating English to GSL: {e}")
            return {'gsl_sequence': [], 'english_text': english_text, 'confidence': 0.0, 'error': str(e)}

    def get_translation_info(self) -> Dict:
        return {
            'model_loaded': True,
            'grammar_rules_enabled': self.config.grammar_rules_enabled,
            'translation_methods': ['rule_based_optimized']
        }
    
    def get_grammar_rules(self) -> Dict:
        """Get GSL grammar rules"""
        return self.grammar_rules.grammar_rules
    
    def get_common_phrases(self) -> Dict:
        """Get common GSL phrases"""
        return self.grammar_rules.common_phrases

# Usage example and testing
if __name__ == "__main__":
    # Initialize configuration
    config = TranslationConfig(
        grammar_rules_enabled=True,
        confidence_threshold=0.6
    )
    
    # Initialize service
    service = GSLTranslationService(config)
    
    async def test_translation():
        # Load model
        await service.load_model()
        
        # Test GSL to English translation
        gsl_sequence = ["I", "WANT", "EAT", "FOOD"]
        result = await service.translate_gsl_to_english(gsl_sequence)
        print("GSL to English:", result)
        
        # Test English to GSL translation
        english_text = "I want to eat food"
        result = await service.translate_english_to_gsl(english_text)
        print("English to GSL:", result)
        
        # Print service info
        print("Service Info:", service.get_translation_info())
    
    asyncio.run(test_translation())

class TranslationService(GSLTranslationService):
    async def translate_sign_to_speech(self, pose_sequence, context):
        # Placeholder mapping from pose to GSL sequence; integrate with sign recognition
        gsl_sequence = ["HELLO", "HOW", "YOU"]
        result = await self.translate_gsl_to_english(gsl_sequence)
        return {
            "gsl_glosses": gsl_sequence,
            "english_text": result["english_text"],
            "confidence": result.get("confidence", 0.8),
            "processing_time_ms": 200,
        }

    async def translate_speech_to_sign(self, text: str, speed: float = 1.0):
        result = await self.translate_english_to_gsl(text)
        return {
            "gsl_sequence": result["gsl_sequence"] if "gsl_sequence" in result else result.get("gsl_signs", []),
            "entries": result.get("entries", []),
            "recognized_units": result.get("recognized_units", []),
            "english_text": text,
            "confidence": result.get("confidence", 0.7),
            "matched_count": result.get("matched_count", 0),
            "unknown_count": result.get("unknown_count", 0),
            "processing_time_ms": 120,
            "speed": speed,
        }
