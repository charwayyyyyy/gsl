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
IMAGES_DIR = PROCESSED_DIR / "images"

ENTRY_PATTERNS = [
    r"^([A-Z][A-Z\-\s]+)\s*$",
    r"([A-Z][A-Z\s]+):\s*([^\n]+)",
]

def ensure_dirs():
    for p in [DATA_DIR, RAW_DIR, PROCESSED_DIR, IMAGES_DIR]:
        p.mkdir(parents=True, exist_ok=True)

def extract_images_from_page(doc, page_index: int) -> List[str]:
    paths: List[str] = []
    if doc is None:
        return paths
    try:
        page = doc.load_page(page_index)
        for img in page.get_images(full=True):
            xref = img[0]
            pix = fitz.Pixmap(doc, xref)
            if pix.n >= 5:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            out_path = IMAGES_DIR / f"page{page_index+1}_img_{xref}.png"
            pix.save(out_path)
            pix = None
            paths.append(out_path.name)
    except Exception:
        pass
    return paths

def normalize_text(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    return s

def pdf_to_strict_json(pdf_path: Path) -> Dict[str, Dict]:
    ensure_dirs()
    entries: Dict[str, Dict] = {}
    text_pages: List[str] = []

    if pdfplumber:
        with pdfplumber.open(pdf_path) as pdf:
            for p in pdf.pages:
                t = p.extract_text() or ""
                text_pages.append(t)

    doc = fitz.open(pdf_path) if fitz else None

    for page_idx, text in enumerate(text_pages):
        images = extract_images_from_page(doc, page_idx)
        if not images and fitz:
            try:
                page = fitz.open(pdf_path).load_page(page_idx)
                pix = page.get_pixmap()
                out_path = IMAGES_DIR / f"page{page_idx+1}.png"
                pix.save(out_path)
                images = [out_path.name]
            except Exception:
                images = []
        lines = [l for l in text.splitlines() if l.strip()]
        gloss = None
        for ln in lines:
            if re.match(r"^[A-Z][A-Z\-\s]+$", ln.strip()):
                gloss = ln.strip()
                break
        if gloss:
            desc_lines = [l for l in lines if l.strip() != gloss]
            description = normalize_text(" ".join(desc_lines))
            english = gloss.replace("-", " ").lower()
            # Move images into per-gloss directory
            per_gloss = IMAGES_DIR / gloss
            try:
                per_gloss.mkdir(parents=True, exist_ok=True)
                moved: List[str] = []
                for img in images:
                    src = IMAGES_DIR / img
                    if src.exists():
                        dst = per_gloss / src.name
                        if not dst.exists():
                            try:
                                dst.write_bytes(src.read_bytes())
                            except Exception:
                                pass
                        moved.append(dst.name)
                images = moved if moved else images
            except Exception:
                pass
            entries[gloss] = {
                "english": english,
                "description": description,
                "images": images,
                "page": page_idx + 1,
                "variants": len(images)
            }

    return entries

def validate_schema(entries: Dict[str, Dict]) -> None:
    for g, e in entries.items():
        for k in ["english", "description", "images", "page"]:
            assert k in e, f"Missing key {k} in entry {g}"

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
            json.dump(entries, f, ensure_ascii=False, indent=2)
        print(f"Wrote {len(entries)} entries to {out_path}")

