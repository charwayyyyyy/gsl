import json
from pathlib import Path
from typing import List, Dict

OUT_DIR = Path("ml") / "datasets" / "artifacts"

def build_sequences(sample_dir: Path) -> Dict[str, List[List[float]]]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sequences: Dict[str, List[List[float]]] = {}
    for p in sample_dir.glob("*.json"):
        with open(p, "r", encoding="utf-8") as f:
            obj = json.load(f)
        # Placeholder alignment: use pose as sequence
        sequences[p.stem] = obj.get("pose", [])
    out = OUT_DIR / "sequences.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(sequences, f)
    return sequences

