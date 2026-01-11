from pathlib import Path

DATA_ROOT = Path("data")
RAW_PDF_DIR = DATA_ROOT / "raw_pdf"
PDF_CHUNKS_DIR = DATA_ROOT / "chunks_pdf"
JSON_CHUNKS_DIR = DATA_ROOT / "gsl_json"
EMBEDDINGS_DIR = DATA_ROOT / "embeddings"
IMAGES_DIR = DATA_ROOT / "images"

CHUNK_PAGE_MIN = 50
CHUNK_PAGE_MAX = 100

JSON_CHUNK_SIZE = 500

EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

def ensure_dirs():
    for p in [DATA_ROOT, RAW_PDF_DIR, PDF_CHUNKS_DIR, JSON_CHUNKS_DIR, EMBEDDINGS_DIR, IMAGES_DIR]:
        p.mkdir(parents=True, exist_ok=True)

