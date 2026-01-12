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
        # Fallback to page snapshot if no images extracted
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
        
        # Find ALL glosses on the page
        page_glosses = []
        for ln in lines:
            clean_ln = ln.strip()
            # Match All-Caps words, allowing hyphens and spaces, min length 2
            # Avoid overly long sentences that happen to be all caps (e.g. headers)
            # Heuristic: < 50 chars
            if re.match(r"^[A-Z][A-Z\-\s]+$", clean_ln) and len(clean_ln) < 50 and len(clean_ln) > 1:
                page_glosses.append(clean_ln)

        if not page_glosses:
            continue

        for gloss in page_glosses:
            description = normalize_text(text) # Store full page text as context
            english = gloss.replace("-", " ").lower()
            
            # Ensure image directory exists for this gloss
            per_gloss = IMAGES_DIR / gloss
            try:
                per_gloss.mkdir(parents=True, exist_ok=True)
                # Copy page image to gloss folder
                for img in images:
                    src = IMAGES_DIR / img
                    if src.exists():
                        dst = per_gloss / src.name
                        if not dst.exists():
                            try:
                                dst.write_bytes(src.read_bytes())
                            except Exception:
                                pass
            except Exception:
                pass

            # Update entry - if exists, we might want to keep the one with better description or merge
            # For now, simple overwrite or keep first? 
            # If a word spans multiple pages, we might want the first occurrence.
            if gloss not in entries:
                entries[gloss] = {
                    "english": english,
                    "description": description,
                    "images": images, # Point to the page snapshot(s)
                    "page": page_idx + 1,
                    "variants": len(images)
                }
            else:
                # If already exists, maybe append images? 
                # But UI expects single page context usually.
                # Let's keep the existing one to avoid overwriting "FOOD" (header) with "FOOD" (header on next page)
                pass

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
    
    # Try finding the PDF in root if not in data/raw
    if not pdf_path.exists():
        root_pdf = Path("Ghanaian Sign Language Dictionary - 3rd Edition.pdf")
        if root_pdf.exists():
            pdf_path = root_pdf
            print(f"Found PDF in root: {pdf_path}")

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

