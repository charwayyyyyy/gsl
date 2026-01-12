import json
from pathlib import Path
from typing import Dict, List, Any, Tuple
import numpy as np

TEMPLATES_PATH = Path("data") / "processed" / "dictionary_motion_templates.json"

def dtw_distance(a: np.ndarray, b: np.ndarray) -> float:
    # Simple DTW with Euclidean cost
    n, m = a.shape[0], b.shape[0]
    D = np.full((n+1, m+1), np.inf, dtype=float)
    D[0,0] = 0.0
    for i in range(1, n+1):
        for j in range(1, m+1):
            cost = np.linalg.norm(a[i-1] - b[j-1])
            D[i,j] = cost + min(D[i-1,j], D[i,j-1], D[i-1,j-1])
    return float(D[n,m] / (n + m))

def normalize_sequence(seq: List[List[float]]) -> np.ndarray:
    arr = np.array(seq, dtype=float)
    if arr.size == 0:
        return np.zeros((1,3))
    # mean-centering and scale
    mean = arr.mean(axis=0)
    arr = arr - mean
    std = arr.std(axis=0) + 1e-6
    arr = arr / std
    # temporal downsample to fixed length
    L = 30
    if arr.shape[0] > L:
        idx = np.linspace(0, arr.shape[0]-1, L).astype(int)
        arr = arr[idx]
    return arr

class DictionaryMatcher:
    def __init__(self):
        self.templates: Dict[str, Any] = {}
        self._load()

    def _load(self):
        if TEMPLATES_PATH.exists():
            with open(TEMPLATES_PATH, "r", encoding="utf-8") as f:
                self.templates = json.load(f)

    def best_match(self, seq: List[List[float]]) -> Tuple[str, float]:
        if not self.templates:
            return "UNKNOWN", 0.0
        q = normalize_sequence(seq)
        best_gloss, best_score = "UNKNOWN", -1.0
        for gloss, templ in self.templates.items():
            t = np.array(templ.get("sequence", []), dtype=float)
            if t.size == 0:
                continue
            dist = dtw_distance(q, t)
            score = float(1.0 / (1.0 + dist))  # map distance to (0,1]
            if score > best_score:
                best_gloss, best_score = gloss, score
        # threshold
        if best_score < 0.6:
            return "UNKNOWN", best_score
        return best_gloss, best_score

