import json
from pathlib import Path
from typing import Dict, Any
import numpy as np

PROCESSED = Path("data") / "processed"
DICT_PATH = PROCESSED / "gsl_dictionary.json"
INDEX_PATH = PROCESSED / "gsl_sign_index.json"

class TextToSignService:
    def __init__(self):
        self.dictionary: Dict[str, Any] = {}
        self.index: Dict[str, Any] = {}
        self._load()

    def _load(self):
        if DICT_PATH.exists():
            with open(DICT_PATH, "r", encoding="utf-8") as f:
                self.dictionary = json.load(f)
        if INDEX_PATH.exists():
            with open(INDEX_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.index = data.get("index", {})

    def _cos(self, a: np.ndarray, b: np.ndarray) -> float:
        na = np.linalg.norm(a); nb = np.linalg.norm(b)
        if na == 0 or nb == 0:
            return 0.0
        return float((a @ b) / (na * nb))

    def search(self, q: str) -> Dict[str, Any]:
        if not q:
            return {"results": [], "count": 0}
        qn = q.strip().lower()
        # exact match by english or gloss
        for gloss, entry in self.dictionary.items():
            if entry.get("english", "").lower() == qn or gloss.lower() == qn:
                return {
                    "gloss": gloss,
                    "images": entry.get("images", []),
                    "description": entry.get("description", ""),
                    "confidence": 1.0,
                    "page": entry.get("page")
                }
        # semantic search via text embeddings
        if not self.index:
            return {"gloss": None, "images": [], "description": "", "confidence": 0.0}
        # make query vector using same fallback hashing
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer("all-MiniLM-L6-v2")
            qvec = np.array(model.encode(qn, normalize_embeddings=True))
        except Exception:
            h = abs(hash(qn)) % (10**8)
            rng = np.random.default_rng(h)
            qvec = rng.normal(0, 1, 384)
        best_gloss, best_score = None, -1.0
        for gloss, rec in self.index.items():
            tv = np.array(rec.get("text_vec", []), dtype=float)
            if tv.size == 0:
                continue
            s = self._cos(qvec, tv)
            if s > best_score:
                best_gloss, best_score = gloss, s
        if best_gloss:
            e = self.dictionary.get(best_gloss, {})
            return {
                "gloss": best_gloss,
                "images": e.get("images", []),
                "description": e.get("description", ""),
                "confidence": max(0.0, min(1.0, best_score)),
                "page": e.get("page")
            }
        return {"gloss": None, "images": [], "description": "", "confidence": 0.0}

