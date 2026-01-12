import json
from pathlib import Path
from typing import Dict, Any, List
import numpy as np

PROCESSED = Path("data") / "processed"
DICT_PATH = PROCESSED / "gsl_dictionary.json"
INDEX_PATH = PROCESSED / "gsl_sign_index.json"

class TextToSignService:
    def __init__(self):
        self.dictionary: Dict[str, Any] = {}
        self.index: Dict[str, Any] = {}
        self._cache_vecs: Dict[str, np.ndarray] = {}
        self._page_cache: Dict[str, int] = {}
        self._load()

    def _load(self):
        if DICT_PATH.exists():
            with open(DICT_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict) and "entries" in loaded and isinstance(loaded["entries"], list):
                    d: Dict[str, Any] = {}
                    for e in loaded["entries"]:
                        gloss = e.get("gloss")
                        if gloss:
                            d[gloss] = {
                                "english": e.get("english") or "",
                                "description": e.get("usage") or "",
                                "images": [e.get("image_path")] if e.get("image_path") else [],
                                "page": e.get("source_page")
                            }
                    self.dictionary = d
                else:
                    self.dictionary = loaded or {}
        if INDEX_PATH.exists():
            with open(INDEX_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.index = data.get("index", {})

    def _cos(self, a: np.ndarray, b: np.ndarray) -> float:
        na = np.linalg.norm(a); nb = np.linalg.norm(b)
        if na == 0 or nb == 0:
            return 0.0
        return float((a @ b) / (na * nb))

    def _ensure_images(self, gloss: str, entry: Dict[str, Any]) -> List[str]:
        images = entry.get("images") or []
        out: List[str] = []
        base = PROCESSED / "images" / gloss
        for img in images:
            p = base / img
            if p.exists():
                out.append(img)
        if out:
            return out
        try:
            page = int(entry.get("page") or 0)
            if page <= 0:
                page = self._find_page(gloss)
            if page > 0:
                import fitz
                src_pdf = Path("Ghanaian Sign Language Dictionary - 3rd Edition.pdf")
                raw_pdf = Path("data")/"raw"/"gsl_dictionary.pdf"
                pdf_path = src_pdf if src_pdf.exists() else raw_pdf
                if pdf_path.exists():
                    base.mkdir(parents=True, exist_ok=True)
                    doc = fitz.open(pdf_path)
                    pix = doc.load_page(page-1).get_pixmap()
                    fname = f"page{page}.png"
                    dst = base / fname
                    pix.save(dst)
                    out.append(fname)
        except Exception:
            pass
        if not out:
            try:
                import fitz
                src_pdf = Path("Ghanaian Sign Language Dictionary - 3rd Edition.pdf")
                raw_pdf = Path("data")/"raw"/"gsl_dictionary.pdf"
                pdf_path = src_pdf if src_pdf.exists() else raw_pdf
                if pdf_path.exists():
                    base.mkdir(parents=True, exist_ok=True)
                    doc = fitz.open(pdf_path)
                    pix = doc.load_page(0).get_pixmap()
                    fname = f"page1.png"
                    dst = base / fname
                    pix.save(dst)
                    out.append(fname)
            except Exception:
                pass
        return out

    def _find_page(self, gloss: str) -> int:
        g = gloss.strip().upper()
        if g in self._page_cache:
            return self._page_cache[g]
        try:
            import pdfplumber
            for cand in [
                Path("Ghanaian Sign Language Dictionary - 3rd Edition.pdf"),
                Path("data")/"raw"/"gsl_dictionary.pdf"
            ]:
                if cand.exists():
                    with pdfplumber.open(cand) as pdf:
                        for i, p in enumerate(pdf.pages):
                            t = p.extract_text() or ""
                            lines = [l.strip() for l in t.splitlines() if l.strip()]
                            for ln in lines:
                                if ln == g or ln.startswith(g+" "):
                                    self._page_cache[g] = i+1
                                    return i+1
        except Exception:
            pass
        return 0

    def search(self, q: str) -> Dict[str, Any]:
        qn = (q or "").strip()
        if qn == "":
            alts: List[str] = list(self.dictionary.keys())[:3]
            g = alts[0] if alts else None
            e = self.dictionary.get(g or "", {})
            return {
                "gloss": g,
                "images": self._ensure_images(g or "", e) if g else [],
                "description": e.get("description", "") if g else "",
                "page": e.get("page") if g else None,
                "confidence": 1.0 if g else 0.0,
                "alternatives": alts[1:] if len(alts) > 1 else []
            }
        cand = []
        qlow = qn.lower()
        qup = qn.upper()
        forms = {qlow, qup}
        if qlow.endswith("es"):
            forms.add(qlow[:-2])
        if qlow.endswith("s"):
            forms.add(qlow[:-1])
        for gloss, entry in self.dictionary.items():
            if gloss.lower() in forms or entry.get("english","").lower() in forms:
                imgs = self._ensure_images(gloss, entry)
                return {
                    "gloss": gloss,
                    "images": imgs,
                    "description": entry.get("description",""),
                    "page": entry.get("page"),
                    "confidence": 1.0,
                    "alternatives": []
                }
        for gloss, entry in self.dictionary.items():
            if gloss.lower().startswith(qlow) or entry.get("english","").lower().startswith(qlow):
                cand.append(gloss)
        
        # If no startswith matches, try "contains"
        if not cand:
            for gloss, entry in self.dictionary.items():
                if qlow in gloss.lower() or qlow in entry.get("english","").lower():
                    cand.append(gloss)

        if cand:
            # Sort candidates: shortest match first (likely more relevant)
            cand.sort(key=len)
            g = cand[0]
            e = self.dictionary.get(g, {})
            imgs = self._ensure_images(g, e)
            return {
                "gloss": g,
                "images": imgs,
                "description": e.get("description",""),
                "page": e.get("page"),
                "confidence": 0.35,
                "alternatives": cand[1:4]
            }
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer("all-MiniLM-L6-v2")
            qvec = np.array(model.encode(qlow, normalize_embeddings=True))
        except Exception:
            h = abs(hash(qlow)) % (10**8)
            rng = np.random.default_rng(h)
            qvec = rng.normal(0, 1, 384)
        scores = []
        for gloss, rec in self.index.items():
            tv = np.array(rec.get("text_vec", []), dtype=float)
            if tv.size == 0:
                tv = self._cache_vecs.get(gloss)
                if tv is None:
                    h = abs(hash(gloss)) % (10**8)
                    tv = np.random.default_rng(h).normal(0,1,384)
                    self._cache_vecs[gloss] = tv
            s = self._cos(qvec, tv)
            scores.append((gloss, float(s)))
        scores.sort(key=lambda x: x[1], reverse=True)
        if scores:
            g, sc = scores[0]
            e = self.dictionary.get(g, {})
            imgs = self._ensure_images(g, e)
            alts = [x[0] for x in scores[1:4]]
            return {
                "gloss": g,
                "images": imgs,
                "description": e.get("description",""),
                "page": e.get("page"),
                "confidence": float(min(0.39, max(0.0, sc))),
                "alternatives": alts
            }
        return {
            "gloss": None,
            "images": [],
            "description": "",
            "page": None,
            "confidence": 0.0,
            "alternatives": []
        }

