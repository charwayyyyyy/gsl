import json
from pathlib import Path
from typing import Any, Dict, List


BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
CURATED_DIR = BASE_DIR / "data" / "curated"

CURATION_PATH = CURATED_DIR / "core_term_mappings.json"
VERIFICATION_PATH = PROCESSED_DIR / "sign_curation_verification.json"
OUTPUT_PATH = PROCESSED_DIR / "approved_sign_mappings.json"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> None:
    if not CURATION_PATH.exists():
        raise FileNotFoundError(f"Missing curation mapping file: {CURATION_PATH}")
    if not VERIFICATION_PATH.exists():
        raise FileNotFoundError(
            f"Missing verification report: {VERIFICATION_PATH}. Run scripts/verify_sign_curation.py first."
        )

    curation: Dict[str, Any] = load_json(CURATION_PATH)
    verification: Dict[str, Any] = load_json(VERIFICATION_PATH)

    checks: List[Dict[str, Any]] = verification.get("checks", [])
    ready_terms = {
        str(item.get("term") or ""): item
        for item in checks
        if bool(item.get("ready"))
    }

    approved: List[Dict[str, Any]] = []
    for mapping in curation.get("mappings", []):
        term = str(mapping.get("term") or "")
        if term not in ready_terms:
            continue

        target_gloss = mapping.get("target_gloss")
        row: Dict[str, Any] = {
            "term": term,
            "status": "approved",
            "notes": mapping.get("notes"),
        }

        if isinstance(target_gloss, str) and target_gloss.strip():
            row["target_gloss"] = target_gloss.strip()
        elif isinstance(target_gloss, list) and target_gloss:
            row["target_composite_glosses"] = [str(item).strip() for item in target_gloss if str(item).strip()]

        approved.append(row)

    payload = {
        "summary": {
            "approved_count": len(approved),
            "source_curation": str(CURATION_PATH),
            "source_verification": str(VERIFICATION_PATH),
        },
        "mappings": approved,
    }

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    print(json.dumps(payload["summary"], indent=2))
    print(f"Wrote approved mappings to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
