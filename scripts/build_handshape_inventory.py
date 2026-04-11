import json
from pathlib import Path
from typing import Any, Dict, List
from datetime import datetime
import sys

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from backend.dictionary.text_to_sign import TextToSignService


PROCESSED_DIR = BASE_DIR / "data" / "processed"
OUTPUT_PATH = PROCESSED_DIR / "handshape_inventory.json"


def build_inventory() -> Dict[str, Any]:
    service = TextToSignService()
    dictionary = service.dictionary or {}

    counts: Dict[str, int] = {}
    examples: Dict[str, List[Dict[str, Any]]] = {}

    for gloss, entry in dictionary.items():
        primitives = service._infer_primitives(gloss, entry)
        handshape = str(primitives.get("handshape") or "UNKNOWN").upper()

        counts[handshape] = counts.get(handshape, 0) + 1
        examples.setdefault(handshape, [])

        if len(examples[handshape]) < 12:
            examples[handshape].append(
                {
                    "gloss": gloss,
                    "english": entry.get("english"),
                    "page": entry.get("page"),
                }
            )

    inventory = {
        "summary": {
            "total_entries": len(dictionary),
            "distinct_handshapes": len(counts),
        },
        "handshape_counts": dict(sorted(counts.items(), key=lambda x: x[0])),
        "examples": examples,
        "generated_at": datetime.now().isoformat(),
        "source": "backend.dictionary.text_to_sign._infer_primitives",
    }

    return inventory


def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    inventory = build_inventory()

    with OUTPUT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(inventory, handle, ensure_ascii=False, indent=2)

    print(json.dumps(inventory["summary"], indent=2))
    print("handshape_counts", inventory["handshape_counts"])
    print(f"Wrote handshape inventory to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
