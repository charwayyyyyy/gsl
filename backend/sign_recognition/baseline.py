from typing import List, Dict, Any, Tuple
import numpy as np
import json
from pathlib import Path

def average_landmarks(seq: List[List[float]]) -> np.ndarray:
    if not seq:
        return np.zeros(3)
    arr = np.array(seq, dtype=float)
    return arr.mean(axis=0)

def cosine(a: np.ndarray, b: np.ndarray) -> float:
    na = np.linalg.norm(a); nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float((a @ b) / (na * nb))

def classify(sequence: Dict[str, Any], prototypes: Dict[str, Any]) -> Tuple[str, float]:
    v = average_landmarks(sequence.get("pose", []))
    best_gloss = "UNKNOWN"
    best_score = 0.0
    if not prototypes:
        return best_gloss, best_score
    for gloss, proto in prototypes.items():
        if isinstance(proto, dict) and "centroid" in proto:
            pv = np.array(proto["centroid"], dtype=float)
            threshold = float(proto.get("threshold", 0.7))
        else:
            pv = average_landmarks(proto)
            threshold = 0.7
        score = cosine(v, pv)
        if score > best_score:
            best_gloss, best_score = gloss, score
    if best_score < float(prototypes.get(best_gloss, {}).get("threshold", 0.7)) if isinstance(prototypes.get(best_gloss), dict) else (best_score < 0.7):
        return "UNKNOWN", best_score
    return best_gloss, best_score


