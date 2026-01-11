import json
from pathlib import Path
from typing import List, Dict
import logging

from .config import ensure_dirs, JSON_CHUNKS_DIR, EMBEDDINGS_DIR, EMBED_MODEL

logger = logging.getLogger(__name__)

try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
except Exception:
    SentenceTransformer = None
    np = None

def load_entries() -> List[Dict]:
    entries: List[Dict] = []
    for p in sorted(JSON_CHUNKS_DIR.glob("gsl_dict_entries_*.json")):
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
            entries.extend(data.get("entries", []))
    return entries

def build_embeddings():
    ensure_dirs()
    if SentenceTransformer is None or np is None:
        raise ImportError("sentence-transformers and numpy are required")
    model = SentenceTransformer(EMBED_MODEL)
    entries = load_entries()
    texts = [f"{e['gloss']} :: {e['english_meaning']}" for e in entries]
    vecs = model.encode(texts, batch_size=64, show_progress_bar=True, normalize_embeddings=True)
    arr = np.asarray(vecs, dtype=np.float32)
    EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
    out = EMBEDDINGS_DIR / "gsl_dictionary_embeddings.npy"
    np.save(out, arr)
    with open(EMBEDDINGS_DIR / "gsl_dictionary_ids.json", "w", encoding="utf-8") as f:
        json.dump([e["id"] for e in entries], f)
    logger.info(f"Saved embeddings: {out}")

if __name__ == "__main__":
    build_embeddings()

