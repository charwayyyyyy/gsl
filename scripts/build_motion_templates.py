import json
from pathlib import Path
from typing import Dict, Any, List
import numpy as np

DATA = Path("data")
PROCESSED = DATA / "processed"
DICT = PROCESSED / "gsl_dictionary.json"
OUT = PROCESSED / "dictionary_motion_templates.json"

def synth_sequence(seed: int) -> List[List[float]]:
    rng = np.random.default_rng(seed)
    L = 30
    base = rng.normal(0, 0.1, (L, 3))
    # simple canonical motion: forward arc then back
    t = np.linspace(0, 1, L)
    base[:,0] += np.sin(2*np.pi*t) * 0.5
    base[:,1] += np.cos(2*np.pi*t) * 0.3
    base[:,2] += (t - 0.5) * 0.2
    return base.tolist()

def main():
    PROCESSED.mkdir(parents=True, exist_ok=True)
    if not DICT.exists():
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump({}, f, indent=2)
        return
    with open(DICT, "r", encoding="utf-8") as f:
        dictionary: Dict[str, Any] = json.load(f)
    templates: Dict[str, Any] = {}
    for gloss, entry in dictionary.items():
        seed = abs(hash(gloss)) % (10**8)
        seq = synth_sequence(seed)
        templates[gloss] = {
            "sequence": seq,
            "source": "synthetic",
            "page": entry.get("page")
        }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)
    print(f"Wrote motion templates to {OUT}")

if __name__ == "__main__":
    main()

