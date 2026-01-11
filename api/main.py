from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import json
import base64
import numpy as np
from datetime import datetime
import uuid
import logging
import os

from .services.gsl_dictionary_service import GSLDictionaryService
from .services.mediapipe_service import MediaPipeService
from .services.translation_service import TranslationService
from .services.avatar_service import AvatarService
from .services.speech_recognition_service import SpeechRecognitionService, SpeechRecognitionConfig
from backend.sign_recognition.baseline import classify
from pathlib import Path
from .database.models import TranslationSession, TranslationEvent
from .database.database import SessionLocal, init_db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Ghana Sign Language Interpreter API",
    description="Real-time bidirectional Sign Language ↔ Speech Interpreter for Ghana Sign Language",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
dictionary_service = GSLDictionaryService()
mediapipe_service = MediaPipeService()
from .services.translation_service import TranslationConfig
translation_service = TranslationService(TranslationConfig())
avatar_service = AvatarService()
speech_service = SpeechRecognitionService(SpeechRecognitionConfig(device="cpu", language="en", fp16=False, chunk_duration=2.0, overlap_duration=0.5))
_audio_buffers: Dict[str, Any] = {}

# WebSocket connection managers
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.session_data: Dict[str, Any] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.session_data[session_id] = {
            "websocket": websocket,
            "start_time": datetime.now(),
            "event_count": 0
        }
        logger.info(f"WebSocket connected for session: {session_id}")

    def disconnect(self, session_id: str):
        if session_id in self.session_data:
            del self.session_data[session_id]
            logger.info(f"WebSocket disconnected for session: {session_id}")

    async def send_personal_message(self, message: str, session_id: str):
        if session_id in self.session_data:
            websocket = self.session_data[session_id]["websocket"]
            await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

COLLECT_SAMPLES = os.getenv("COLLECT_SAMPLES", "false").lower() == "true"
if COLLECT_SAMPLES:
    logger.info("Sample collection enabled")
else:
    logger.info("Sample collection disabled")

_collection_buffers: Dict[str, Any] = {}

def _save_sample(name: str, payload: Dict[str, Any]):
    try:
        out_dir = Path("data")/"processed"/"samples"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{name}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"Failed to save sample: {e}")

def _load_prototypes() -> Dict[str, List[List[float]]]:
    try:
        proto = Path("ml")/"datasets"/"artifacts"/"prototypes.json"
        if proto.exists():
            with open(proto, "r", encoding="utf-8") as f:
                labeled = json.load(f)
            return labeled
        art = Path("ml")/"datasets"/"artifacts"/"sequences.json"
        if art.exists():
            with open(art, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {k: v for k, v in data.items()}
    except Exception as e:
        logger.warning(f"Failed to load prototypes: {e}")
    return {}

_PROTOTYPES = _load_prototypes()

# Pydantic models
class TranslationRequest(BaseModel):
    data: str
    session_id: str
    timestamp: int

class SignToSpeechRequest(BaseModel):
    pose_sequence: List[Dict[str, Any]]
    context: Optional[str] = ""
    session_id: str

class SpeechToSignRequest(BaseModel):
    text: str
    session_id: str
    speed: Optional[float] = 1.0

class AvatarRequest(BaseModel):
    gsl_sequence: List[str]
    animation_mode: str = "3d_avatar"
    speed: float = 1.0
    facial_expressions: bool = True

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info("Database initialized")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# WebSocket endpoint for video streaming
@app.websocket("/api/video/stream")
async def video_stream(websocket: WebSocket):
    session_id = str(uuid.uuid4())
    await manager.connect(websocket, session_id)
    if COLLECT_SAMPLES:
        _collection_buffers[session_id] = {
            "frames": [],
            "start_time": datetime.now().timestamp(),
            "predicted_gloss": None,
            "confidence": 0.0,
            "last_ts": None,
            "count": 0,
        }
        logger.info(f"Collection started for session: {session_id}")
    
    try:
        while True:
            # Receive video frame data
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "video_frame":
                # Decode base64 frame
                frame_data = base64.b64decode(message["data"])
                
                # Process frame with MediaPipe
                pose_data = await mediapipe_service.process_frame(frame_data)
                
                # Baseline classification (pose-only)
                pose_lms = pose_data.get("landmarks", {}).get("pose")
                predicted_gloss = None
                predicted_confidence = 0.0
                if isinstance(pose_lms, dict):
                    pose_list = pose_lms.get("landmarks", [])
                else:
                    pose_list = pose_lms or []
                seq: List[List[float]] = []
                for lm in pose_list:
                    if isinstance(lm, dict):
                        seq.append([lm.get("x",0), lm.get("y",0), lm.get("z",0)])
                    elif isinstance(lm, (list, tuple)) and len(lm) >= 3:
                        seq.append([lm[0], lm[1], lm[2]])
                if _PROTOTYPES:
                    try:
                        g, score = classify({"pose": seq}, _PROTOTYPES)
                        predicted_gloss = g
                        predicted_confidence = float(max(0.0, score))
                    except Exception as e:
                        logger.warning(f"Baseline classify failed: {e}")

                # Send pose + baseline result back to client
                response = {
                    "type": "pose_data",
                    "landmarks": pose_data["landmarks"],
                    "confidence": pose_data["confidence"],
                    "timestamp": message["timestamp"],
                    "session_id": session_id,
                    "predicted_gloss": predicted_gloss,
                    "predicted_confidence": predicted_confidence
                }

                await manager.send_personal_message(json.dumps(response), session_id)
                
                # Log translation event
                db = SessionLocal()
                event = TranslationEvent(
                    session_id=session_id,
                    input_type="video_frame",
                    input_data={"resolution": message.get("resolution", {})},
                    output_data=pose_data,
                    confidence=pose_data["confidence"],
                    processing_time_ms=pose_data.get("processing_time_ms", 0)
                )
                db.add(event)
                db.commit()
                db.close()
                if COLLECT_SAMPLES:
                    buf = _collection_buffers.get(session_id)
                    if buf is not None:
                        buf["frames"].append({
                            "hands": pose_data.get("landmarks", {}).get("hands", []),
                            "pose": seq,
                            "face": pose_data.get("landmarks", {}).get("face", []),
                        })
                        buf["predicted_gloss"] = predicted_gloss
                        buf["confidence"] = predicted_confidence
                        buf["last_ts"] = message["timestamp"]
                        buf["count"] += 1
                
    except WebSocketDisconnect:
        manager.disconnect(session_id)
        if COLLECT_SAMPLES:
            buf = _collection_buffers.pop(session_id, None)
            if buf:
                end_time = datetime.now().timestamp()
                start_time = buf["start_time"]
                duration = max(0.001, end_time - start_time)
                fps = buf["count"] / duration
                sample = {
                    "frames": buf["frames"],
                    "start_time": start_time,
                    "end_time": end_time,
                    "fps": fps,
                    "predicted_gloss": buf["predicted_gloss"],
                    "confidence": buf["confidence"],
                }
                _save_sample(f"session_{session_id}_{int(end_time*1000)}", sample)
                logger.info(f"Sample saved for session: {session_id} frames={buf['count']} fps={fps:.2f}")
    except Exception as e:
        logger.error(f"Error in video stream: {str(e)}")
        await manager.send_personal_message(json.dumps({"error": str(e)}), session_id)

# WebSocket endpoint for audio streaming
@app.websocket("/api/audio/stream")
async def audio_stream(websocket: WebSocket):
    session_id = str(uuid.uuid4())
    await manager.connect(websocket, session_id)
    
    try:
        while True:
            # Receive audio data
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "audio_chunk":
                # Decode Float32 base64 buffer
                raw = base64.b64decode(message["data"])  
                import numpy as np
                audio = np.frombuffer(raw, dtype=np.float32)
                # Buffer audio and transcribe when chunk ready
                buf = _audio_buffers.get(session_id)
                if buf is None:
                    _audio_buffers[session_id] = []
                    buf = _audio_buffers[session_id]
                buf.extend(audio.tolist())
                chunk_size = int(speech_service.chunk_size) if hasattr(speech_service, 'chunk_size') else 32000
                overlap = int(speech_service.overlap_size) if hasattr(speech_service, 'overlap_size') else int(0.5 * 16000)
                response = None
                if len(buf) >= chunk_size:
                    chunk = np.array(buf[:chunk_size], dtype=np.float32)
                    # keep overlap
                    _audio_buffers[session_id] = buf[chunk_size - overlap:]
                    try:
                        result = await speech_service.transcribe_audio_chunk(chunk)
                        response = {
                            "type": "transcription",
                            "text": result.get("text", ""),
                            "confidence": result.get("confidence", 0.0),
                            "timestamp": message["timestamp"],
                            "session_id": session_id
                        }
                    except Exception as e:
                        response = {
                            "type": "transcription",
                            "text": "",
                            "confidence": 0.0,
                            "error": str(e),
                            "timestamp": message["timestamp"],
                            "session_id": session_id
                        }
                
                if response:
                    await manager.send_personal_message(json.dumps(response), session_id)
                
    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception as e:
        logger.error(f"Error in audio stream: {str(e)}")
        await manager.send_personal_message(json.dumps({"error": str(e)}), session_id)

# Sign to speech translation endpoint
@app.post("/api/translate/sign-to-speech")
async def translate_sign_to_speech(request: SignToSpeechRequest):
    try:
        # Process pose sequence with sign recognition
        translation = await translation_service.translate_sign_to_speech(
            request.pose_sequence, 
            request.context
        )
        
        # Log translation event
        db = SessionLocal()
        event = TranslationEvent(
            session_id=request.session_id,
            input_type="sign_sequence",
            input_data={"pose_count": len(request.pose_sequence)},
            output_data=translation,
            confidence=translation["confidence"],
            processing_time_ms=translation.get("processing_time_ms", 0)
        )
        db.add(event)
        db.commit()
        db.close()
        
        return translation
        
    except Exception as e:
        logger.error(f"Error in sign-to-speech translation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Speech to sign translation endpoint
@app.post("/api/translate/speech-to-sign")
async def translate_speech_to_sign(request: SpeechToSignRequest):
    try:
        # Process text with speech-to-sign translation
        translation = await translation_service.translate_speech_to_sign(
            request.text,
            request.speed
        )
        
        # Log translation event
        db = SessionLocal()
        event = TranslationEvent(
            session_id=request.session_id,
            input_type="speech_text",
            input_data={"text": request.text},
            output_data=translation,
            confidence=translation["confidence"],
            processing_time_ms=translation.get("processing_time_ms", 0)
        )
        db.add(event)
        db.commit()
        db.close()
        
        return translation
        
    except Exception as e:
        logger.error(f"Error in speech-to-sign translation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Avatar rendering endpoint
@app.post("/api/avatar/render")
async def render_avatar(request: AvatarRequest):
    try:
        # Generate avatar animation data
        animation_data = await avatar_service.render_avatar(
            request.gsl_sequence,
            request.animation_mode,
            request.speed,
            request.facial_expressions
        )
        
        return animation_data
        
    except Exception as e:
        logger.error(f"Error in avatar rendering: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# GSL dictionary endpoint
@app.get("/api/dictionary/search")
async def search_dictionary(query: str, limit: int = 10):
    try:
        results = await dictionary_service.search_signs(query, limit)
        return {"results": results, "count": len(results)}
        
    except Exception as e:
        logger.error(f"Error searching dictionary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dictionary/sign/{sign_id}")
async def get_sign_details(sign_id: str):
    try:
        sign = await dictionary_service.get_sign_by_id(sign_id)
        if not sign:
            raise HTTPException(status_code=404, detail="Sign not found")
        return sign
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sign details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Translation session management
@app.post("/api/session/start")
async def start_translation_session(direction: str = "sign_to_speech"):
    try:
        session_id = str(uuid.uuid4())
        
        db = SessionLocal()
        session = TranslationSession(
            id=session_id,
            direction=direction,
            start_time=datetime.now()
        )
        db.add(session)
        db.commit()
        db.close()
        
        return {"session_id": session_id, "direction": direction}
        
    except Exception as e:
        logger.error(f"Error starting translation session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/session/end/{session_id}")
async def end_translation_session(session_id: str):
    try:
        db = SessionLocal()
        session = db.query(TranslationSession).filter(TranslationSession.id == session_id).first()
        
        if not session:
            db.close()
            raise HTTPException(status_code=404, detail="Session not found")
        
        session.end_time = datetime.now()
        
        # Calculate average confidence
        events = db.query(TranslationEvent).filter(TranslationEvent.session_id == session_id).all()
        if events:
            session.avg_confidence = sum(e.confidence for e in events if e.confidence) / len(events)
            session.total_events = len(events)
        
        db.commit()
        db.close()
        
        return {"status": "ended", "session_id": session_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ending translation session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
