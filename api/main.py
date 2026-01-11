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

from services.gsl_dictionary_service import GSLDictionaryService
from services.mediapipe_service import MediaPipeService
from services.translation_service import TranslationService
from services.avatar_service import AvatarService
from database.models import TranslationSession, TranslationEvent
from database.database import SessionLocal, init_db

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
translation_service = TranslationService()
avatar_service = AvatarService()

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
                
                # Send pose data back to client
                response = {
                    "type": "pose_data",
                    "landmarks": pose_data["landmarks"],
                    "confidence": pose_data["confidence"],
                    "timestamp": message["timestamp"],
                    "session_id": session_id
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
                
    except WebSocketDisconnect:
        manager.disconnect(session_id)
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
                # Process audio with Whisper
                audio_data = base64.b64decode(message["data"])
                
                # Placeholder for Whisper processing
                transcription = {
                    "text": "Hello, how are you?",
                    "confidence": 0.95,
                    "language": "en"
                }
                
                response = {
                    "type": "transcription",
                    "text": transcription["text"],
                    "confidence": transcription["confidence"],
                    "timestamp": message["timestamp"],
                    "session_id": session_id
                }
                
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