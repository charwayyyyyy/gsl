import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

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

# Constants for layout cropping
# The dictionary layout seems to have 2 columns.
# Column 1 x-range: approx 50 to 300
# Column 2 x-range: approx 350 to 600
# Header area top: approx 50-100
# Row 1 top: approx 100-350
# Row 2 top: approx 350-600
# Row 3 top: approx 600-850

def get_crop_box(word_info: dict, page_width: float, page_height: float) -> Tuple[float, float, float, float]:
    """
    Determines a reasonable crop box around a gloss.
    The goal is to capture the images ABOVE the gloss.
    Returns (x0, y0, x1, y1) in PDF coordinates.
    """
    x0 = word_info['x0']
    top = word_info['top']
    bottom = word_info['bottom']
    
    # Heuristic: 
    # Width: approx half page width
    # Height: approx 320 points (standard for these squares including the image above)
    
    crop_width = page_width / 2.2
    crop_height = 320
    
    # Adjust x0 if it's in the second column
    if x0 > page_width / 2:
        cx0 = page_width / 2
    else:
        cx0 = 30 # Margin
        
    # Capture region ABOVE the gloss. 
    # We set cy1 to slightly below the gloss text to include it at the bottom of the image.
    cy1 = bottom + 10
    cy0 = cy1 - crop_height
    
    cx1 = cx0 + crop_width
    
    # Constrain to page
    cx0 = max(0, cx0)
    cy0 = max(0, cy0)
    cx1 = min(page_width, cx1)
    cy1 = min(page_height, cy1)
    
    return (cx0, cy0, cx1, cy1)

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
    
    if not pdfplumber or not fitz:
        print("pdfplumber or fitz (PyMuPDF) not installed. Cannot proceed.")
        return {}

    doc = fitz.open(pdf_path)
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            words = page.extract_words()
            
            # Find glosses (all caps words)
            page_glosses = [w for w in words if re.match(r"^[A-Z][A-Z\-\s]+$", w['text']) and len(w['text']) < 50 and len(w['text']) > 1]
            
            if not page_glosses:
                continue

            fitz_page = doc.load_page(page_idx)
            
            for gloss_info in page_glosses:
                gloss = gloss_info['text'].strip()
                
                # Determine crop box for this specific gloss
                crop_box = get_crop_box(gloss_info, page.width, page.height)
                
                # Use PyMuPDF to crop and save
                # PyMuPDF uses (x0, y0, x1, y1) but might need scaling if DPI is different
                # default is 72 DPI, same as pdfplumber
                rect = fitz.Rect(crop_box)
                pix = fitz_page.get_pixmap(clip=rect, matrix=fitz.Matrix(2, 2)) # 2x scale for better quality
                
                gloss_safe = re.sub(r"[^A-Z]", "_", gloss)
                img_name = f"{gloss_safe}_p{page_idx+1}.png"
                
                per_gloss_dir = IMAGES_DIR / gloss
                per_gloss_dir.mkdir(parents=True, exist_ok=True)
                
                out_path = per_gloss_dir / img_name
                pix.save(out_path)
                
                description = normalize_text(text)
                english = gloss.replace("-", " ").lower()
                
                if gloss not in entries:
                    entries[gloss] = {
                        "english": english,
                        "description": description,
                        "images": [img_name],
                        "page": page_idx + 1,
                        "variants": 1
                    }
                else:
                    # If gloss appears multiple times, add the new image
                    if img_name not in entries[gloss]["images"]:
                        entries[gloss]["images"].append(img_name)
                        entries[gloss]["variants"] = len(entries[gloss]["images"])

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
        print(f"PDF not found at {pdf_path}. Skipping extraction.")
        # Do not overwrite existing JSON if it exists
        out_path = PROCESSED_DIR / "gsl_dictionary.json"
        if not out_path.exists():
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump({}, f, ensure_ascii=False, indent=2)
            print(f"Wrote empty dataset to {out_path}")
        else:
            print(f"Preserving existing dataset at {out_path}")
    else:
        entries = pdf_to_strict_json(pdf_path)
        validate_schema(entries)
        out_path = PROCESSED_DIR / "gsl_dictionary.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
        print(f"Successfully extracted {len(entries)} entries to {out_path}")

