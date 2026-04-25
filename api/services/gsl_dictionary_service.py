import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import selectinload

from ..database.database import SessionLocal
from ..database.models import GSLSign

logger = logging.getLogger(__name__)

PROCESSED_DICTIONARY_PATH = Path("data") / "processed" / "gsl_dictionary.json"


def _slugify_gloss(gloss: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (gloss or "").strip().lower()).strip("_")


class GSLDictionaryService:
    def __init__(self, dictionary_path: str = str(PROCESSED_DICTIONARY_PATH)):
        self.dictionary_path = Path(dictionary_path)
        self._seed_database_if_needed()

    def _load_processed_dictionary(self) -> Dict[str, Dict]:
        if not self.dictionary_path.exists():
            logger.warning(f"Processed dictionary not found at {self.dictionary_path}")
            return {}
        try:
            with open(self.dictionary_path, "r", encoding="utf-8") as handle:
                loaded = json.load(handle)
            if isinstance(loaded, dict):
                return loaded
        except Exception as exc:
            logger.error(f"Failed to load processed dictionary: {exc}")
        return {}

    def _seed_database_if_needed(self) -> None:
        db = SessionLocal()
        try:
            if db.query(GSLSign).first() is not None:
                return

            processed = self._load_processed_dictionary()
            if not processed:
                return

            records: List[GSLSign] = []
            for gloss, entry in processed.items():
                if not gloss:
                    continue
                images = entry.get("images") or []
                english_meaning = str(entry.get("english") or gloss).strip()
                description = str(entry.get("description") or "").strip()

                records.append(
                    GSLSign(
                        id=_slugify_gloss(gloss),
                        gloss=gloss,
                        english_meaning=english_meaning,
                        category=self._infer_category(gloss, english_meaning),
                        complexity_level=self._infer_complexity(gloss, english_meaning, description),
                        handshape=None,
                        location=None,
                        movement=description or None,
                        orientation=None,
                        both_hands=False,
                        image_path=images[0] if images else None,
                        video_path=None,
                    )
                )

            if records:
                db.add_all(records)
                db.commit()
                logger.info(f"Seeded SQLite dictionary with {len(records)} entries")
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to seed SQLite dictionary: {exc}")
        finally:
            db.close()

    def _infer_category(self, gloss: str, english_meaning: str) -> str:
        text = f"{gloss} {english_meaning}".lower()
        categories = {
            "greeting": ["hello", "good", "morning", "afternoon", "evening", "bye"],
            "identity": ["name", "i", "me", "you", "he", "she", "they", "we"],
            "question": ["what", "where", "when", "why", "how", "who"],
            "emotion": ["happy", "sad", "angry", "love", "like", "want", "need"],
            "action": ["go", "come", "eat", "drink", "sleep", "work", "study"],
        }
        for category, markers in categories.items():
            if any(marker in text for marker in markers):
                return category
        return "general"

    def _infer_complexity(self, gloss: str, english_meaning: str, description: str) -> str:
        gloss_terms = len(gloss.split())
        english_terms = len(english_meaning.split())
        description_terms = len(description.split())
        if gloss_terms <= 2 and english_terms <= 3 and description_terms <= 12:
            return "basic"
        if gloss_terms <= 3 and english_terms <= 6 and description_terms <= 24:
            return "intermediate"
        return "advanced"

    async def search_signs(self, query: str, limit: int = 10) -> List[Dict]:
        pattern = f"%{(query or '').strip()}%"
        db = SessionLocal()
        try:
            signs = (
                db.query(GSLSign)
                .filter(or_(GSLSign.gloss.ilike(pattern), GSLSign.english_meaning.ilike(pattern)))
                .order_by(GSLSign.gloss.asc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "id": sign.id,
                    "gloss": sign.gloss,
                    "english_meaning": sign.english_meaning,
                }
                for sign in signs
            ]
        finally:
            db.close()

    async def get_sign_by_id(self, sign_id: str) -> Optional[Dict]:
        lookup = (sign_id or "").strip()
        if not lookup:
            return None

        db = SessionLocal()
        try:
            sign = (
                db.query(GSLSign)
                .options(
                    selectinload(GSLSign.variants),
                    selectinload(GSLSign.facial_expressions),
                    selectinload(GSLSign.usage_examples),
                )
                .filter(GSLSign.id == lookup)
                .first()
            )
            if sign is None:
                sign = (
                    db.query(GSLSign)
                    .options(
                        selectinload(GSLSign.variants),
                        selectinload(GSLSign.facial_expressions),
                        selectinload(GSLSign.usage_examples),
                    )
                    .filter(GSLSign.gloss.ilike(lookup))
                    .first()
                )
            return sign.to_dict() if sign else None
        finally:
            db.close()
