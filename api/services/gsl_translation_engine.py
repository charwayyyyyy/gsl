import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
import logging
from pathlib import Path
import json
import re
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger(__name__)

@dataclass
class TranslationConfig:
    """Configuration for GSL-English translation engine"""
    input_dim: int = 768  # BERT-like embedding dimension
    hidden_dim: int = 512
    num_layers: int = 4
    num_heads: int = 8
    dropout: float = 0.1
    max_sequence_length: int = 512
    vocab_size: int = 50000
    gsl_vocab_size: int = 2000  # Number of GSL signs/concepts
    learning_rate: float = 1e-4
    device: str = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    # Ghana-specific settings
    support_ghanian_english: bool = True
    support_twi_loanwords: bool = True
    support_local_expressions: bool = True

class GSLVocabulary:
    """GSL (Ghana Sign Language) vocabulary and grammar rules"""
    
    def __init__(self):
        # GSL signs with their English equivalents
        self.gsl_signs = {
            # Basic greetings
            "HELLO": {"english": "hello", "category": "greeting", "type": "single_hand"},
            "GOODBYE": {"english": "goodbye", "category": "greeting", "type": "single_hand"},
            "THANK_YOU": {"english": "thank you", "category": "politeness", "type": "two_hands"},
            "PLEASE": {"english": "please", "category": "politeness", "type": "single_hand"},
            "SORRY": {"english": "sorry", "category": "politeness", "type": "single_hand"},
            
            # Common questions
            "WHO": {"english": "who", "category": "question", "type": "single_hand"},
            "WHAT": {"english": "what", "category": "question", "type": "single_hand"},
            "WHERE": {"english": "where", "category": "question", "type": "single_hand"},
            "WHEN": {"english": "when", "category": "question", "type": "single_hand"},
            "WHY": {"english": "why", "category": "question", "type": "single_hand"},
            "HOW": {"english": "how", "category": "question", "type": "single_hand"},
            
            # Basic verbs
            "GO": {"english": "go", "category": "verb", "type": "single_hand"},
            "COME": {"english": "come", "category": "verb", "type": "single_hand"},
            "WANT": {"english": "want", "category": "verb", "type": "single_hand"},
            "NEED": {"english": "need", "category": "verb", "type": "single_hand"},
            "LIKE": {"english": "like", "category": "verb", "type": "single_hand"},
            "KNOW": {"english": "know", "category": "verb", "type": "single_hand"},
            "THINK": {"english": "think", "category": "verb", "type": "single_hand"},
            
            # Basic nouns
            "PERSON": {"english": "person", "category": "noun", "type": "single_hand"},
            "HOUSE": {"english": "house", "category": "noun", "type": "two_hands"},
            "FOOD": {"english": "food", "category": "noun", "type": "single_hand"},
            "WATER": {"english": "water", "category": "noun", "type": "single_hand"},
            "TIME": {"english": "time", "category": "noun", "type": "single_hand"},
            "MONEY": {"english": "money", "category": "noun", "type": "single_hand"},
            
            # Numbers (1-10)
            "ONE": {"english": "one", "category": "number", "type": "fingerspell"},
            "TWO": {"english": "two", "category": "number", "type": "fingerspell"},
            "THREE": {"english": "three", "category": "number", "type": "fingerspell"},
            "FOUR": {"english": "four", "category": "number", "type": "fingerspell"},
            "FIVE": {"english": "five", "category": "number", "type": "fingerspell"},
            
            # Ghana-specific terms
            "AKWAABA": {"english": "welcome", "category": "greeting", "type": "two_hands", "origin": "twi"},
            "MEDASI": {"english": "thank you", "category": "politeness", "type": "two_hands", "origin": "twi"},
            "MAAKYE": {"english": "good morning", "category": "greeting", "type": "single_hand", "origin": "twi"},
            "MAAHA": {"english": "good afternoon", "category": "greeting", "type": "single_hand", "origin": "twi"},
            "MAAJO": {"english": "good evening", "category": "greeting", "type": "single_hand", "origin": "twi"},
            
            # Common Ghanaian names and places
            "ACCRA": {"english": "Accra", "category": "place", "type": "fingerspell"},
            "KUMASI": {"english": "Kumasi", "category": "place", "type": "fingerspell"},
            "TAMALE": {"english": "Tamale", "category": "place", "type": "fingerspell"},
            "KOFI": {"english": "Kofi", "category": "name", "type": "fingerspell"},
            "AMA": {"english": "Ama", "category": "name", "type": "fingerspell"},
            "KWAME": {"english": "Kwame", "category": "name", "type": "fingerspell"},
        }
        
        # Create reverse mapping
        self.english_to_gsl = {}
        for gsl_sign, info in self.gsl_signs.items():
            english = info["english"].lower()
            if english not in self.english_to_gsl:
                self.english_to_gsl[english] = []
            self.english_to_gsl[english].append(gsl_sign)
        
        # Ghanaian English expressions and their GSL equivalents
        self.ghanian_expressions = {
            "how are you": ["HELLO", "HOW"],
            "i am fine": ["I", "FINE"],
            "what is your name": ["WHAT", "NAME"],
            "my name is": ["MY", "NAME"],
            "nice to meet you": ["NICE", "MEET"],
            "see you later": ["SEE", "LATER"],
            "have a good day": ["GOOD", "DAY"],
            "excuse me": ["EXCUSE"],
            "i don't understand": ["I", "DONT", "UNDERSTAND"],
            "please speak slowly": ["PLEASE", "SPEAK", "SLOW"],
            "can you help me": ["CAN", "YOU", "HELP"],
            "where is the bathroom": ["WHERE", "BATHROOM"],
            "how much does it cost": ["HOW", "MUCH", "COST"],
            "i want to buy": ["I", "WANT", "BUY"],
        }
        
        # Twi loanwords commonly used in Ghanaian English
        self.twi_loanwords = {
            "akwaaba": "AKWAABA",
            "medasi": "MEDASI",
            "maakye": "MAAKYE",
            "maaha": "MAAHA",
            "maajo": "MAAJO",
            "akwadaa": "CHILD",  # child
            "nana": "GRANDPARENT",  # grandparent/respectful title
            "aburokyiri": "ABROAD",  # abroad/overseas
            "sika": "MONEY",  # money
            "adaka": "BOX",  # box
            "akonnwa": "CHAIR",  # chair
        }

    def get_gsl_sign(self, english_word: str) -> List[str]:
        """Get GSL sign(s) for an English word"""
        english_word = english_word.lower()
        return self.english_to_gsl.get(english_word, [])

    def get_english_translation(self, gsl_sign: str) -> str:
        """Get English translation for a GSL sign"""
        gsl_sign = gsl_sign.upper()
        if gsl_sign in self.gsl_signs:
            return self.gsl_signs[gsl_sign]["english"]
        return "unknown"

    def process_ghanian_expression(self, text: str) -> List[str]:
        """Process Ghanaian English expressions into GSL signs"""
        text = text.lower()
        gsl_sequence = []
        
        # Check for known expressions
        for expression, signs in self.ghanian_expressions.items():
            if expression in text:
                gsl_sequence.extend(signs)
                # Remove the processed expression from text
                text = text.replace(expression, "")
        
        # Process remaining words
        words = text.split()
        for word in words:
            if word in self.twi_loanwords:
                gsl_sequence.append(self.twi_loanwords[word])
            else:
                gsl_signs = self.get_gsl_sign(word)
                if gsl_signs:
                    gsl_sequence.extend(gsl_signs)
                else:
                    # If no direct sign, try fingerspelling
                    gsl_sequence.append(f"FINGERSPELL_{word.upper()}")
        
        return gsl_sequence

class GSLGrammarRules:
    """Grammar rules for GSL-English translation"""
    
    def __init__(self):
        # GSL sentence structure rules
        self.gsl_sentence_structure = {
            "basic": "TOPIC-COMMENT",  # Topic first, then comment
            "question": "QUESTION_WORD-TOPIC-COMMENT",
            "negative": "TOPIC-NEGATION-COMMENT",
            "emphasis": "EMPHASIS-TOPIC-COMMENT"
        }
        
        # English to GSL word order transformations
        self.word_order_rules = {
            "adjective_noun": "noun_adjective",  # "red car" -> "CAR RED"
            "possessive": "possessor_possessed",  # "my book" -> "BOOK MY"
            "question_auxiliary": "question_word_verb",  # "Do you want?" -> "WANT YOU?"
            "time_expression": "time_verb",  # "I go tomorrow" -> "TOMORROW I GO"
        }
        
        # Non-manual markers (facial expressions) mapping
        self.non_manual_markers = {
            "question": "eyebrows_raised",
            "negative": "head_shake",
            "emphasis": "head_nod",
            "conditional": "eyebrows_raised_head_tilt",
            "relative_clause": "eyebrows_raised"
        }

    def apply_gsl_grammar(self, english_sentence: str, gsl_signs: List[str]) -> List[str]:
        """Apply GSL grammar rules to English sentence"""
        # Convert to uppercase for processing
        gsl_signs = [sign.upper() for sign in gsl_signs]
        
        # Detect sentence type
        sentence_type = self._detect_sentence_type(english_sentence)
        
        # Apply appropriate word order
        if sentence_type == "question":
            gsl_signs = self._reorder_for_question(gsl_signs, english_sentence)
        elif sentence_type == "negative":
            gsl_signs = self._reorder_for_negative(gsl_signs)
        elif sentence_type == "emphasis":
            gsl_signs = self._reorder_for_emphasis(gsl_signs)
        
        return gsl_signs

    def _detect_sentence_type(self, sentence: str) -> str:
        """Detect sentence type for grammar application"""
        sentence = sentence.lower().strip()
        
        # Question detection
        if any(q_word in sentence for q_word in ["who", "what", "where", "when", "why", "how"]):
            return "question"
        elif sentence.endswith("?"):
            return "question"
        
        # Negative detection
        if any(neg_word in sentence for neg_word in ["not", "no", "don't", "doesn't", "can't", "won't"]):
            return "negative"
        
        # Emphasis detection
        if any(emph_word in sentence for emph_word in ["very", "really", "extremely", "absolutely"]):
            return "emphasis"
        
        return "basic"

    def _reorder_for_question(self, gsl_signs: List[str], english_sentence: str) -> List[str]:
        """Reorder signs for question structure"""
        question_words = ["WHO", "WHAT", "WHERE", "WHEN", "WHY", "HOW"]
        
        # Find question word
        question_word = None
        for word in gsl_signs:
            if word in question_words:
                question_word = word
                break
        
        if question_word:
            # Move question word to beginning
            gsl_signs.remove(question_word)
            gsl_signs.insert(0, question_word)
        
        return gsl_signs

    def _reorder_for_negative(self, gsl_signs: List[str]) -> List[str]:
        """Reorder signs for negative structure"""
        # Add negation sign after topic
        if len(gsl_signs) > 1:
            gsl_signs.insert(1, "NOT")
        
        return gsl_signs

    def _reorder_for_emphasis(self, gsl_signs: List[str]) -> List[str]:
        """Reorder signs for emphasis structure"""
        # Move emphasized word to beginning
        if len(gsl_signs) > 1:
            # Simple heuristic: emphasize the main verb or adjective
            emphasized_sign = gsl_signs[-1]  # Last word is often the main point
            gsl_signs.remove(emphasized_sign)
            gsl_signs.insert(0, emphasized_sign)
        
        return gsl_signs

import logging
import time
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

class GSLTranslationEngine:
    """
    Optimized GSL Translation Engine for Render Free Tier.
    Uses rule-based translation to avoid heavy transformer models in RAM.
    """
    def __init__(self, config=None):
        self.config = config
        self.is_loaded = True
        logger.info("GSLTranslationEngine (Rule-based Optimized) initialized")

    async def translate(self, gsl_sequence: List[str], target_lang: str = "en") -> Dict[str, Any]:
        """Translate GSL to English using rule-based backend"""
        start_time = time.time()
        try:
            # Import to_english lazily
            from backend.nlp.gsl_to_en import to_english
            english_text = to_english(gsl_sequence)
            
            return {
                "translation": english_text,
                "confidence": 0.85,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }
        except Exception as e:
            logger.error(f"Translation engine error: {e}")
            return {"translation": "", "error": str(e)}

    def load_model(self):
        """No-op for Render Free Tier"""
        pass

class GSLTranslationService:
    """Service for GSL-English translation with grammar rules"""
    
    def __init__(self, config: Optional[TranslationConfig] = None):
        self.config = config or TranslationConfig()
        self.vocabulary = GSLVocabulary()
        self.grammar_rules = GSLGrammarRules()
        
        # Neural translation model
        self.model = GSLTranslationEngine(self.config)
        self.optimizer = torch.optim.AdamW(self.model.parameters(), lr=self.config.learning_rate)
        self.criterion = nn.CrossEntropyLoss(ignore_index=0)  # 0 is padding token
        
        # Load model if exists
        self.model_path = Path("models/gsl_translation_model.pth")
        if self.model_path.exists():
            self.load_model()
        
        logger.info("GSLTranslationService initialized")

    def translate_gsl_to_english(self, gsl_signs: List[str], use_neural: bool = True) -> Dict[str, Any]:
        """Translate GSL signs to English"""
        try:
            if use_neural and len(gsl_signs) > 0:
                return self._neural_translate_gsl_to_english(gsl_signs)
            else:
                return self._rule_based_translate_gsl_to_english(gsl_signs)
                
        except Exception as e:
            logger.error(f"Error translating GSL to English: {e}")
            return {
                "success": False,
                "english_text": "",
                "confidence": 0.0,
                "error": str(e),
                "method": "error"
            }

    def translate_english_to_gsl(self, english_text: str, use_neural: bool = True) -> Dict[str, Any]:
        """Translate English text to GSL signs"""
        try:
            if use_neural and english_text.strip():
                return self._neural_translate_english_to_gsl(english_text)
            else:
                return self._rule_based_translate_english_to_gsl(english_text)
                
        except Exception as e:
            logger.error(f"Error translating English to GSL: {e}")
            return {
                "success": False,
                "gsl_signs": [],
                "confidence": 0.0,
                "error": str(e),
                "method": "error"
            }

    def _rule_based_translate_gsl_to_english(self, gsl_signs: List[str]) -> Dict[str, Any]:
        """Rule-based translation from GSL to English"""
        try:
            english_words = []
            
            for sign in gsl_signs:
                # Handle fingerspelling
                if sign.startswith("FINGERSPELL_"):
                    word = sign.replace("FINGERSPELL_", "").lower()
                    english_words.append(word)
                else:
                    # Get English translation
                    translation = self.vocabulary.get_english_translation(sign)
                    if translation != "unknown":
                        english_words.append(translation)
                    else:
                        english_words.append(f"[{sign}]")  # Unknown sign marker
            
            # Basic grammar reconstruction
            english_text = " ".join(english_words)
            english_text = self._capitalize_sentences(english_text)
            
            return {
                "success": True,
                "english_text": english_text,
                "confidence": 0.7,  # Rule-based confidence
                "gsl_signs": gsl_signs,
                "method": "rule_based"
            }
            
        except Exception as e:
            logger.error(f"Error in rule-based GSL to English translation: {e}")
            raise e

    def _rule_based_translate_english_to_gsl(self, english_text: str) -> Dict[str, Any]:
        """Rule-based translation from English to GSL"""
        try:
            # Process Ghanaian expressions first
            gsl_sequence = self.vocabulary.process_ghanian_expression(english_text)
            
            # Apply GSL grammar rules
            gsl_sequence = self.grammar_rules.apply_gsl_grammar(english_text, gsl_sequence)
            
            return {
                "success": True,
                "gsl_signs": gsl_sequence,
                "confidence": 0.7,  # Rule-based confidence
                "english_text": english_text,
                "method": "rule_based"
            }
            
        except Exception as e:
            logger.error(f"Error in rule-based English to GSL translation: {e}")
            raise e

    def _neural_translate_gsl_to_english(self, gsl_signs: List[str]) -> Dict[str, Any]:
        """Neural translation from GSL to English"""
        try:
            # Convert GSL signs to token IDs
            gsl_tokens = self._gsl_signs_to_tokens(gsl_signs)
            
            if not gsl_tokens:
                return self._rule_based_translate_gsl_to_english(gsl_signs)
            
            # Create input tensors
            gsl_tensor = torch.tensor([gsl_tokens], dtype=torch.long).to(self.config.device)
            
            # Generate English text using beam search
            english_tokens = self._generate_english_text(gsl_tensor)
            
            # Convert tokens to text
            english_text = self._tokens_to_english_text(english_tokens)
            
            return {
                "success": True,
                "english_text": english_text,
                "confidence": 0.85,  # Neural confidence
                "gsl_signs": gsl_signs,
                "method": "neural"
            }
            
        except Exception as e:
            logger.error(f"Error in neural GSL to English translation: {e}")
            # Fallback to rule-based
            return self._rule_based_translate_gsl_to_english(gsl_signs)

    def _neural_translate_english_to_gsl(self, english_text: str) -> Dict[str, Any]:
        """Neural translation from English to GSL"""
        try:
            # Convert English text to token IDs
            english_tokens = self._english_text_to_tokens(english_text)
            
            if not english_tokens:
                return self._rule_based_translate_english_to_gsl(english_text)
            
            # Create input tensors
            english_tensor = torch.tensor([english_tokens], dtype=torch.long).to(self.config.device)
            
            # Generate GSL signs using beam search
            gsl_tokens = self._generate_gsl_sequence(english_tensor)
            
            # Convert tokens to GSL signs
            gsl_signs = self._tokens_to_gsl_signs(gsl_tokens)
            
            return {
                "success": True,
                "gsl_signs": gsl_signs,
                "confidence": 0.85,  # Neural confidence
                "english_text": english_text,
                "method": "neural"
            }
            
        except Exception as e:
            logger.error(f"Error in neural English to GSL translation: {e}")
            # Fallback to rule-based
            return self._rule_based_translate_english_to_gsl(english_text)

    def _gsl_signs_to_tokens(self, gsl_signs: List[str]) -> List[int]:
        """Convert GSL signs to token IDs"""
        tokens = []
        vocab = self.vocabulary.gsl_signs
        
        for sign in gsl_signs:
            sign_upper = sign.upper()
            if sign_upper in vocab:
                # Map to token ID (simple hash-based mapping for now)
                token_id = hash(sign_upper) % self.config.gsl_vocab_size
                tokens.append(token_id)
        
        return tokens[:self.config.max_sequence_length]

    def _tokens_to_gsl_signs(self, tokens: List[int]) -> List[str]:
        """Convert token IDs to GSL signs"""
        # For now, use rule-based mapping as fallback
        # In a real implementation, this would use a learned mapping
        return []

    def _english_text_to_tokens(self, text: str) -> List[int]:
        """Convert English text to token IDs"""
        # Simple word-based tokenization for now
        words = text.lower().split()
        tokens = []
        
        for word in words:
            # Simple hash-based tokenization
            token_id = hash(word) % self.config.vocab_size
            tokens.append(token_id)
        
        return tokens[:self.config.max_sequence_length]

    def _tokens_to_english_text(self, tokens: List[int]) -> str:
        """Convert token IDs to English text"""
        # For now, return placeholder
        # In a real implementation, this would use a vocabulary mapping
        return " ".join([f"word_{token}" for token in tokens])

    def _generate_english_text(self, gsl_tensor: torch.Tensor) -> List[int]:
        """Generate English text from GSL tensor"""
        # Simplified generation - in practice, this would use beam search
        # For now, return empty list as placeholder
        return []

    def _generate_gsl_sequence(self, english_tensor: torch.Tensor) -> List[int]:
        """Generate GSL sequence from English tensor"""
        # Simplified generation - in practice, this would use beam search
        # For now, return empty list as placeholder
        return []

    def _capitalize_sentences(self, text: str) -> str:
        """Capitalize sentences properly"""
        sentences = re.split(r'[.!?]+', text)
        capitalized = []
        
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence:
                capitalized.append(sentence[0].upper() + sentence[1:])
        
        return '. '.join(capitalized)

    def train_step(self, gsl_sequences: torch.Tensor, english_tokens: torch.Tensor, 
                   target_tokens: torch.Tensor) -> float:
        """Perform a single training step"""
        try:
            self.model.train()
            self.optimizer.zero_grad()
            
            # Forward pass
            output = self.model(gsl_sequences, english_tokens)
            
            # Calculate loss
            loss = self.criterion(output.view(-1, output.size(-1)), target_tokens.view(-1))
            
            # Backward pass
            loss.backward()
            self.optimizer.step()
            
            return loss.item()
            
        except Exception as e:
            logger.error(f"Error in training step: {e}")
            return 0.0

    def save_model(self, path: Optional[str] = None):
        """Save model weights"""
        try:
            save_path = path or self.model_path
            save_path.parent.mkdir(parents=True, exist_ok=True)
            
            torch.save({
                'model_state_dict': self.model.state_dict(),
                'optimizer_state_dict': self.optimizer.state_dict(),
                'config': self.config,
                'vocabulary': self.vocabulary.gsl_signs,
                'timestamp': datetime.now().isoformat()
            }, save_path)
            
            logger.info(f"Translation model saved to {save_path}")
            
        except Exception as e:
            logger.error(f"Error saving model: {e}")

    def load_model(self, path: Optional[str] = None):
        """Load model weights"""
        try:
            load_path = path or self.model_path
            
            if not load_path.exists():
                logger.warning(f"Translation model file not found: {load_path}")
                return
            
            checkpoint = torch.load(load_path, map_location=self.config.device)
            self.model.load_state_dict(checkpoint['model_state_dict'])
            self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
            
            if 'vocabulary' in checkpoint:
                self.vocabulary.gsl_signs.update(checkpoint['vocabulary'])
            
            logger.info(f"Translation model loaded from {load_path}")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")

    def get_translation_info(self) -> Dict[str, Any]:
        """Get translation service information"""
        return {
            "service_type": "GSL-English Translation",
            "model_parameters": sum(p.numel() for p in self.model.parameters()),
            "gsl_vocabulary_size": len(self.vocabulary.gsl_signs),
            "english_vocabulary_size": self.config.vocab_size,
            "supports_ghanian_english": self.config.support_ghanian_english,
            "supports_twi_loanwords": self.config.support_twi_loanwords,
            "supports_local_expressions": self.config.support_local_expressions,
            "model_path": str(self.model_path)
        }

# Global service instance
_translation_service = None

def get_gsl_translation_service() -> GSLTranslationService:
    """Get or create the global GSL translation service instance"""
    global _translation_service
    if _translation_service is None:
        _translation_service = GSLTranslationService()
    return _translation_service