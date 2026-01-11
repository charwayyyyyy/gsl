import json
from pathlib import Path

ART_DIR = Path("ml")/"datasets"/"artifacts"

def init_from_sequences():
    seq = ART_DIR/"sequences.json"
    out = ART_DIR/"prototypes.json"
    if not seq.exists():
        print("No sequences.json found. Run build_dataset.py first.")
        return
    with open(seq, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Initialize prototypes by using sequence keys as gloss labels
    labeled = {}
    for key, sequence in data.items():
        labeled[key] = sequence
    ART_DIR.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(labeled, f, ensure_ascii=False, indent=2)
    print(f"Wrote prototypes to {out}")

if __name__ == "__main__":
    init_from_sequences()

