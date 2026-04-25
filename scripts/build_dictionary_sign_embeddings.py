import os
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import httpx

DATA_DIR = Path("data")
PROCESSED = DATA_DIR / "processed"
IMAGES_DIR = PROCESSED / "images"
OUT_PATH = PROCESSED / "gsl_sign_index.json"

API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"

def embed_text_api(text: str) -> Optional[np.ndarray]:
    """Get text embeddings via Gemini API."""
    if not API_KEY:
        return None
    
    try:
        payload = {
            "model": EMBEDDING_MODEL,
            "content": {
                "parts": [{"text": text}]
            }
        }
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(EMBEDDING_URL, headers={"x-goog-api-key": API_KEY}, json=payload)
            if resp.status_code == 200:
                vec = resp.json()["embedding"]["values"]
                return np.array(vec)
            else:
                print(f"Embedding API error: {resp.status_code} - {resp.text}")
                return None
    except Exception as e:
        print(f"Embedding error: {e}")
        return None

def embed_text_fallback(text: str) -> np.ndarray:
    """Fallback random embedding if API fails."""
    h = abs(hash(text)) % (10**8)
    rng = np.random.default_rng(h)
    return rng.normal(0, 1, 768) # Gemini embeddings are 768d

def embed_image(path: Path) -> np.ndarray:
    """Fallback visual embedding (deterministic hashing)."""
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
        print(f"Dictionary source {src} not found. Skipping embedding build.")
        if not OUT_PATH.exists():
            with open(OUT_PATH, "w", encoding="utf-8") as f:
                json.dump({"index": {}, "count": 0}, f, indent=2)
            print(f"Wrote empty index to {OUT_PATH}")
        else:
            print(f"Preserving existing index at {OUT_PATH}")
        return

    # Check if we already have a built index with content
    if OUT_PATH.exists():
        try:
            with open(OUT_PATH, "r", encoding="utf-8") as f:
                existing = json.load(f)
                if existing.get("count", 0) > 0:
                    print(f"Index already exists with {existing['count']} entries. Skipping rebuild to save API calls.")
                    return
        except Exception:
            pass

    with open(src, "r", encoding="utf-8") as f:
        dictionary: Dict[str, Any] = json.load(f)

    index: Dict[str, Any] = {}
    print(f"Building embeddings for {len(dictionary)} signs...")
    
    for i, (gloss, entry) in enumerate(dictionary.items()):
        desc = entry.get("description") or ""
        english = entry.get("english") or gloss
        text_to_embed = f"{gloss} {english} {desc}"
        
        # Try API first, then fallback
        vec = embed_text_api(text_to_embed)
        if vec is None:
            vec = embed_text_fallback(text_to_embed)
        
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
            "text_vec": vec.tolist(),
            "visual_vec": vis_centroid.tolist(),
            "images": imgs,
            "description": desc
        }
        
        if (i + 1) % 10 == 0:
            print(f"Processed {i+1}/{len(dictionary)} signs...")
            time.sleep(1) # Rate limiting for free tier API

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"index": index, "count": len(index)}, f, ensure_ascii=False, indent=2)
    
    print(f"Wrote sign index to {OUT_PATH}")

if __name__ == "__main__":
    main()

