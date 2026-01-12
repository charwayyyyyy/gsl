import json
from pathlib import Path
from typing import Dict, Any, List
import numpy as np

DATA_DIR = Path("data")
PROCESSED = DATA_DIR / "processed"
IMAGES_DIR = PROCESSED / "images"
OUT_PATH = PROCESSED / "gsl_sign_index.json"

def try_text_model():
    try:
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None

def embed_text(model, text: str) -> np.ndarray:
    if model is None:
        h = abs(hash(text)) % (10**8)
        rng = np.random.default_rng(h)
        return rng.normal(0, 1, 384)
    return np.array(model.encode(text, normalize_embeddings=True))

def embed_image(path: Path) -> np.ndarray:
    # Fallback-only visual embedding (deterministic hashing)
    try:
        import hashlib
        digest = hashlib.sha256(path.name.encode("utf-8")).digest()
        rng = np.random.default_rng(int.from_bytes(digest[:8], "little"))
        return rng.normal(0, 1, 512)
    except Exception:
        rng = np.random.default_rng(0)
        return rng.normal(0, 1, 512)

def main():
    PROCESSED.mkdir(parents=True, exist_ok=True)
    src = PROCESSED / "gsl_dictionary.json"
    if not src.exists():
        with open(OUT_PATH, "w", encoding="utf-8") as f:
            json.dump({"index": {}, "count": 0}, f, indent=2)
        return
    with open(src, "r", encoding="utf-8") as f:
        dictionary: Dict[str, Any] = json.load(f)
    text_model = try_text_model()
    index: Dict[str, Any] = {}
    for gloss, entry in dictionary.items():
        desc = entry.get("description") or ""
        english = entry.get("english") or gloss
        text_vec = embed_text(text_model, f"{gloss} {english} {desc}")
        imgs: List[str] = entry.get("images") or []
        vis_vecs = []
        for img in imgs:
            p = (IMAGES_DIR / img)
            vis_vecs.append(embed_image(p))
        if vis_vecs:
            vis_centroid = np.stack(vis_vecs).mean(axis=0)
        else:
            vis_centroid = embed_image(Path(gloss + ".png"))
        index[gloss] = {
            "english": english,
            "page": entry.get("page", None),
            "text_vec": text_vec.tolist(),
            "visual_vec": vis_centroid.tolist(),
            "images": imgs,
            "description": desc
        }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"index": index, "count": len(index)}, f, ensure_ascii=False, indent=2)
    print(f"Wrote sign index to {OUT_PATH}")

if __name__ == "__main__":
    main()

