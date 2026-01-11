import math
from pathlib import Path
from typing import List, Tuple
import logging

from .config import ensure_dirs, RAW_PDF_DIR, PDF_CHUNKS_DIR, CHUNK_PAGE_MIN, CHUNK_PAGE_MAX

logger = logging.getLogger(__name__)

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

def split_pdf_into_chunks(pdf_path: Path) -> List[Tuple[int, int, Path]]:
    ensure_dirs()
    if not pdf_path.exists():
        raise FileNotFoundError(str(pdf_path))

    if fitz is None:
        raise ImportError("PyMuPDF (fitz) is required for PDF chunking")

    doc = fitz.open(pdf_path)
    total_pages = doc.page_count
    chunk_ranges: List[Tuple[int, int]] = []

    pages_left = total_pages
    start = 0
    while pages_left > 0:
        size = min(CHUNK_PAGE_MAX, max(CHUNK_PAGE_MIN, pages_left))
        end = start + size - 1
        chunk_ranges.append((start, end))
        start = end + 1
        pages_left = total_pages - start

    output_files: List[Tuple[int, int, Path]] = []
    for idx, (s, e) in enumerate(chunk_ranges, start=1):
        new_doc = fitz.open()
        for p in range(s, e + 1):
            new_doc.insert_pdf(doc, from_page=p, to_page=p)
        out_path = PDF_CHUNKS_DIR / f"gsl_dict_chunk_{idx:03d}_{s+1:04d}-{e+1:04d}.pdf"
        new_doc.save(out_path)
        new_doc.close()
        output_files.append((s + 1, e + 1, out_path))
        logger.info(f"Wrote chunk {idx}: pages {s+1}-{e+1} -> {out_path}")

    doc.close()
    return output_files

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=str, help="Path to full GSL dictionary PDF")
    args = parser.parse_args()
    pdf_path = Path(args.pdf)
    files = split_pdf_into_chunks(pdf_path)
    print(f"Created {len(files)} chunks")

