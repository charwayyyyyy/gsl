import re
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging

from .config import ensure_dirs, JSON_CHUNKS_DIR, IMAGES_DIR

logger = logging.getLogger(__name__)

try:
    import pdfplumber
except Exception:
    pdfplumber = None

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

ENTRY_PATTERNS = [
    r"([A-Z][A-Z\s]+)\s*\(([^)]+)\)",
    r"([A-Z][A-Z\s]+):\s*([^\n]+)",
    r"([A-Z][A-Z\s]+)\s*-\s*([^\n]+)",
]

def extract_images_from_page(doc, page_index: int, out_dir: Path) -> List[str]:
    paths: List[str] = []
    if fitz is None:
        return paths
    page = doc.load_page(page_index)
    for img in page.get_images(full=True):
        xref = img[0]
        pix = fitz.Pixmap(doc, xref)
        if pix.n >= 5:
            pix = fitz.Pixmap(fitz.csRGB, pix)
        out_path = out_dir / f"page{page_index+1}_img_{xref}.png"
        pix.save(out_path)
        pix = None
        paths.append(str(out_path))
    return paths

def parse_pdf_to_entries(pdf_path: Path) -> List[Dict[str, Any]]:
    ensure_dirs()
    entries: List[Dict[str, Any]] = []

    text_pages: List[str] = []
    if pdfplumber:
        with pdfplumber.open(pdf_path) as pdf:
            for p in pdf.pages:
                t = p.extract_text() or ""
                text_pages.append(t)

    doc = fitz.open(pdf_path) if fitz else None

    for page_idx, text in enumerate(text_pages):
        for pat in ENTRY_PATTERNS:
            for m in re.finditer(pat, text):
                gloss = m.group(1).strip()
                meaning = m.group(2).strip()
                img_dir = IMAGES_DIR / f"page_{page_idx+1}"
                img_dir.mkdir(parents=True, exist_ok=True)
                images = extract_images_from_page(doc, page_idx, img_dir) if doc else []

                entry = {
                    "id": gloss.replace(" ", "_"),
                    "gloss": gloss,
                    "english_meaning": meaning,
                    "usage_notes": None,
                    "facial_markers": [],
                    "handshape": None,
                    "location": None,
                    "movement": None,
                    "orientation": None,
                    "both_hands": None,
                    "images": images,
                    "source_page": page_idx + 1,
                }
                entries.append(entry)
        
    return entries

def write_json_chunks(entries: List[Dict[str, Any]], chunk_size: int = 500) -> List[Path]:
    JSON_CHUNKS_DIR.mkdir(parents=True, exist_ok=True)
    paths: List[Path] = []
    for i in range(0, len(entries), chunk_size):
        chunk = entries[i:i+chunk_size]
        out_path = JSON_CHUNKS_DIR / f"gsl_dict_entries_{(i//chunk_size)+1:03d}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"entries": chunk, "count": len(chunk)}, f, ensure_ascii=False, indent=2)
        paths.append(out_path)
    return paths

def merge_json_chunks() -> List[Dict[str, Any]]:
    all_entries: List[Dict[str, Any]] = []
    for p in sorted(JSON_CHUNKS_DIR.glob("gsl_dict_entries_*.json")):
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
            all_entries.extend(data.get("entries", []))
    return all_entries

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=str)
    parser.add_argument("--chunk", type=int, default=500)
    args = parser.parse_args()
    pdf_path = Path(args.pdf)
    entries = parse_pdf_to_entries(pdf_path)
    out_paths = write_json_chunks(entries, args.chunk)
    print(f"Wrote {len(out_paths)} JSON chunks")

