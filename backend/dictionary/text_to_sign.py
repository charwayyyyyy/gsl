import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import httpx

PROCESSED = Path("data") / "processed"
DICT_PATH = PROCESSED / "gsl_dictionary.json"
INDEX_PATH = PROCESSED / "gsl_sign_index.json"


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

    def _preload_model(self):
        """No-op: local model disabled for free tier. Using Gemini API instead."""
        pass

    def _get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for search query via Gemini API."""
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return self._fallback_embedding(text)
            
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/models/embedding-001:embedContent?key={api_key}"
            payload = {
                "model": "models/embedding-001",
                "content": {"parts": [{"text": text}]}
            }
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    return np.array(resp.json()["embedding"]["values"])
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Embedding API failed: {e}")
            
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
                import logging
                logging.getLogger(__name__).warning(f"Failed to load index: {e}")

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


