from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form, Response
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import json
import base64
import numpy as np
from datetime import datetime
import logging
import os
import re
from dotenv import load_dotenv
load_dotenv()
from google import genai
from google.genai import types
import uuid

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
from .services.speech_recognition_service import WhisperSpeechRecognitionService, SpeechRecognitionConfig
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

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "processed_data": (Path("data")/"processed"/"images").exists()
    }

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services lazily
_dictionary_service = None
_text_to_sign_service = None
_dict_matcher = None
_mediapipe_service = None
_translation_service = None
_avatar_service = None
_speech_service = None

ENABLE_APPROVED_SIGN_MAPPINGS = os.getenv("ENABLE_APPROVED_SIGN_MAPPINGS", "false").lower() == "true"
APPROVED_MAPPINGS_PATH = Path("data") / "processed" / "approved_sign_mappings.json"
_approved_term_to_mapping: Optional[Dict[str, Dict[str, Any]]] = None
_approved_unique_reverse_map: Optional[Dict[str, str]] = None
_handshape_inventory_cache: Optional[Dict[str, Any]] = None
_recognition_profiles_cache: Optional[Dict[str, Any]] = None


def _normalize_term(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _load_approved_mappings_if_needed() -> None:
    global _approved_term_to_mapping, _approved_unique_reverse_map

    if _approved_term_to_mapping is not None and _approved_unique_reverse_map is not None:
        return

    _approved_term_to_mapping = {}
    _approved_unique_reverse_map = {}

    if not ENABLE_APPROVED_SIGN_MAPPINGS:
        return

    if not APPROVED_MAPPINGS_PATH.exists():
        logger.warning(f"Approved mappings enabled but file not found: {APPROVED_MAPPINGS_PATH}")
        return

    try:
        with open(APPROVED_MAPPINGS_PATH, "r", encoding="utf-8") as f:
            payload = json.load(f)

        mappings = payload.get("mappings", []) if isinstance(payload, dict) else []
        if not isinstance(mappings, list):
            mappings = []

        reverse_counts: Dict[str, int] = {}
        reverse_term: Dict[str, str] = {}

        for item in mappings:
            if not isinstance(item, dict):
                continue
            if str(item.get("status") or "").lower() != "approved":
                continue

            term = _normalize_term(str(item.get("term") or ""))
            if not term:
                continue

            _approved_term_to_mapping[term] = item

            target_gloss = item.get("target_gloss")
            if isinstance(target_gloss, str) and target_gloss.strip():
                key = target_gloss.strip().upper()
                reverse_counts[key] = reverse_counts.get(key, 0) + 1
                reverse_term[key] = term

        for gloss, count in reverse_counts.items():
            if count == 1:
                _approved_unique_reverse_map[gloss] = reverse_term[gloss]

        logger.info(
            f"Approved sign mappings loaded: terms={len(_approved_term_to_mapping)} unique_reverse={len(_approved_unique_reverse_map)}"
        )
    except Exception as e:
        logger.warning(f"Failed to load approved sign mappings: {e}")


def _get_approved_mapping_for_term(term: str) -> Optional[Dict[str, Any]]:
    _load_approved_mappings_if_needed()
    if _approved_term_to_mapping is None:
        return None
    return _approved_term_to_mapping.get(_normalize_term(term))


def _map_predicted_gloss_if_enabled(gloss: Optional[str]) -> Optional[str]:
    if not gloss or not ENABLE_APPROVED_SIGN_MAPPINGS:
        return gloss
    _load_approved_mappings_if_needed()
    if not _approved_unique_reverse_map:
        return gloss

    mapped_term = _approved_unique_reverse_map.get(gloss.strip().upper())
    if not mapped_term:
        return gloss
    return mapped_term.upper()


def _build_handshape_inventory() -> Dict[str, Any]:
    service = get_text_to_sign_service()
    dictionary = service.dictionary or {}

    counts: Dict[str, int] = {}
    examples: Dict[str, List[Dict[str, Any]]] = {}
    total = 0

    for gloss, entry in dictionary.items():
        total += 1
        primitives = service._infer_primitives(gloss, entry)
        handshape = str(primitives.get("handshape") or "UNKNOWN").upper()
        counts[handshape] = counts.get(handshape, 0) + 1
        examples.setdefault(handshape, [])
        if len(examples[handshape]) < 10:
            examples[handshape].append(
                {
                    "gloss": gloss,
                    "english": entry.get("english"),
                    "page": entry.get("page"),
                }
            )

    return {
        "total_entries": total,
        "handshape_counts": dict(sorted(counts.items(), key=lambda x: x[0])),
        "examples": examples,
        "generated_at": datetime.now().isoformat(),
    }


def _get_handshape_inventory(force_refresh: bool = False) -> Dict[str, Any]:
    global _handshape_inventory_cache
    if _handshape_inventory_cache is None or force_refresh:
        _handshape_inventory_cache = _build_handshape_inventory()
    return _handshape_inventory_cache


def _map_primitive_direction(direction: str) -> str:
    d = (direction or "NONE").upper()
    if d in {"UP", "DOWN", "LEFT", "RIGHT", "FORWARD", "BACKWARD", "CIRCULAR"}:
        return d
    if d in {"HOLD", "TAP", "NONE"}:
        return "STATIC"
    return "STATIC"


def _map_primitive_location(location: str) -> str:
    l = (location or "UNKNOWN").upper()
    if l in {"FACE", "CHIN"}:
        return "FACE"
    if l == "HEAD":
        return "HIGH"
    if l == "CHEST":
        return "CHEST"
    if l == "TORSO":
        return "MID"
    if l == "NEUTRAL":
        return "NEUTRAL"
    return "MID"


def _map_primitive_handshape(handshape: str) -> str:
    h = (handshape or "UNKNOWN").upper()
    allowed = {"FLAT", "FIST", "OPEN", "PINCH", "POINT", "CURVED"}
    return h if h in allowed else "UNKNOWN"


def _is_recognition_candidate(gloss: str, entry: Dict[str, Any]) -> bool:
    g = (gloss or "").strip().upper()
    if not g:
        return False
    if len(g) > 28:
        return False
    if not re.fullmatch(r"[A-Z][A-Z\s'\-]*", g):
        return False

    images = entry.get("images") or []
    if not images:
        return False

    desc = str(entry.get("description") or "").lower()
    noisy_markers = [
        "table of content",
        "message of support",
        "foreword",
        "copyright",
        "ghanaan sign language third edition dictionary",
    ]
    if any(marker in desc for marker in noisy_markers):
        return False

    variants = int(entry.get("variants") or len(images))
    if variants > 4:
        return False

    return True


def _build_recognition_profiles(force_refresh: bool = False) -> Dict[str, Any]:
    global _recognition_profiles_cache
    if _recognition_profiles_cache is not None and not force_refresh:
        return _recognition_profiles_cache

    service = get_text_to_sign_service()
    profiles: List[Dict[str, Any]] = []

    for gloss, entry in service.dictionary.items():
        if not _is_recognition_candidate(gloss, entry):
            continue

        primitives = service._infer_primitives(gloss, entry)
        if not primitives or not primitives.get("can_animate"):
            continue

        mapped_handshape = _map_primitive_handshape(str(primitives.get("handshape") or "UNKNOWN"))
        mapped_location = _map_primitive_location(str(primitives.get("location") or "UNKNOWN"))
        mapped_direction = _map_primitive_direction(str(primitives.get("direction") or "NONE"))
        repetition = 1 if str(primitives.get("repetition") or "SINGLE").upper() == "REPEAT" else 0

        # Skip profiles with no discriminative primitive signal.
        if mapped_handshape == "UNKNOWN" and mapped_direction == "STATIC" and mapped_location == "MID":
            continue

        profiles.append({
            "id": str(gloss).lower().replace(" ", "_"),
            "gloss": gloss,
            "handshape": [mapped_handshape] if mapped_handshape != "UNKNOWN" else ["OPEN", "FLAT", "POINT", "PINCH", "FIST", "CURVED"],
            "handedness": "RIGHT_OR_LEFT",
            "location": [mapped_location],
            "motion": {
                "primaryDirection": [mapped_direction],
                "repetition": repetition,
            },
            "requiresTwoHands": bool(primitives.get("two_hands")),
            "stabilityFrames": 4,
            "source": "dictionary_primitives",
            "page": entry.get("page"),
        })

    profiles.sort(key=lambda p: p.get("gloss", ""))
    _recognition_profiles_cache = {
        "count": len(profiles),
        "profiles": profiles,
        "generated_at": datetime.now().isoformat(),
    }
    return _recognition_profiles_cache

def get_dictionary_service():
    global _dictionary_service
    if _dictionary_service is None:
        from .services.gsl_dictionary_service import GSLDictionaryService
        _dictionary_service = GSLDictionaryService()
    return _dictionary_service

def get_text_to_sign_service():
    global _text_to_sign_service
    if _text_to_sign_service is None:
        from backend.dictionary.text_to_sign import TextToSignService
        _text_to_sign_service = TextToSignService()
    return _text_to_sign_service

def get_dict_matcher():
    global _dict_matcher
    if _dict_matcher is None:
        from backend.sign_matching.dictionary_matcher import DictionaryMatcher
        _dict_matcher = DictionaryMatcher()
    return _dict_matcher

def get_mediapipe_service():
    global _mediapipe_service
    if _mediapipe_service is None:
        from .services.mediapipe_service import MediaPipeService
        _mediapipe_service = MediaPipeService()
    return _mediapipe_service

def get_translation_service():
    global _translation_service
    if _translation_service is None:
        from .services.translation_service import TranslationService, TranslationConfig
        _translation_service = TranslationService(TranslationConfig())
    return _translation_service

def get_avatar_service():
    global _avatar_service
    if _avatar_service is None:
        from .services.avatar_service import AvatarService
        _avatar_service = AvatarService()
    return _avatar_service

def get_speech_service():
    global _speech_service
    if _speech_service is None:
        from .services.speech_recognition_service import WhisperSpeechRecognitionService, SpeechRecognitionConfig
        _speech_service = WhisperSpeechRecognitionService(SpeechRecognitionConfig(language="en"))
    return _speech_service

_audio_buffers: Dict[str, Any] = {}

# Serve extracted dictionary images
try:
    images_path = Path("data")/"processed"/"images"
    images_path.mkdir(parents=True, exist_ok=True)
    # Explicitly check if directory is empty and warn
    if not any(images_path.iterdir()):
        logger.warning(f"Static images directory {images_path} is empty. Dictionary images will not show until extraction runs.")
    app.mount("/static", StaticFiles(directory=str(images_path)), name="static")
    logger.info(f"Mounted static images from {images_path}")
except Exception as e:
    logger.error(f"Failed to mount static files: {e}")

@app.get("/api/dictionary-pdf")
async def get_dictionary_pdf():
    pdf_path = Path("Ghanaian Sign Language Dictionary - 3rd Edition.pdf")
    if not pdf_path.exists():
        # Fallback if the path is slightly different
        pdf_path = Path("data/raw/gsl_dictionary.pdf")
        
    if not pdf_path.exists():
        # On Render, the raw 250MB PDF is often missing to save space.
        # The dictionary features still work because processed data is pushed.
        raise HTTPException(
            status_code=404, 
            detail="The full PDF dictionary is unavailable in the web environment to optimize performance. However, you can still search all signs and view diagrams in the Dictionary section."
        )

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

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

# Configure Gemini AI
api_key = os.getenv("GEMINI_API_KEY")
gemini_client = None
if api_key:
    gemini_client = genai.Client(api_key=api_key)
    logger.info("Gemini AI (google-genai) configured successfully")
else:
    logger.warning("GEMINI_API_KEY environment variable not set. Chatbot will not work.")

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
        if False: # Disabled automatic PDF parsing to fix long Render deployment times
          pass
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
      if build_sign_index and not Path("data/processed/gsl_sign_index.json").exists():
        logger.info("Sign index missing, but skipping build during startup for Render safety.")
      if build_motion_templates and not Path("data/processed/dictionary_motion_templates.json").exists():
        logger.info("Motion templates missing, but skipping build during startup for Render safety.")
      try:
        get_text_to_sign_service()._load(); get_dictionary_service()
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
        first_gloss = next(iter(get_text_to_sign_service().dictionary.keys()), None)
        ok1 = first_gloss is not None
        ok2 = bool(get_text_to_sign_service().search(first_gloss or "").get("gloss"))
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
                pose_data = await get_mediapipe_service().process_frame(frame_data)
                
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
                    # Run CPU-bound DTW matchers in a thread so they don't block the WebSocket event loop
                    def run_matchers():
                        g_best, s_best = get_dict_matcher().best_match(seq)
                        t_best = get_dict_matcher().top_matches(seq, 3)
                        return g_best, s_best, t_best

                    g, score, tops = await asyncio.to_thread(run_matchers)
                    predicted_gloss = _map_predicted_gloss_if_enabled(g)
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
                
                # Use smaller chunk size for more responsive transcription (e.g. ~2-3 seconds at 16kHz)
                # Note: Browsers usually send 44.1kHz or 48kHz, so we need to account for that.
                # Assuming 44.1kHz from frontend (as seen in Interpreter.tsx)
                sample_rate = message.get("sample_rate", 44100)
                
                # Process shorter chunks for faster speech feedback
                chunk_seconds = 1.4
                chunk_size = int(sample_rate * chunk_seconds)
                overlap_seconds = 0.25
                overlap = int(sample_rate * overlap_seconds)
                
                response = None
                if len(buf) >= chunk_size:
                    chunk = np.array(buf[:chunk_size], dtype=np.float32)
                    
                    # Keep overlap for next chunk
                    _audio_buffers[session_id] = buf[chunk_size - overlap:]
                    
                    try:
                        # Use transcribe_audio which handles numpy -> WAV conversion
                        # Pass sample_rate explicitly to ensure correct WAV header
                        result = await get_speech_service().transcribe_audio(chunk, sample_rate=sample_rate)

                        if result.get("text"):
                            response = {
                                "type": "transcription",
                                "text": result.get("text", ""),
                                "confidence": result.get("confidence", 0.0),
                                "timestamp": message["timestamp"],
                                "session_id": session_id
                            }
                        elif result.get("error"):
                            response = {
                                "type": "transcription_error",
                                "error": result.get("error", "Speech transcription backend failed"),
                                "timestamp": message["timestamp"],
                                "session_id": session_id,
                            }
                    except Exception as e:
                        logger.error(f"Transcription error: {e}")
                        response = {
                            "type": "transcription_error",
                            "error": str(e),
                            "timestamp": message.get("timestamp", int(datetime.now().timestamp() * 1000)),
                            "session_id": session_id,
                        }
                
                if response:
                    await manager.send_personal_message(json.dumps(response), session_id)
                
    except WebSocketDisconnect:
        manager.disconnect(session_id)
        if session_id in _audio_buffers:
            del _audio_buffers[session_id]
    except Exception as e:
        logger.error(f"Error in audio stream: {str(e)}")
        await manager.send_personal_message(json.dumps({"error": str(e)}), session_id)

# Sign to speech translation endpoint
@app.post("/api/translate/sign-to-speech")
async def translate_sign_to_speech(request: SignToSpeechRequest):
    try:
        # Process pose sequence with sign recognition
        translation = await get_translation_service().translate_sign_to_speech(
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
        translation = await get_translation_service().translate_speech_to_sign(
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
        animation_data = await get_avatar_service().render_avatar(
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
        mapping_applied = False
        mapped_from = None

        mapping = _get_approved_mapping_for_term(q)
        if ENABLE_APPROVED_SIGN_MAPPINGS and mapping:
            target_gloss = mapping.get("target_gloss")
            target_composite = mapping.get("target_composite_glosses")

            if isinstance(target_gloss, str) and target_gloss.strip():
                mapped_from = q
                q = target_gloss.strip()
                mapping_applied = True
            elif isinstance(target_composite, list) and target_composite:
                parts = []
                for gloss in target_composite:
                    g = str(gloss).strip()
                    if not g:
                        continue
                    part = get_text_to_sign_service().search(g)
                    if part and part.get("gloss"):
                        parts.append(part)

                if parts:
                    glosses = [p.get("gloss") for p in parts if p.get("gloss")]
                    images: List[str] = []
                    seen = set()
                    for p in parts:
                        for img in p.get("images", []) or []:
                            if img not in seen:
                                seen.add(img)
                                images.append(img)

                    avg_conf = sum(float(p.get("confidence") or 0.0) for p in parts) / max(1, len(parts))
                    return {
                        "gloss": " ".join(glosses),
                        "images": images,
                        "description": f"Approved composite mapping for '{q}': {' + '.join(glosses)}",
                        "page": parts[0].get("page") if parts else None,
                        "confidence": float(avg_conf),
                        "alternatives": [p.get("gloss") for p in parts if p.get("gloss")],
                        "match_type": "ApprovedMappingComposite",
                        "variants": int(sum(int(p.get("variants") or 0) for p in parts)),
                        "primitives": None,
                        "mapping_applied": True,
                        "mapped_from": q,
                    }

        r = get_text_to_sign_service().search(q)
        return {
            "gloss": r.get("gloss"),
            "images": r.get("images", []),
            "description": r.get("description", ""),
            "page": r.get("page"),
            "confidence": float(r.get("confidence", 0.0)),
            "alternatives": r.get("alternatives", []),
            "match_type": r.get("match_type", "None"),
            "variants": r.get("variants", 0),
            "primitives": r.get("primitives", None),
            "mapping_applied": mapping_applied,
            "mapped_from": mapped_from,
        }
    except Exception as e:
        logger.error(f"Error searching dictionary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dictionary/approved-mappings/status")
async def approved_mappings_status():
    _load_approved_mappings_if_needed()
    return {
        "enabled": ENABLE_APPROVED_SIGN_MAPPINGS,
        "path": str(APPROVED_MAPPINGS_PATH),
        "loaded_terms": len(_approved_term_to_mapping or {}),
        "unique_reverse_aliases": len(_approved_unique_reverse_map or {}),
    }

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
        for gloss, e in get_text_to_sign_service().dictionary.items():
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


@app.get("/api/dictionary/handshapes")
async def get_dictionary_handshapes(refresh: bool = False):
    try:
        return _get_handshape_inventory(force_refresh=refresh)
    except Exception as e:
        logger.error(f"Error building handshape inventory: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dictionary/recognition-profiles")
async def get_dictionary_recognition_profiles(refresh: bool = False, limit: int = 0):
    try:
        payload = _build_recognition_profiles(force_refresh=refresh)
        profiles = payload.get("profiles", [])
        if isinstance(limit, int) and limit > 0:
            profiles = profiles[:limit]
        return {
            "count": len(profiles),
            "profiles": profiles,
            "generated_at": payload.get("generated_at"),
        }
    except Exception as e:
        logger.error(f"Error building recognition profiles: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dictionary/motion-templates")
async def get_dictionary_motion_templates(limit: int = 0):
    try:
        templates = get_dict_matcher().export_templates(limit=limit)
        return {
            "count": len(templates),
            "templates": templates,
        }
    except Exception as e:
        logger.error(f"Error exporting motion templates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dictionary/sign/{sign_id}")
async def get_sign_details(sign_id: str):
    try:
        sign = await get_dictionary_service().get_sign_by_id(sign_id)
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

from .routes.ai import router as ai_router
app.include_router(ai_router, prefix="/api/ai")

# Serve compiled React frontend from 'dist' folder
# Handle SPA routing: redirect unknown paths to index.html
@app.get("/{catchall:path}")
async def serve_frontend(catchall: str):
    # Exclude API and static paths explicitly
    if catchall.startswith("api") or catchall.startswith("health") or catchall.startswith("static") or catchall.startswith("ws"):
        raise HTTPException(status_code=404)
        
    dist_path = Path("dist") / catchall
    
    # If the exact file exists in dist (like assets/index.js), serve it
    if dist_path.exists() and dist_path.is_file():
        return FileResponse(dist_path)
    
    # For all other routes (like /interpreter, /dictionary), serve index.html for SPA routing
    index_path = Path("dist") / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    
    return {"message": "Ghana Sign Language Interpreter API is running, but Frontend build not found."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)  # Disable reload for production stability

