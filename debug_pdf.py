import pdfplumber
from pathlib import Path

pdf_path = Path("Ghanaian Sign Language Dictionary - 3rd Edition.pdf")
if not pdf_path.exists():
    pdf_path = Path("data/raw/gsl_dictionary.pdf")

if pdf_path.exists():
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[57] # Page 58
        print(f"Page 58 size: {page.width}x{page.height}")
        
        print("\n--- Images ---")
        for i, img in enumerate(page.images):
            print(f"Image {i}: x0={img['x0']}, y0={img['y0']}, x1={img['x1']}, y1={img['y1']}")
            
        print("\n--- Rects ---")
        for i, rect in enumerate(page.rects):
            print(f"Rect {i}: x0={rect['x0']}, y0={rect['y0']}, x1={rect['x1']}, y1={rect['y1']}")
            
        print("\n--- Words (first 10) ---")
        words = page.extract_words()
        for i, word in enumerate(words[:10]):
            print(f"Word {i}: {word['text']} at x0={word['x0']}, y0={word['top']}, x1={word['x1']}, y1={word['bottom']}")
else:
    print("PDF not found")
