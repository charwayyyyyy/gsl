import os
import httpx
import base64
import json
import logging
import numpy as np
from typing import Optional, Dict, List, AsyncGenerator
import asyncio
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class SpeechRecognitionConfig:
    """Configuration for speech recognition service"""
    model_name: str = "base"  # Placeholder, not used in API mode
    language: str = "en"
    api_key: Optional[str] = os.getenv("GEMINI_API_KEY")
    api_url: str = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

class SpeechRecognitionService:
    """Service for speech recognition using External API (Gemini 1.5 Flash)"""
    
    def __init__(self, config: SpeechRecognitionConfig):
        self.config = config
        self.is_loaded = True # API service is always "loaded"
        self.current_transcription = ""
        logger.info("SpeechRecognitionService (API Mode) initialized")
    
    async def load_model(self):
        """No-op for API mode"""
        pass
    
    def unload_model(self):
        """No-op for API mode"""
        pass

    async def transcribe_audio_chunk(self, audio_bytes: bytes) -> Dict:
        """Transcribe audio using Gemini 1.5 Flash API (highly efficient)"""
        if not self.config.api_key:
            return {"error": "GEMINI_API_KEY not configured", "text": "", "confidence": 0.0}

        try:
            # Gemini 1.5 Flash can handle audio directly
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            
            payload = {
                "contents": [{
                    "parts": [
                        {"text": "Transcribe this audio exactly as heard. If no speech, return an empty string."},
                        {
                            "inline_data": {
                                "mime_type": "audio/wav",
                                "data": audio_base64
                            }
                        }
                    ]
                }]
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.config.api_url,
                    headers={"x-goog-api-key": self.config.api_key},
                    json=payload,
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    logger.error(f"API Error: {response.text}")
                    return {"text": "", "confidence": 0.0, "error": "API Failure"}

                result = response.json()
                text = result['candidates'][0]['content']['parts'][0]['text'].strip()
                
                return {
                    'text': text,
                    'confidence': 1.0, # API doesn't always provide confidence per word
                    'has_speech': len(text) > 0,
                    'timestamp': time.time()
                }
                
        except Exception as e:
            logger.error(f"Error transcribing audio chunk via API: {e}")
            return {'text': '', 'confidence': 0.0, 'error': str(e), 'timestamp': time.time()}

class WhisperSpeechRecognitionService(SpeechRecognitionService):
    """Compatibility layer for legacy Whisper calls, now using API"""
    def __init__(self, config: Optional[SpeechRecognitionConfig] = None):
        super().__init__(config or SpeechRecognitionConfig())

    async def transcribe_audio(self, audio_data: np.ndarray, sample_rate: int = 16000) -> Dict:
        # Convert numpy to wav bytes for API
        import io
        import wave
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes((audio_data * 32767).astype(np.int16).tobytes())
        return await self.transcribe_audio_chunk(buf.getvalue())

