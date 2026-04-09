import logging
import time
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

class SignRecognitionService:
    """
    Optimized Sign Recognition Service for Render Free Tier.
    This service now relies on landmarks pre-processed on the FRONTEND
    and uses a lightweight rule-based or small-model matching logic
    instead of a heavy 3D CNN or LSTM on the backend.
    """
    def __init__(self, config=None):
        self.config = config
        self.is_loaded = True
        logger.info("SignRecognitionService (Lightweight Mode) initialized")

    async def recognize_sign(self, landmarks_sequence: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Recognize sign from a sequence of landmarks using lightweight matching.
        Expects landmarks from frontend MediaPipe.
        """
        if not landmarks_sequence:
            return {"sign": None, "confidence": 0.0}

        try:
            # For Render Free Tier, we use a simple distance-based matcher
            # or a very small pre-loaded prototype set.
            from backend.sign_matching.dictionary_matcher import match_sequence
            result = match_sequence(landmarks_sequence)
            
            return {
                "sign": result.get("sign"),
                "confidence": result.get("confidence", 0.0),
                "timestamp": time.time()
            }
        except Exception as e:
            logger.error(f"Error in sign recognition: {e}")
            return {"sign": None, "confidence": 0.0, "error": str(e)}

    def load_model(self):
        """No-op: neural model disabled to save RAM"""
        pass
