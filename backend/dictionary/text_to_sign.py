import json
import logging
import os
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import httpx

logger = logging.getLogger(__name__)

PROCESSED = Path("data") / "processed"
DICT_PATH = PROCESSED / "gsl_dictionary.json"
INDEX_PATH = PROCESSED / "gsl_sign_index.json"
APPROVED_MAPPINGS_PATH = PROCESSED / "approved_sign_mappings.json"
EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"

FILLER_WORDS = {"uh", "um", "erm", "mm", "mmm", "ah", "eh", "like"}
AUXILIARY_WORDS = {"can", "could", "would", "should", "shall", "do", "does", "did", "is", "are", "am", "was", "were"}


class TextToSignService:
    def __init__(self):
        self.dictionary: Dict[str, Any] = {}
        self.index: Dict[str, Any] = {}
        self._cache_vecs: Dict[str, np.ndarray] = {}
        self._page_cache: Dict[str, int] = {}
        self._index_loaded = False
        self._index_matrix = None
        self._index_keys = []
        self._search_cache: Dict[str, Dict[str, Any]] = {}  # Simple cache for results
        self._approved_term_to_mapping: Optional[Dict[str, Dict[str, Any]]] = None
        self._load_dictionary()

    def _load(self):
        """Compatibility method for main.py."""
        self._load_dictionary()
        self._ensure_index_loaded()

    def _load_dictionary(self):
        """Load the GSL dictionary from JSON."""
        if DICT_PATH.exists():
            with open(DICT_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict) and "entries" in loaded and isinstance(loaded["entries"], list):
                    d: Dict[str, Any] = {}
                    for e in loaded["entries"]:
                        gloss = e.get("gloss")
                        if gloss:
                            d[gloss] = {
                                "english": e.get("english") or "",
                                "description": e.get("usage") or "",
                                "images": [e.get("image_path")] if e.get("image_path") else [],
                                "page": e.get("source_page"),
                            }
                    self.dictionary = d
                else:
                    self.dictionary = loaded or {}

    def _normalize_term(self, text: str) -> str:
        return re.sub(r"\s+", " ", (text or "").strip().lower())

    def _load_approved_mappings_if_needed(self):
        if self._approved_term_to_mapping is not None:
            return

        self._approved_term_to_mapping = {}
        if not APPROVED_MAPPINGS_PATH.exists():
            return

        try:
            with open(APPROVED_MAPPINGS_PATH, "r", encoding="utf-8") as f:
                payload = json.load(f)
            mappings = payload.get("mappings", []) if isinstance(payload, dict) else []
            if not isinstance(mappings, list):
                mappings = []

            for item in mappings:
                if not isinstance(item, dict):
                    continue
                if str(item.get("status") or "").lower() != "approved":
                    continue
                term = self._normalize_term(str(item.get("term") or ""))
                if term:
                    self._approved_term_to_mapping[term] = item
        except Exception as exc:
            logger.warning(f"Failed to load approved sign mappings: {exc}")

    def _get_approved_mapping_for_term(self, term: str) -> Optional[Dict[str, Any]]:
        self._load_approved_mappings_if_needed()
        if self._approved_term_to_mapping is None:
            return None
        return self._approved_term_to_mapping.get(self._normalize_term(term))

    def _preload_model(self):
        """No-op: local model disabled for free tier. Using Gemini API instead."""
        pass

    def _get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for search query via Gemini API."""
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return self._fallback_embedding(text)
            
        try:
            payload = {
                "model": EMBEDDING_MODEL,
                "content": {"parts": [{"text": text}]}
            }
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(EMBEDDING_URL, headers={"x-goog-api-key": api_key}, json=payload)
                if resp.status_code == 200:
                    return np.array(resp.json()["embedding"]["values"])
        except Exception as e:
            logger.warning(f"Embedding API failed: {e}")
            
        return self._fallback_embedding(text)

    def _fallback_embedding(self, text: str) -> np.ndarray:
        h = abs(hash(text)) % (10**8)
        rng = np.random.default_rng(h)
        # Gemini embeddings are 768d, match that
        return rng.normal(0, 1, 768)

    def _ensure_index_loaded(self):
        if self._index_loaded:
            return
        if INDEX_PATH.exists():
            try:
                with open(INDEX_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.index = data.get("index", {})
                
                # Build a NumPy matrix for vectorized similarity search
                keys = []
                vectors = []
                for gloss, rec in self.index.items():
                    tv = rec.get("text_vec", [])
                    # Support both 384d (legacy) and 768d (Gemini)
                    if len(tv) in [384, 768]:
                        keys.append(gloss)
                        vectors.append(tv)
                
                if vectors:
                    self._index_matrix = np.array(vectors, dtype=float)
                    # Pre-normalize for fast cosine similarity via dot product
                    norms = np.linalg.norm(self._index_matrix, axis=1, keepdims=True)
                    norms[norms == 0] = 1.0
                    self._index_matrix = self._index_matrix / norms
                    self._index_keys = keys
                
                self._index_loaded = True
            except Exception as e:
                logger.warning(f"Failed to load index: {e}")

    def _normalize_translation_tokens(self, text: str) -> List[str]:
        cleaned = re.sub(r"[^a-z0-9\s']", " ", (text or "").lower())
        raw_tokens = cleaned.split()
        return [token for token in raw_tokens if token not in FILLER_WORDS and token not in AUXILIARY_WORDS]

    def _is_usable_translation_match(self, phrase: str, result: Dict[str, Any]) -> bool:
        if not result or not result.get("gloss"):
            return False

        match_type = str(result.get("match_type") or "None")
        confidence = float(result.get("confidence") or 0.0)
        token_count = len(phrase.split())

        if match_type.startswith("Exact"):
            return True
        if match_type == "Prefix/Contains":
            return confidence >= 0.84
        if match_type.startswith("Semantic"):
            return token_count == 1 and confidence >= 0.62
        return False

    def _build_translation_entry(self, source_text: str, result: Dict[str, Any], match_type_override: Optional[str] = None) -> Dict[str, Any]:
        primitives = result.get("primitives")
        return {
            "word": source_text,
            "gloss": result.get("gloss"),
            "images": list(result.get("images") or []),
            "description": result.get("description") or "",
            "page": result.get("page"),
            "confidence": float(result.get("confidence") or 0.0),
            "match_type": match_type_override or str(result.get("match_type") or "None"),
            "variants": int(result.get("variants") or 0),
            "status": "matched" if result.get("gloss") else "unknown",
            "primitives": primitives if isinstance(primitives, dict) else None,
        }

    def _build_unknown_translation_entry(self, source_text: str) -> Dict[str, Any]:
        return {
            "word": source_text,
            "gloss": None,
            "images": [],
            "description": "",
            "page": None,
            "confidence": 0.0,
            "match_type": "None",
            "variants": 0,
            "status": "unknown",
            "primitives": None,
        }

    def _resolve_approved_mapping_entries(self, phrase: str) -> Optional[List[Dict[str, Any]]]:
        mapping = self._get_approved_mapping_for_term(phrase)
        if not mapping:
            return None

        target_gloss = str(mapping.get("target_gloss") or "").strip()
        if target_gloss:
            result = self.search(target_gloss)
            if result.get("gloss"):
                return [self._build_translation_entry(phrase, result, "ApprovedMapping")]

        composite = mapping.get("target_composite_glosses")
        if not isinstance(composite, list) or not composite:
            return None

        entries: List[Dict[str, Any]] = []
        for idx, gloss in enumerate(composite):
            target = str(gloss or "").strip()
            if not target:
                continue
            result = self.search(target)
            if not result.get("gloss"):
                continue
            source_label = phrase if idx == 0 else target.lower().replace("_", " ")
            entries.append(self._build_translation_entry(source_label, result, "ApprovedMappingComposite"))

        return entries or None

    def _resolve_translation_phrase(self, phrase: str) -> Optional[List[Dict[str, Any]]]:
        approved_entries = self._resolve_approved_mapping_entries(phrase)
        if approved_entries:
            return approved_entries

        result = self.search(phrase)
        if self._is_usable_translation_match(phrase, result):
            return [self._build_translation_entry(phrase, result)]
        return None

    def translate_text(self, text: str, max_phrase_len: int = 4) -> Dict[str, Any]:
        tokens = self._normalize_translation_tokens(text)
        if not tokens:
            return {
                "input_text": text,
                "normalized_tokens": [],
                "recognized_units": [],
                "entries": [],
                "gsl_sequence": [],
                "matched_count": 0,
                "unknown_count": 0,
                "confidence": 0.0,
            }

        entries: List[Dict[str, Any]] = []
        recognized_units: List[str] = []
        matched_count = 0
        unknown_count = 0
        index = 0

        while index < len(tokens):
            resolved_entries: Optional[List[Dict[str, Any]]] = None
            consumed = 1
            max_window = min(max_phrase_len, len(tokens) - index)

            for size in range(max_window, 0, -1):
                phrase = " ".join(tokens[index:index + size])
                candidate_entries = self._resolve_translation_phrase(phrase)
                if candidate_entries:
                    resolved_entries = candidate_entries
                    consumed = size
                    recognized_units.append(phrase)
                    matched_count += 1
                    break

            if resolved_entries is None:
                token = tokens[index]
                recognized_units.append(token)
                entries.append(self._build_unknown_translation_entry(token))
                unknown_count += 1
                index += 1
                continue

            entries.extend(resolved_entries)
            index += consumed

        matched_entries = [entry for entry in entries if entry.get("status") == "matched" and entry.get("gloss")]
        confidence = (
            sum(float(entry.get("confidence") or 0.0) for entry in matched_entries) / len(matched_entries)
            if matched_entries
            else 0.0
        )

        return {
            "input_text": text,
            "normalized_tokens": tokens,
            "recognized_units": recognized_units,
            "entries": entries,
            "gsl_sequence": [str(entry.get("gloss")) for entry in matched_entries if entry.get("gloss")],
            "matched_count": matched_count,
            "unknown_count": unknown_count,
            "confidence": float(confidence),
        }

    def search(self, q: str) -> Dict[str, Any]:
        qn = (q or "").strip()
        if qn == "":
            return self._empty_response()

        # Check Cache
        if qn.lower() in self._search_cache:
            return self._search_cache[qn.lower()]

        qlow = qn.lower()
        
        # 1. Exact Match (Gloss or English)
        for gloss, entry in self.dictionary.items():
            if gloss.lower() == qlow or entry.get("english", "").lower() == qlow:
                res = self._build_match_response(gloss, entry, 1.0, "Exact")
                self._search_cache[qlow] = res
                return res

        # 2. Heuristic Forms (Plurals etc)
        forms = {qlow}
        if qlow.endswith("es"): forms.add(qlow[:-2])
        elif qlow.endswith("s"): forms.add(qlow[:-1])
        
        for gloss, entry in self.dictionary.items():
            if gloss.lower() in forms or entry.get("english", "").lower() in forms:
                res = self._build_match_response(gloss, entry, 1.0, "Exact (Heuristic)")
                self._search_cache[qlow] = res
                return res

        # 3. Partial / Prefix Match
        cand: List[str] = []
        for gloss, entry in self.dictionary.items():
            if gloss.lower().startswith(qlow) or entry.get("english", "").lower().startswith(qlow):
                cand.append(gloss)

        if not cand:
            for gloss, entry in self.dictionary.items():
                if qlow in gloss.lower() or qlow in entry.get("english", "").lower():
                    cand.append(gloss)

        if cand:
            cand.sort(key=len)
            g = cand[0]
            e = self.dictionary.get(g, {})
            res = self._build_match_response(g, e, 0.85, "Prefix/Contains", alts=cand[1:4])
            self._search_cache[qlow] = res
            return res
        
        # Semantic search fallback
        self._ensure_index_loaded()
        if self._index_matrix is not None:
            try:
                # Vectorized search using API embedding
                qvec = self._get_embedding(qlow)
                
                # Unit normalize query vector
                qnorm = np.linalg.norm(qvec)
                if qnorm > 0:
                    qvec = qvec / qnorm
                
                # Cosine similarity is just dot product since both are unit normalized
                # We need to handle dimension mismatch if index was built with different model
                if qvec.size == self._index_matrix.shape[1]:
                    similarities = self._index_matrix @ qvec
                    
                    # Get top match
                    best_idx = np.argmax(similarities)
                    sc = float(similarities[best_idx])
                    g = self._index_keys[best_idx]
                    
                    # Get alternatives (top 2-4)
                    top_indices = np.argsort(similarities)[::-1]
                    alts = [self._index_keys[i] for i in top_indices[1:4]]
                    
                    e = self.dictionary.get(g, {})
                    imgs = self._ensure_images(g, e)
                    primitives = self._infer_primitives(g, e)
                    
                    res = {
                        "gloss": g,
                        "images": imgs,
                        "description": e.get("description", ""),
                        "page": e.get("page"),
                        "confidence": float(min(0.69, max(0.0, sc))),
                        "alternatives": alts,
                        "match_type": "Semantic (Vectorized)",
                        "variants": int(e.get("variants") or 0),
                        "primitives": primitives,
                    }
                    self._search_cache[qlow] = res
                    return res
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Vectorized search failed: {e}")

        # Fallback to empty
        return self._empty_response()

    def _empty_response(self) -> Dict[str, Any]:
        alts: List[str] = list(self.dictionary.keys())[:3]
        g = alts[0] if alts else None
        e = self.dictionary.get(g or "", {})
        primitives = self._infer_primitives(g or "", e)
        return {
            "gloss": g if g else None,
            "images": self._ensure_images(g or "", e) if g else [],
            "description": e.get("description", "") if g else "",
            "page": e.get("page") if g else None,
            "confidence": 0.0,
            "alternatives": alts[1:] if len(alts) > 1 else [],
            "match_type": "None",
            "variants": int(e.get("variants") or 0) if g else 0,
            "primitives": primitives,
        }

    def _build_match_response(self, gloss: str, entry: Dict[str, Any], confidence: float, match_type: str, alts: List[str] = None) -> Dict[str, Any]:
        imgs = self._ensure_images(gloss, entry)
        primitives = self._infer_primitives(gloss, entry)
        return {
            "gloss": gloss,
            "images": imgs,
            "description": entry.get("description", ""),
            "page": entry.get("page"),
            "confidence": confidence,
            "alternatives": alts or [],
            "match_type": match_type,
            "variants": int(entry.get("variants") or 0),
            "primitives": primitives,
        }


    def _cos(self, a: np.ndarray, b: np.ndarray) -> float:
        na = np.linalg.norm(a)
        nb = np.linalg.norm(b)
        if na == 0 or nb == 0:
            return 0.0
        return float((a @ b) / (na * nb))

    def _ensure_images(self, gloss: str, entry: Dict[str, Any]) -> List[str]:
        images = entry.get("images") or []
        out: List[str] = []
        base = PROCESSED / "images" / gloss
        
        # Check if the images actually exist in the gloss-specific folder
        for img in images:
            p = base / img
            if p.exists():
                # Return path relative to images/
                out.append(f"{gloss}/{img}")
            else:
                # If it doesn't exist in the gloss-specific folder, check the main images folder
                p_main = PROCESSED / "images" / img
                if p_main.exists():
                    out.append(img)
                    
        if out:
            return out
        
        # If no images found, fallback to page extraction (now with cropping)
        try:
            page = int(entry.get("page") or 0)
            if page <= 0:
                page = self._find_page(gloss)
            
            if page > 0:
                import fitz
                import pdfplumber
                import re

                src_pdf = Path("Ghanaian Sign Language Dictionary - 3rd Edition.pdf")
                raw_pdf = Path("data") / "raw" / "gsl_dictionary.pdf"
                pdf_path = src_pdf if src_pdf.exists() else raw_pdf
                
                if pdf_path.exists():
                    base.mkdir(parents=True, exist_ok=True)
                    
                    # We need to find the gloss on the page to crop it correctly
                    with pdfplumber.open(pdf_path) as pdf:
                        p = pdf.pages[page - 1]
                        words = p.extract_words()
                        # Find the specific gloss coordinate
                        gloss_matches = [w for w in words if w['text'].upper() == gloss.upper()]
                        
                        if gloss_matches:
                            # Use the first match
                            g_info = gloss_matches[0]
                            
                            # Determine crop box (same logic as extraction script)
                            x0 = g_info['x0']
                            top = g_info['top']
                            bottom = g_info['bottom']
                            page_width = p.width
                            page_height = p.height
                            
                            crop_width = page_width / 2.2
                            crop_height = 320
                            
                            if x0 > page_width / 2:
                                cx0 = page_width / 2
                            else:
                                cx0 = 30
                                
                            # Capture region ABOVE the gloss
                            cy1 = bottom + 10
                            cy0 = max(0, cy1 - crop_height)
                            cx1 = min(page_width, cx0 + crop_width)
                            cy1 = min(page_height, cy1)
                            
                            # Crop using PyMuPDF
                            doc = fitz.open(pdf_path)
                            fitz_page = doc.load_page(page - 1)
                            rect = fitz.Rect(cx0, cy0, cx1, cy1)
                            pix = fitz_page.get_pixmap(clip=rect, matrix=fitz.Matrix(2, 2))
                            
                            gloss_safe = re.sub(r"[^A-Z]", "_", gloss.upper())
                            fname = f"{gloss_safe}_p{page}.png"
                            dst = base / fname
                            pix.save(dst)
                            out.append(f"{gloss}/{fname}")
                        else:
                            # Fallback to full page if gloss not found for cropping
                            doc = fitz.open(pdf_path)
                            pix = doc.load_page(page - 1).get_pixmap()
                            fname = f"page{page}.png"
                            dst = base / fname
                            pix.save(dst)
                            out.append(f"{gloss}/{fname}")
        except Exception:
            pass
        return out

    def _find_page(self, gloss: str) -> int:
        g = gloss.strip().upper()
        if g in self._page_cache:
            return self._page_cache[g]
        try:
            import pdfplumber

            for cand in [
                Path("Ghanaian Sign Language Dictionary - 3rd Edition.pdf"),
                Path("data") / "raw" / "gsl_dictionary.pdf",
            ]:
                if cand.exists():
                    with pdfplumber.open(cand) as pdf:
                        for i, p in enumerate(pdf.pages):
                            t = p.extract_text() or ""
                            lines = [l.strip() for l in t.splitlines() if l.strip()]
                            for ln in lines:
                                if ln == g or ln.startswith(g + " "):
                                    self._page_cache[g] = i + 1
                                    return i + 1
        except Exception:
            pass
        return 0

    def _infer_primitives(self, gloss: str, entry: Dict[str, Any]) -> Dict[str, Any]:
        text = (
            ((entry.get("description") or "") + " " + (entry.get("english") or "")).lower()
        )
        direction = "NONE"
        if any(
            phrase in text
            for phrase in [
                "move hand up",
                "move up",
                "raise hand",
                "raise your hand",
                "lift hand",
                "lift your hand",
                "upward",
                "upwards",
                "point up",
            ]
        ):
            direction = "UP"
        elif any(
            phrase in text
            for phrase in [
                "move hand down",
                "move down",
                "lower hand",
                "downward",
                "downwards",
            ]
        ):
            direction = "DOWN"
        elif "side to side" in text or "side-to-side" in text or "sideways" in text:
            direction = "CIRCULAR"
        elif any(
            phrase in text
            for phrase in [
                "move hand forward",
                "move forward",
                "push forward",
                "towards the front",
                "toward the front",
                "in front of you",
                "in front of the body",
            ]
        ):
            direction = "FORWARD"
        elif "circle" in text or "circular" in text:
            direction = "CIRCULAR"
        elif "tap" in text:
            direction = "TAP"
        elif any(phrase in text for phrase in ["hold", "stay still", "keep still"]):
            direction = "HOLD"
        elif "left" in text:
            direction = "LEFT"
        elif "right" in text:
            direction = "RIGHT"

        repetition = "SINGLE"
        if any(
            phrase in text
            for phrase in [
                "twice",
                "two times",
                "repeat",
                "repeatedly",
                "several times",
                "many times",
            ]
        ):
            repetition = "REPEAT"

        handshape = "UNKNOWN"
        if "fist" in text or "clenched" in text:
            handshape = "FIST"
        elif "flat hand" in text or "flat-hand" in text or "palm" in text or "flat" in text:
            handshape = "FLAT"
        elif "point" in text or "index finger" in text or "index" in text:
            handshape = "POINT"
        elif "curved" in text or "c-shape" in text or "c shape" in text:
            handshape = "CURVED"
        elif "open hand" in text or "open palm" in text or "open" in text:
            handshape = "OPEN"

        location = "UNKNOWN"
        if "chin" in text:
            location = "CHIN"
        elif "mouth" in text or "lip" in text or "lips" in text:
            location = "FACE"
        elif "forehead" in text or "temple" in text or "head" in text:
            location = "HEAD"
        elif "chest" in text or "heart" in text:
            location = "CHEST"
        elif "shoulder" in text or "torso" in text or "body" in text:
            location = "TORSO"
        elif "in front of" in text or "in front" in text or "neutral space" in text:
            location = "NEUTRAL"

        two_hands = any(
            phrase in text
            for phrase in ["both hands", "two hands", "hands together", "with both hands"]
        )
        face_eyebrows = "neutral"
        if "raise eyebrows" in text or "raised eyebrows" in text or "eyebrows up" in text:
            face_eyebrows = "raised"
        elif "frown" in text or "furrowed brows" in text or "eyebrows down" in text or "scrunch" in text:
            face_eyebrows = "frown"

        face_mouth = "neutral"
        if "smile" in text or "smiling" in text:
            face_mouth = "smile"
        elif "open mouth" in text or "mouth open" in text or "say ah" in text:
            face_mouth = "open"
        elif "round mouth" in text or "purse lips" in text or "pucker" in text or "say o" in text:
            face_mouth = "round"

        facial = face_eyebrows != "neutral" or face_mouth != "neutral"

        can_animate = direction != "NONE" or handshape != "UNKNOWN" or location != "UNKNOWN"

        return {
            "direction": direction,
            "repetition": repetition,
            "handshape": handshape,
            "location": location,
            "two_hands": two_hands,
            "facial": facial,
            "face_eyebrows": face_eyebrows,
            "face_mouth": face_mouth,
            "can_animate": can_animate,
        }


