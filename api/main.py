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
from backend.dictionary.text_to_sign import TextToSignService
from backend.sign_matching.dictionary_matcher import DictionaryMatcher
try:
    from scripts.extract_gsl_dictionary import pdf_to_strict_json as parse_pdf
except Exception:
    parse_pdf = None
try:
    from scripts.build_dictionary_sign_embeddings import main as build_sign_index
except Exception:
    build_sign_index = None
try:
    from scripts.build_motion_templates import main as build_motion_templates
except Exception:
    build_motion_templates = None
from .services.mediapipe_service import MediaPipeService
from .services.translation_service import TranslationService
from .services.avatar_service import AvatarService
from .services.speech_recognition_service import SpeechRecognitionService, SpeechRecognitionConfig
from backend.sign_recognition.baseline import classify
from pathlib import Path
from .database.models import TranslationSession, TranslationEvent, AnalyticsEvent, FeedbackReport
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
text_to_sign_service = TextToSignService()
dict_matcher = DictionaryMatcher()
mediapipe_service = MediaPipeService()
from .services.translation_service import TranslationConfig
translation_service = TranslationService(TranslationConfig())
avatar_service = AvatarService()
speech_service = SpeechRecognitionService(SpeechRecognitionConfig(device="cpu", language="en", fp16=False, chunk_duration=2.0, overlap_duration=0.5))
_audio_buffers: Dict[str, Any] = {}

# Serve extracted dictionary images
try:
    app.mount("/static", StaticFiles(directory=str(Path("data")/"processed"/"images")), name="static")
except Exception:
    pass

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

class AnalyticsEventRequest(BaseModel):
    event_type: str
    data: Dict[str, Any]
    session_id: Optional[str] = None

class FeedbackRequest(BaseModel):
    gloss: str
    reason: Optional[str] = None

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info("Database initialized")
    try:
      proc = Path("data")/"processed"
      proc.mkdir(parents=True, exist_ok=True)
      dict_path = proc/"gsl_dictionary.json"
      if not dict_path.exists():
        src_pdf = Path("Ghanaian Sign Language Dictionary - 3rd Edition.pdf")
        raw_pdf = Path("data")/"raw"/"gsl_dictionary.pdf"
        if parse_pdf and src_pdf.exists():
          try:
            data = parse_pdf(src_pdf)
            with open(dict_path, "w", encoding="utf-8") as f:
              json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info(f"Dictionary extracted: {len(data)} entries")
          except Exception as e:
            logger.warning(f"Parse failed for src_pdf: {e}")
        elif parse_pdf and raw_pdf.exists():
          try:
            data = parse_pdf(raw_pdf)
            with open(dict_path, "w", encoding="utf-8") as f:
              json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info("Dictionary extracted from data/raw")
          except Exception as e:
            logger.warning(f"Parse failed for raw_pdf: {e}")
        else:
          with open(dict_path, "w", encoding="utf-8") as f:
            json.dump({}, f, ensure_ascii=False, indent=2)
          logger.warning("No PDF found; wrote empty dictionary")
      else:
        try:
          with open(dict_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
          if isinstance(existing, dict) and "entries" in existing and isinstance(existing["entries"], list):
            migrated = {}
            for e in existing["entries"]:
              g = e.get("gloss")
              if g:
                migrated[g] = {
                  "english": (e.get("english") or "").lower(),
                  "description": (e.get("usage") or ""),
                  "images": [e.get("image_path")] if e.get("image_path") else [],
                  "page": e.get("source_page")
                }
            with open(dict_path, "w", encoding="utf-8") as f:
              json.dump(migrated, f, ensure_ascii=False, indent=2)
            logger.info(f"Migrated legacy dictionary schema: {len(migrated)} entries")
        except Exception as e:
          logger.warning(f"Dictionary migration failed: {e}")
      # Fallback: seed from data/gsl_json if dictionary empty
      try:
        with open(dict_path, "r", encoding="utf-8") as f:
          data_now = json.load(f)
        if isinstance(data_now, dict) and len(data_now) == 0:
          seed_path = Path("data")/"gsl_json"/"gsl_dict_entries_001.json"
          if seed_path.exists():
            with open(seed_path, "r", encoding="utf-8") as sf:
              seed = json.load(sf)
            migrated = {}
            for e in seed.get("entries", []):
              g = e.get("gloss")
              if g:
                migrated[g] = {
                  "english": (e.get("english_meaning") or "").lower(),
                  "description": (e.get("usage_notes") or ""),
                  "images": e.get("images") or [],
                  "page": e.get("source_page")
                }
            with open(dict_path, "w", encoding="utf-8") as f:
              json.dump(migrated, f, ensure_ascii=False, indent=2)
            logger.info(f"Seeded dictionary from gsl_json: {len(migrated)} entries")
      except Exception as e:
        logger.warning(f"Dictionary seed failed: {e}")
      if build_sign_index:
        try: build_sign_index()
        except Exception as e: logger.warning(f"build_sign_index failed: {e}")
      if build_motion_templates:
        try: build_motion_templates()
        except Exception as e: logger.warning(f"build_motion_templates failed: {e}")
      try:
        text_to_sign_service._load()
      except Exception as e:
        logger.warning(f"Reload text_to_sign_service failed: {e}")
      try:
        dict_path = Path("data")/"processed"/"gsl_dictionary.json"
        report_path = Path("data")/"processed"/"gsl_dictionary_report.json"
        total = 0; usable = 0; incomplete = 0; with_images = 0; with_variants = 0
        data = {}
        if dict_path.exists():
          with open(dict_path,"r",encoding="utf-8") as f: data = json.load(f)
        for gloss, entry in data.items():
          total += 1
          desc_ok = bool(entry.get("description"))
          imgs = entry.get("images") or []
          base = Path("data")/"processed"/"images"/gloss
          imgs_ok = False
          valid_imgs = []
          for im in imgs:
            if (base/im).exists():
              imgs_ok = True
              valid_imgs.append(im)
          status = "complete" if (desc_ok or imgs_ok) else "incomplete"
          if status == "complete": usable += 1
          else: incomplete += 1
          if imgs_ok: with_images += 1
          if int(entry.get("variants") or 0) > 0: with_variants += 1
          entry["status"] = status
          entry["images"] = valid_imgs if valid_imgs else imgs
          data[gloss] = entry
        with open(report_path,"w",encoding="utf-8") as f:
          json.dump({
            "counts": {
              "total": total,
              "usable": usable,
              "incomplete": incomplete,
              "with_images": with_images,
              "with_variants": with_variants
            },
            "timestamp": datetime.now().isoformat()
          }, f, ensure_ascii=False, indent=2)
        logger.info(f"Dictionary validation: total={total} usable={usable} incomplete={incomplete}")
      except Exception as e:
        logger.warning(f"Validation failed: {e}")
      try:
        first_gloss = next(iter(text_to_sign_service.dictionary.keys()), None)
        ok1 = first_gloss is not None
        ok2 = bool(text_to_sign_service.search(first_gloss or "").get("gloss"))
        static_ok = (Path("data")/"processed"/"images").exists()
        logger.info(f"Self-test: dict_loaded={ok1} search_ok={ok2} static_ok={static_ok}")
      except Exception as e:
        logger.warning(f"Self-test error: {e}")
    except Exception as e:
      logger.warning(f"Startup data build failed: {e}")

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
                try:
                    g, score = dict_matcher.best_match(seq)
                    tops = dict_matcher.top_matches(seq, 3)
                    predicted_gloss = g
                    predicted_confidence = float(max(0.0, score))
                except Exception as e:
                    logger.warning(f"Dictionary matcher failed: {e}")

                # Send pose + baseline result back to client
                response = {
                    "type": "pose_data",
                    "landmarks": pose_data["landmarks"],
                    "confidence": pose_data["confidence"],
                    "timestamp": message["timestamp"],
                    "session_id": session_id,
                    "predicted_gloss": predicted_gloss,
                    "predicted_confidence": predicted_confidence,
                    "top_matches": [{"gloss": t[0], "confidence": float(t[1])} for t in tops] if 'tops' in locals() else []
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
async def search_dictionary(q: str):
    try:
        r = text_to_sign_service.search(q)
        return {
            "gloss": r.get("gloss"),
            "images": r.get("images", []),
            "description": r.get("description", ""),
            "page": r.get("page"),
            "confidence": float(r.get("confidence", 0.0)),
            "alternatives": r.get("alternatives", []),
            "match_type": r.get("match_type", "None"),
            "variants": r.get("variants", 0)
        }
    except Exception as e:
        logger.error(f"Error searching dictionary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analytics/track")
async def track_analytics(event: AnalyticsEventRequest):
    try:
        db = SessionLocal()
        db_event = AnalyticsEvent(
            session_id=event.session_id or "anonymous",
            event_type=event.event_type,
            data=event.data
        )
        db.add(db_event)
        db.commit()
        db.close()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Analytics tracking failed: {e}")
        return {"status": "ignored"}

@app.post("/api/feedback/report")
async def report_feedback(feedback: FeedbackRequest):
    try:
        db = SessionLocal()
        report = FeedbackReport(
            gloss=feedback.gloss,
            reason=feedback.reason
        )
        db.add(report)
        db.commit()
        db.close()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Feedback reporting failed: {e}")
        return {"status": "ignored"}

@app.get("/api/dictionary/list")
async def list_dictionary(letter: str = "A"):
    try:
        items = []
        l = (letter or "A").upper()
        for gloss, e in text_to_sign_service.dictionary.items():
            if gloss.upper().startswith(l):
                items.append({
                    "gloss": gloss,
                    "variants": int(e.get("variants") or len(e.get("images") or [])),
                    "page": e.get("page")
                })
        items.sort(key=lambda x: x["gloss"])
        return {"items": items}
    except Exception as e:
        logger.error(f"Error listing dictionary: {str(e)}")
        return {"items": []}

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
