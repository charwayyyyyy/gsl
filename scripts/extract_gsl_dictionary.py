import json
import re
from pathlib import Path
from typing import Dict, List, Optional

try:
    import pdfplumber
except Exception:
    pdfplumber = None

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

DATA_DIR = Path("data")
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
IMAGES_DIR = DATA_DIR / "images" / "signs"

STRICT_SCHEMA_KEYS = [
    "gloss",
    "english",
    "usage",
    "facial_expression",
    "image_path",
    "source_page",
]

ENTRY_PATTERNS = [
    r"([A-Z][A-Z\s]+)\s*\(([^)]+)\)",
    r"([A-Z][A-Z\s]+):\s*([^\n]+)",
    r"([A-Z][A-Z\s]+)\s*-\s*([^\n]+)",
]

def ensure_dirs():
    for p in [DATA_DIR, RAW_DIR, PROCESSED_DIR, IMAGES_DIR]:
        p.mkdir(parents=True, exist_ok=True)

def extract_images_from_page(doc, page_index: int) -> List[str]:
    paths: List[str] = []
    if doc is None:
        return paths
    page = doc.load_page(page_index)
    for img in page.get_images(full=True):
        xref = img[0]
        pix = fitz.Pixmap(doc, xref)
        if pix.n >= 5:
            pix = fitz.Pixmap(fitz.csRGB, pix)
        out_path = IMAGES_DIR / f"page{page_index+1}_img_{xref}.png"
        pix.save(out_path)
        pix = None
        paths.append(str(out_path))
    return paths

def normalize_text(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    return s

def pdf_to_strict_json(pdf_path: Path) -> List[Dict]:
    ensure_dirs()
    entries: List[Dict] = []
    text_pages: List[str] = []

    if pdfplumber:
        with pdfplumber.open(pdf_path) as pdf:
            for p in pdf.pages:
                t = p.extract_text() or ""
                text_pages.append(t)

    doc = fitz.open(pdf_path) if fitz else None

    for page_idx, text in enumerate(text_pages):
        images = extract_images_from_page(doc, page_idx)
        first_image = images[0] if images else None
        for pat in ENTRY_PATTERNS:
            for m in re.finditer(pat, text):
                gloss = normalize_text(m.group(1))
                english = normalize_text(m.group(2))
                entry = {
                    "gloss": gloss,
                    "english": english,
                    "usage": None,
                    "facial_expression": None,
                    "image_path": first_image,
                    "source_page": page_idx + 1,
                }
                entries.append(entry)

    return entries

def validate_schema(entries: List[Dict]) -> None:
    for e in entries:
        for k in STRICT_SCHEMA_KEYS:
            assert k in e, f"Missing key {k} in entry"

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Extract GSL dictionary to strict JSON schema")
    parser.add_argument("--pdf", type=str, default=str(RAW_DIR / "gsl_dictionary.pdf"))
    args = parser.parse_args()
    pdf_path = Path(args.pdf)
    ensure_dirs()
    if not pdf_path.exists():
        print(f"PDF not found at {pdf_path}. Place the official dictionary as 'data/raw/gsl_dictionary.pdf'.")
        # Write empty JSON to keep pipeline consistent
        out_path = PROCESSED_DIR / "gsl_dictionary.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"entries": [], "count": 0}, f, ensure_ascii=False, indent=2)
        print(f"Wrote empty dataset to {out_path}")
    else:
        entries = pdf_to_strict_json(pdf_path)
        validate_schema(entries)
        out_path = PROCESSED_DIR / "gsl_dictionary.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"entries": entries, "count": len(entries)}, f, ensure_ascii=False, indent=2)
        print(f"Wrote {len(entries)} entries to {out_path}")

