import logging
import time
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

from backend.sign_recognition.fast_gsl_tflite import FastGSLSignRecognizer

class SignRecognitionService:
    """
    Optimized Sign Recognition Service with TFLite and DTW fallback.
    """
    def __init__(self, config=None):
        self.config = config
        self.is_loaded = True
        # Load TFLite model and label map if available
        try:
            model_path = getattr(config, 'tflite_model_path', 'gsl_signs.tflite')
            label_map = getattr(config, 'label_map', [])
            self.tflite_recognizer = FastGSLSignRecognizer(model_path, label_map)
            logger.info("TFLite GSL recognizer loaded.")
        except Exception as e:
            self.tflite_recognizer = None
            logger.warning(f"TFLite recognizer not loaded: {e}")
        logger.info("SignRecognitionService (TFLite+DTW) initialized")

    async def recognize_sign(self, landmarks_sequence: List[Any]) -> Dict[str, Any]:
        if not landmarks_sequence:
            return {"sign": None, "confidence": 0.0}

        # Try TFLite recognizer first
        if self.tflite_recognizer:
            try:
                gloss, confidence = self.tflite_recognizer.predict(landmarks_sequence)
                return {
                    "sign": gloss,
                    "confidence": confidence,
                    "timestamp": time.time(),
                    "method": "tflite"
                }
            except Exception as e:
                logger.warning(f"TFLite recognition failed: {e}")

        # Fallback: DTW matcher
        try:
            from backend.sign_matching.dictionary_matcher import match_sequence
            result = match_sequence(landmarks_sequence)
            return {
                "sign": result.get("sign"),
                "confidence": result.get("confidence", 0.0),
                "timestamp": time.time(),
                "method": "dtw"
            }
        except Exception as e:
            logger.error(f"Error in sign recognition: {e}")
            return {"sign": None, "confidence": 0.0, "error": str(e)}

    def load_model(self):
        pass
