import json
import logging
import os
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
from sqlalchemy.orm import Session
from api.database.database import SessionLocal
from api.database.models import GSLSign
from sqlalchemy import or_

logger = logging.getLogger(__name__)

PROCESSED = Path("data") / "processed"
DICT_PATH = PROCESSED / "gsl_dictionary.json"
INDEX_PATH = PROCESSED / "gsl_sign_index.json"
APPROVED_MAPPINGS_PATH = PROCESSED / "approved_sign_mappings.json"

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

    def _load_dictionary(self):
        """Load the GSL dictionary from SQLite (Source of Truth)."""
        db = SessionLocal()
        try:
            # Check if we have entries in SQLite
            count = db.query(GSLSign).count()
            if count == 0:
                logger.warning("SQLite dictionary is empty. Seeding from JSON if possible...")
                # Try to seed using GSLDictionaryService logic if needed
                from api.services.gsl_dictionary_service import GSLDictionaryService
                GSLDictionaryService() # This will trigger _seed_database_if_needed
                count = db.query(GSLSign).count()
            
            logger.info(f"Loaded {count} signs from SQLite dictionary")
            self.dictionary = {} # Backward compatibility
        except Exception as e:
            logger.error(f"Error loading dictionary from SQLite: {e}")
        finally:
            db.close()

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
        """No-op: local model disabled."""
        pass

    def _ensure_index_loaded(self):
        """No-op: semantic index disabled in dictionary-only mode."""
        self._index_loaded = True

    def _normalize_translation_tokens(self, text: str) -> List[str]:
        filler_words = {"uh", "um", "erm", "mm", "mmm", "ah", "eh", "like"}
        aux_words = {"can", "could", "would", "should", "shall", "do", "does", "did", "is", "are", "am", "was", "were"}
        cleaned = re.sub(r"[^a-z0-9\s']", " ", (text or "").lower())
        raw_tokens = cleaned.split()
        return [token for token in raw_tokens if token not in filler_words and token not in aux_words]

    def _is_usable_translation_match(self, phrase: str, result: Dict[str, Any]) -> bool:
        if not result or not result.get("gloss"):
            return False

        match_type = str(result.get("match_type") or "None")
        confidence = float(result.get("confidence") or 0.0)

        if match_type.startswith("Exact"):
            return True
        if match_type == "Prefix/Contains":
            return confidence >= 0.84
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
        db = SessionLocal()
        try:
            # 1. Exact Match (Gloss or English) from SQLite
            sign = db.query(GSLSign).filter(
                or_(GSLSign.gloss.ilike(qlow), GSLSign.english_meaning.ilike(qlow))
            ).first()
            
            if sign:
                entry = sign.to_dict()
                res = self._build_match_response(sign.gloss, entry, 1.0, "Exact (SQLite)")
                self._search_cache[qlow] = res
                return res

            # 2. Heuristic Forms (Plurals etc)
            forms = {qlow}
            if qlow.endswith("es"): forms.add(qlow[:-2])
            elif qlow.endswith("s"): forms.add(qlow[:-1])
            
            for form in forms:
                sign = db.query(GSLSign).filter(
                    or_(GSLSign.gloss.ilike(form), GSLSign.english_meaning.ilike(form))
                ).first()
                if sign:
                    entry = sign.to_dict()
                    res = self._build_match_response(sign.gloss, entry, 1.0, "Exact (Heuristic SQLite)")
                    self._search_cache[qlow] = res
                    return res

            # 3. Partial / Prefix Match
            pattern = f"{qlow}%"
            signs = db.query(GSLSign).filter(
                or_(GSLSign.gloss.ilike(pattern), GSLSign.english_meaning.ilike(pattern))
            ).order_by(GSLSign.gloss.asc()).limit(4).all()

            if not signs:
                pattern = f"%{qlow}%"
                signs = db.query(GSLSign).filter(
                    or_(GSLSign.gloss.ilike(pattern), GSLSign.english_meaning.ilike(pattern))
                ).order_by(GSLSign.gloss.asc()).limit(4).all()

            if signs:
                primary = signs[0]
                entry = primary.to_dict()
                alts = [s.gloss for s in signs[1:]]
                res = self._build_match_response(primary.gloss, entry, 0.85, "Prefix/Contains (SQLite)", alts=alts)
                self._search_cache[qlow] = res
                return res
            
            # Fallback to empty (Removed semantic search fallback)
            return self._empty_response()
        except Exception as e:
            logger.error(f"Error searching SQLite dictionary: {e}")
            return self._empty_response()
        finally:
            db.close()

    def _empty_response(self) -> Dict[str, Any]:
        db = SessionLocal()
        try:
            # Get some random/first alternatives from SQLite
            signs = db.query(GSLSign).limit(3).all()
            alts = [s.gloss for s in signs]
            
            g = alts[0] if alts else None
            sign = signs[0] if signs else None
            entry = sign.to_dict() if sign else {}
            primitives = self._infer_primitives(g or "", entry)
            
            return {
                "gloss": g if g else None,
                "images": self._ensure_images(g or "", entry) if g else [],
                "description": entry.get("description", "") if g else "",
                "page": entry.get("page") if g else None,
                "confidence": 0.0,
                "alternatives": alts[1:] if len(alts) > 1 else [],
                "match_type": "None",
                "variants": int(entry.get("variants") or 0) if g else 0,
                "primitives": primitives,
            }
        except Exception as e:
            logger.error(f"Error building empty response from SQLite: {e}")
            return {
                "gloss": None,
                "images": [],
                "description": "",
                "page": None,
                "confidence": 0.0,
                "alternatives": [],
                "match_type": "None",
                "variants": 0,
                "primitives": None,
            }
        finally:
            db.close()

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


