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
        # Use pose landmarks as the baseline sequence
        seq = obj.get("pose", [])
        sequences[p.stem] = seq
    out = OUT_DIR / "sequences.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(sequences, f, ensure_ascii=False, indent=2)
    return sequences

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Build landmark sequences from saved sample frames")
    parser.add_argument("--samples", type=str, default=str(Path("data")/"processed"/"samples"))
    args = parser.parse_args()
    sample_dir = Path(args.samples)
    sample_dir.mkdir(parents=True, exist_ok=True)
    seqs = build_sequences(sample_dir)
    print(f"Built {len(seqs)} sequences to {OUT_DIR / 'sequences.json'}")

