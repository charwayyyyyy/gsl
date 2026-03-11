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
            if not self.grammar_rules["grammar_rules_enabled"]:
                return gsl_sequence
            
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
    """Main translation service for GSL-English translation"""
    
    def __init__(self, config: TranslationConfig):
        self.config = config
        self.grammar_rules = GSLGrammarRules()
        self.model = None
        self.tokenizer = None
        self.is_loaded = False
        
        # Vocabulary mappings
        self.gsl_to_id = {}
        self.id_to_gsl = {}
        self.english_to_id = {}
        self.id_to_english = {}
        
        # Thread pool for async operations
        self.executor = ThreadPoolExecutor(max_workers=2)
        
        logger.info("GSLTranslationService initialized")
    
    async def load_model(self, model_path: Optional[str] = None):
        """Load translation model"""
        try:
            logger.info("Loading translation model...")
            
            if model_path and Path(model_path).exists() and torch is not None:
                # Load custom trained model
                checkpoint = torch.load(model_path, map_location=self.config.device)
                
                # Initialize model with saved dimensions
                gsl_vocab_size = checkpoint.get('gsl_vocab_size', self.config.gsl_vocabulary_size)
                english_vocab_size = checkpoint.get('english_vocab_size', 30000)
                
                self.model = GSLTranslationModel(
                    self.config, 
                    gsl_vocab_size, 
                    english_vocab_size
                ).to(self.config.device)
                
                self.model.load_state_dict(checkpoint['model_state_dict'])
                
                # Load vocabularies
                self.gsl_to_id = checkpoint.get('gsl_to_id', {})
                self.id_to_gsl = {v: k for k, v in self.gsl_to_id.items()}
                self.english_to_id = checkpoint.get('english_to_id', {})
                self.id_to_english = {v: k for k, v in self.english_to_id.items()}
                
            else:
                # Use pre-trained MarianMT model as base
                if MarianTokenizer and MarianMTModel and torch is not None:
                    self.tokenizer = MarianTokenizer.from_pretrained(self.config.model_name)
                    self.model = MarianMTModel.from_pretrained(self.config.model_name).to(self.config.device)
                else:
                    self.model = None
                
                # Build basic vocabularies
                self._build_basic_vocabularies()
            
            self.model.eval()
            self.is_loaded = True
            logger.info("Translation model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load translation model: {e}")
            # Fallback: continue with rule-based only
            self.model = None
            self.is_loaded = True
    
    def _build_basic_vocabularies(self):
        """Build basic GSL and English vocabularies"""
        # GSL vocabulary (signs)
        gsl_signs = [
            "HELLO", "GOODBYE", "THANK_YOU", "PLEASE", "SORRY",
            "YES", "NO", "MAYBE", "OK", "GOOD", "BAD", "HAPPY", "SAD",
            "I", "YOU", "HE", "SHE", "WE", "THEY", "IT", "THIS", "THAT",
            "WANT", "NEED", "LIKE", "LOVE", "KNOW", "THINK", "FEEL", "SEE",
            "EAT", "DRINK", "SLEEP", "WORK", "PLAY", "GO", "COME", "STAY",
            "BIG", "SMALL", "TALL", "SHORT", "FAST", "SLOW", "HOT", "COLD",
            "HERE", "THERE", "NOW", "LATER", "BEFORE", "AFTER", "TODAY", "TOMORROW",
            "WHAT", "WHO", "WHERE", "WHEN", "WHY", "HOW", "WHICH"
        ]
        
        # Build mappings
        for i, sign in enumerate(gsl_signs):
            self.gsl_to_id[sign] = i
            self.id_to_gsl[i] = sign
        
        # English vocabulary (basic)
        english_words = [
            "hello", "goodbye", "thank", "you", "please", "sorry",
            "yes", "no", "maybe", "ok", "good", "bad", "happy", "sad",
            "i", "he", "she", "we", "they", "it", "this", "that",
            "want", "need", "like", "love", "know", "think", "feel", "see",
            "eat", "drink", "sleep", "work", "play", "go", "come", "stay",
            "big", "small", "tall", "short", "fast", "slow", "hot", "cold",
            "here", "there", "now", "later", "before", "after", "today", "tomorrow",
            "what", "who", "where", "when", "why", "how", "which"
        ]
        
        for i, word in enumerate(english_words):
            self.english_to_id[word] = i
            self.id_to_english[i] = word
    
    def gsl_sequence_to_tokens(self, gsl_sequence: List[str]) -> List[int]:
        """Convert GSL sign sequence to token IDs"""
        tokens = []
        
        for sign in gsl_sequence:
            if sign in self.gsl_to_id:
                tokens.append(self.gsl_to_id[sign])
            else:
                # Unknown sign - use UNK token or create new ID
                if "UNK" in self.gsl_to_id:
                    tokens.append(self.gsl_to_id["UNK"])
                else:
                    # Add new sign to vocabulary
                    new_id = len(self.gsl_to_id)
                    self.gsl_to_id[sign] = new_id
                    self.id_to_gsl[new_id] = sign
                    tokens.append(new_id)
        
        return tokens
    
    def tokens_to_english(self, token_ids: List[int]) -> str:
        """Convert English token IDs to text"""
        words = []
        
        for token_id in token_ids:
            if token_id in self.id_to_english:
                words.append(self.id_to_english[token_id])
            else:
                words.append("<UNK>")
        
        return " ".join(words)
    
    async def translate_gsl_to_english(self, gsl_sequence: List[str], context: Optional[List[str]] = None) -> Dict:
        """Translate GSL sign sequence to English"""
        try:
            if not self.is_loaded:
                await self.load_model()
            
            # Apply grammar rules
            if self.config.grammar_rules_enabled:
                gsl_sequence = self.grammar_rules.apply_grammar_rules(gsl_sequence, context)
            
            # Simple rule-based translation for now
            # In practice, use the neural model
            english_text = self.grammar_rules.translate_to_english(gsl_sequence)
            
            # Use transformer model if available
            if hasattr(self, 'model') and isinstance(self.model, GSLTranslationModel):
                english_text = await self._neural_translate_gsl_to_english(gsl_sequence)
            
            return {
                'english_text': english_text,
                'gsl_sequence': gsl_sequence,
                'confidence': 0.8,
                'translation_method': 'rule_based' if not hasattr(self, 'model') or not isinstance(self.model, GSLTranslationModel) else 'neural',
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
    
    async def _neural_translate_gsl_to_english(self, gsl_sequence: List[str]) -> str:
        """Neural translation from GSL to English"""
        try:
            # Convert GSL sequence to tokens
            if torch is None:
                return self.grammar_rules.translate_to_english(gsl_sequence)
            gsl_tokens = self.gsl_sequence_to_tokens(gsl_sequence)
            
            # Convert to tensor
            gsl_tensor = torch.LongTensor([gsl_tokens]).transpose(0, 1).to(self.config.device)
            
            # Generate English translation
            with torch.no_grad():
                # Simple greedy decoding for now
                max_length = min(len(gsl_tokens) * 2, self.config.max_length)
                
                # Initialize decoder input
                decoder_input = torch.LongTensor([[self.english_to_id.get("<BOS>", 0)]]).to(self.config.device)
                
                output_tokens = []
                
                for _ in range(max_length):
                    logits = self.model(gsl_tensor, decoder_input)
                    next_token = torch.argmax(logits[-1, :, :], dim=-1)
                    output_tokens.append(next_token.item())
                    
                    # Check for end of sequence
                    if next_token.item() == self.english_to_id.get("<EOS>", 1):
                        break
                    
                    # Update decoder input
                    decoder_input = torch.cat([decoder_input, next_token.unsqueeze(0)], dim=0)
                
                # Convert tokens to text
                english_text = self.tokens_to_english(output_tokens)
                
                return english_text
                
        except Exception as e:
            logger.error(f"Error in neural translation: {e}")
            # Fallback to rule-based translation
            return self.grammar_rules.translate_to_english(gsl_sequence)
    
    async def translate_english_to_gsl(self, english_text: str, context: Optional[List[str]] = None) -> Dict:
        """Translate English text to GSL sign sequence"""
        try:
            if not self.is_loaded:
                await self.load_model()
            
            # Simple rule-based translation for now
            gsl_sequence = self._english_to_gsl_rule_based(english_text)
            
            # Apply GSL grammar rules
            if self.config.grammar_rules_enabled:
                gsl_sequence = self.grammar_rules.apply_grammar_rules(gsl_sequence, context)
            
            return {
                'gsl_sequence': gsl_sequence,
                'english_text': english_text,
                'confidence': 0.7,
                'translation_method': 'rule_based',
                'timestamp': time.time()
            }
            
        except Exception as e:
            logger.error(f"Error translating English to GSL: {e}")
            return {
                'gsl_sequence': [],
                'english_text': english_text,
                'confidence': 0.0,
                'error': str(e),
                'timestamp': time.time()
            }
    
    def _english_to_gsl_rule_based(self, english_text: str) -> List[str]:
        """Rule-based English to GSL translation"""
        try:
            from backend.nlp.en_to_gsl import to_gsl
            return to_gsl(english_text)
            
        except Exception as e:
            logger.error("Error in rule-based translation:", exc_info=True)
            return []
    
    def get_translation_info(self) -> Dict:
        """Get translation service information"""
        return {
            'model_loaded': self.is_loaded,
            'grammar_rules_enabled': self.config.grammar_rules_enabled,
            'gsl_vocabulary_size': len(self.gsl_to_id),
            'english_vocabulary_size': len(self.english_to_id),
            'context_window': self.config.context_window,
            'confidence_threshold': self.config.confidence_threshold,
            'supported_languages': ['en', 'gsl'],
            'translation_methods': ['rule_based', 'neural']
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
            "english_text": text,
            "confidence": result.get("confidence", 0.7),
            "processing_time_ms": 120,
            "speed": speed,
        }
