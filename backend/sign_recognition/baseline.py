from typing import List, Dict, Any, Tuple
import numpy as np

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

def classify(sequence: Dict[str, Any], prototypes: Dict[str, List[List[float]]]) -> Tuple[str, float]:
    v = average_landmarks(sequence.get("pose", []))
    best_gloss = ""
    best_score = -1.0
    for gloss, proto_seq in prototypes.items():
        pv = average_landmarks(proto_seq)
        score = cosine(v, pv)
        if score > best_score:
            best_gloss, best_score = gloss, score
    return best_gloss, max(0.0, best_score)

