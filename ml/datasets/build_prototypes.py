import json
from pathlib import Path
from typing import Dict, List
import numpy as np

ART = Path("ml")/"datasets"/"artifacts"

def build_prototypes():
    seq_path = ART/"sequences.json"
    out_path = ART/"prototypes.json"
    if not seq_path.exists():
        print("No sequences.json found")
        return
    with open(seq_path, "r", encoding="utf-8") as f:
        data: Dict[str, List[List[List[float]]]] = json.load(f)
    prototypes = {}
    for gloss, seqs in data.items():
        vectors = []
        for seq in seqs:
            arr = np.array(seq, dtype=float)
            if arr.size == 0:
                continue
            v = arr.mean(axis=0)
            vectors.append(v)
        if not vectors:
            print(f"No vectors for {gloss}")
            continue
        centroid = np.stack(vectors).mean(axis=0)
        sims = []
        for v in vectors:
            a = v
            b = centroid
            na = np.linalg.norm(a); nb = np.linalg.norm(b)
            s = float((a @ b) / (na*nb)) if na>0 and nb>0 else 0.0
            sims.append(s)
        mean_sim = float(np.mean(sims)) if sims else 0.0
        std_sim = float(np.std(sims)) if sims else 0.0
        threshold = max(0.0, min(1.0, mean_sim - std_sim))
        prototypes[gloss] = {
            "centroid": centroid.tolist(),
            "threshold": threshold,
        }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(prototypes, f, ensure_ascii=False, indent=2)
    print(f"Wrote prototypes to {out_path}")

if __name__ == "__main__":
    build_prototypes()

