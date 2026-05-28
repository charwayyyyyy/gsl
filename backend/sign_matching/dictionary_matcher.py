import json
import importlib
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Any, Tuple
import numpy as np
try:
    _fastdtw = importlib.import_module("fastdtw")
except Exception:
    _fastdtw = None

TEMPLATES_PATH = Path("data") / "processed" / "dictionary_motion_templates.json"

from scipy.spatial.distance import cdist, euclidean
from api.database.database import SessionLocal
from api.database.models import MotionTemplate


@dataclass(frozen=True)
class MatchCalibration:
    raw_score: float
    calibrated_score: float
    acceptance_threshold: float
    margin: float
    motion: float

def dtw_distance(a: np.ndarray, b: np.ndarray) -> float:
    n, m = a.shape[0], b.shape[0]
    
    if n == 0 or m == 0:
        return float('inf')

    if _fastdtw is not None:
        distance, _ = _fastdtw.fastdtw(a, b, dist=euclidean)
        return float(distance / (n + m))
        
    # Pre-compute all pairwise Euclidean distances in C instantly
    cost = cdist(a, b, metric='euclidean')
    
    D = np.full((n+1, m+1), np.inf, dtype=float)
    D[0,0] = 0.0
    for i in range(1, n+1):
        for j in range(1, m+1):
            D[i,j] = cost[i-1, j-1] + min(D[i-1,j], D[i,j-1], D[i-1,j-1])
            
    return float(D[n,m] / (n + m))

def normalize_sequence(seq: List[List[float]]) -> np.ndarray:
    arr = np.array(seq, dtype=float)
    if arr.size == 0:
        return np.zeros((1,3))
    mean = arr.mean(axis=0)
    arr = arr - mean
    std = arr.std(axis=0) + 1e-6
    arr = arr / std
    L = 30
    if arr.shape[0] > L:
        idx = np.linspace(0, arr.shape[0]-1, L).astype(int)
        arr = arr[idx]
    if arr.shape[0] < L:
        idx = np.linspace(0, arr.shape[0]-1, L).astype(int)
        arr = arr[idx.clip(0, arr.shape[0]-1)]
    ker = np.array([0.25,0.5,0.25], dtype=float)
    pad = np.pad(arr, ((1,1),(0,0)), mode="edge")
    smooth = np.zeros_like(arr)
    for i in range(arr.shape[0]):
        block = pad[i:i+3]
        smooth[i] = (block * ker[:,None]).sum(axis=0)
    arr = smooth
    return arr

class DictionaryMatcher:
    def __init__(self):
        self.templates: Dict[str, Any] = {}
        self._normalized_templates: Dict[str, np.ndarray] = {}
        self._load()

    def _load(self):
        if TEMPLATES_PATH.exists():
            with open(TEMPLATES_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            self.templates = loaded
            self._normalized_templates = {}
            for gloss, templ in loaded.items():
                seq = templ.get("sequence", []) if isinstance(templ, dict) else []
                arr = normalize_sequence(seq)
                if arr.size == 0:
                    continue
                self._normalized_templates[gloss] = arr

    def _calibrate_score(self, raw_score: float, next_score: float, motion: float) -> MatchCalibration:
        margin = max(0.0, raw_score - next_score)
        low_motion_penalty = max(0.0, 0.22 - motion) * 0.35
        ambiguity_penalty = max(0.0, 0.06 - margin) * 1.1
        separation_bonus = min(0.10, margin * 0.85)

        calibrated_score = float(np.clip(raw_score + separation_bonus - low_motion_penalty - ambiguity_penalty, 0.0, 1.0))
        acceptance_threshold = float(
            np.clip(0.50 - min(0.06, margin * 0.90) + max(0.0, 0.18 - motion) * 0.25, 0.38, 0.56)
        )

        return MatchCalibration(
            raw_score=raw_score,
            calibrated_score=calibrated_score,
            acceptance_threshold=acceptance_threshold,
            margin=margin,
            motion=motion,
        )

    def _score_sequence(self, seq: List[List[float]]) -> List[Tuple[str, float]]:
        if not self._normalized_templates:
            return []

        query = normalize_sequence(seq)
        motion = np.linalg.norm(query, axis=1).mean()
        penalty = max(0.0, 0.3 - motion) * 0.3
        scores: List[Tuple[str, float]] = []

        for gloss, templ in self._normalized_templates.items():
            dist = dtw_distance(query, templ)
            score = float(max(0.0, (1.0 / (1.0 + dist)) - penalty))
            scores.append((gloss, score))

        scores.sort(key=lambda item: item[1], reverse=True)
        calibrated_scores: List[Tuple[str, float]] = []
        for idx, (gloss, raw_score) in enumerate(scores):
            next_score = scores[idx + 1][1] if idx + 1 < len(scores) else 0.0
            calibrated = self._calibrate_score(raw_score, next_score, motion)
            calibrated_scores.append((gloss, calibrated.calibrated_score))
        return calibrated_scores

    def best_match(self, seq: List[List[float]]) -> Tuple[str, float]:
        if not self._normalized_templates:
            return "UNKNOWN", 0.0
        query = normalize_sequence(seq)
        motion = np.linalg.norm(query, axis=1).mean()
        penalty = max(0.0, 0.3 - motion) * 0.3
        raw_scores: List[Tuple[str, float]] = []
        for gloss, templ in self._normalized_templates.items():
            dist = dtw_distance(query, templ)
            score = float(max(0.0, (1.0 / (1.0 + dist)) - penalty))
            raw_scores.append((gloss, score))

        raw_scores.sort(key=lambda item: item[1], reverse=True)
        if not raw_scores:
            return "UNKNOWN", 0.0
        best_gloss, best_raw_score = raw_scores[0]
        runner_up = raw_scores[1][1] if len(raw_scores) > 1 else 0.0
        calibrated = self._calibrate_score(best_raw_score, runner_up, motion)
        if calibrated.calibrated_score < calibrated.acceptance_threshold:
            return "UNKNOWN", calibrated.calibrated_score
        return best_gloss, calibrated.calibrated_score

    def top_matches(self, seq: List[List[float]], k: int = 3) -> List[Tuple[str, float]]:
        if not self._normalized_templates:
            return []
        return self._score_sequence(seq)[:k]

    def export_templates(self, limit: int = 0) -> List[Dict[str, Any]]:
        exported: List[Dict[str, Any]] = []
        for idx, gloss in enumerate(sorted(self._normalized_templates.keys())):
            if limit > 0 and idx >= limit:
                break
            templ = self._normalized_templates[gloss].astype(np.float32, copy=False)
            meta = self.templates.get(gloss, {}) if isinstance(self.templates.get(gloss), dict) else {}
            exported.append(
                {
                    "gloss": gloss,
                    "length": int(templ.shape[0]),
                    "dimensions": int(templ.shape[1]) if templ.ndim > 1 else 1,
                    "sequence": templ.reshape(-1).tolist(),
                    "page": meta.get("page"),
                    "source": meta.get("source"),
                }
            )
        return exported

