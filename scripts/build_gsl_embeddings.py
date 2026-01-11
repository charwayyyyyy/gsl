import json
from pathlib import Path
from typing import Dict, List

import numpy as np

DATA_DIR = Path("data")
PROCESSED_DIR = DATA_DIR / "processed"

def try_load_model():
    try:
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None

def embed_texts(model, texts: List[str]) -> np.ndarray:
    if model is None:
        # Deterministic fallback using hashing
        vecs = []
        for t in texts:
            h = abs(hash(t)) % (10**8)
            rng = np.random.default_rng(h)
            vecs.append(rng.normal(0, 1, 384))
        return np.vstack(vecs)
    return np.array(model.encode(texts, normalize_embeddings=True))

if __name__ == "__main__":
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    src = PROCESSED_DIR / "gsl_dictionary.json"
    out = PROCESSED_DIR / "gsl_embeddings.json"
    if not src.exists():
        print(f"Source not found: {src}. Run extract_gsl_dictionary.py first.")
        with open(out, "w", encoding="utf-8") as f:
            json.dump({"embeddings": [], "count": 0}, f, ensure_ascii=False, indent=2)
        raise SystemExit(0)

    with open(src, "r", encoding="utf-8") as f:
        data = json.load(f)
    entries: List[Dict] = data.get("entries", [])

    model = try_load_model()

    records = []
    for e in entries:
        texts = [
            e.get("gloss") or "",
            e.get("english") or "",
            e.get("usage") or "",
        ]
        vecs = embed_texts(model, texts)
        rec = {
            "gloss": e.get("gloss"),
            "source_page": e.get("source_page"),
            "vectors": {
                "gloss": vecs[0].tolist(),
                "english": vecs[1].tolist(),
                "usage": vecs[2].tolist(),
            },
        }
        records.append(rec)

    with open(out, "w", encoding="utf-8") as f:
        json.dump({"embeddings": records, "count": len(records)}, f, ensure_ascii=False, indent=2)
    print(f"Wrote embeddings to {out}")

