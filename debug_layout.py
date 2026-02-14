import pdfplumber
from pathlib import Path

pdf_path = Path("Ghanaian Sign Language Dictionary - 3rd Edition.pdf")
if not pdf_path.exists():
    pdf_path = Path("data/raw/gsl_dictionary.pdf")

if pdf_path.exists():
    with pdfplumber.open(pdf_path) as pdf:
        for p_idx in [50, 60, 70, 80]:
            page = pdf.pages[p_idx]
            print(f"\n--- Page {p_idx + 1} ---")
            words = page.extract_words()
            glosses = [w for w in words if w['text'].isupper() and len(w['text']) > 1]
            print(f"Glosses found: {[g['text'] for g in glosses[:10]]}")
            for g in glosses[:5]:
                 print(f"  {g['text']} at x0={g['x0']:.1f}, top={g['top']:.1f}")
else:
    print("PDF not found")
