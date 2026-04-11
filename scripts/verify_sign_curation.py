import json
from pathlib import Path
from typing import Any, Dict, List


BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
CURATED_DIR = BASE_DIR / "data" / "curated"

DICTIONARY_PATH = PROCESSED_DIR / "gsl_dictionary.json"
TEMPLATES_PATH = PROCESSED_DIR / "dictionary_motion_templates.json"
SIGN_INDEX_PATH = PROCESSED_DIR / "gsl_sign_index.json"
CURATION_PATH = CURATED_DIR / "core_term_mappings.json"
OUTPUT_PATH = PROCESSED_DIR / "sign_curation_verification.json"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def check_gloss_exists(gloss: str, dictionary: Dict[str, Any], templates: Dict[str, Any], sign_index: Dict[str, Any]) -> Dict[str, bool]:
    return {
        "dictionary": gloss in dictionary,
        "templates": gloss in templates,
        "sign_index": gloss in sign_index,
    }


def main() -> None:
    if not CURATION_PATH.exists():
        raise FileNotFoundError(f"Missing curation mapping file: {CURATION_PATH}")
    if not DICTIONARY_PATH.exists():
        raise FileNotFoundError(f"Missing dictionary file: {DICTIONARY_PATH}")

    dictionary: Dict[str, Any] = load_json(DICTIONARY_PATH)
    templates: Dict[str, Any] = load_json(TEMPLATES_PATH) if TEMPLATES_PATH.exists() else {}
    sign_index_payload: Dict[str, Any] = load_json(SIGN_INDEX_PATH) if SIGN_INDEX_PATH.exists() else {"index": {}}
    sign_index: Dict[str, Any] = sign_index_payload.get("index", {}) if isinstance(sign_index_payload, dict) else {}

    curation_payload: Dict[str, Any] = load_json(CURATION_PATH)
    mappings: List[Dict[str, Any]] = curation_payload.get("mappings", [])

    checks: List[Dict[str, Any]] = []
    ready_count = 0
    suggested_viable_count = 0

    for mapping in mappings:
        term = str(mapping.get("term") or "")
        target_gloss = mapping.get("target_gloss")
        suggested_target_gloss = mapping.get("suggested_target_gloss")
        suggested_composite_glosses = mapping.get("suggested_composite_glosses") or []
        status = str(mapping.get("status") or "review")

        has_target = isinstance(target_gloss, str) and len(target_gloss.strip()) > 0
        resolved_gloss = target_gloss.strip() if has_target else ""

        has_composite_target = isinstance(target_gloss, list) and len(target_gloss) > 0
        resolved_composite = [str(item).strip() for item in target_gloss] if has_composite_target else []

        exists_single = check_gloss_exists(resolved_gloss, dictionary, templates, sign_index) if has_target else {
            "dictionary": False,
            "templates": False,
            "sign_index": False,
        }

        exists_composite = []
        if has_composite_target:
            for gloss in resolved_composite:
                exists_composite.append({"gloss": gloss, "exists": check_gloss_exists(gloss, dictionary, templates, sign_index)})

        single_ready = has_target and all(exists_single.values())
        composite_ready = has_composite_target and len(exists_composite) > 0 and all(all(item["exists"].values()) for item in exists_composite)

        ready = bool((single_ready or composite_ready) and status == "approved")
        if ready:
            ready_count += 1

        suggested_target_ready = False
        suggested_target_exists = {
            "dictionary": False,
            "templates": False,
            "sign_index": False,
        }
        if isinstance(suggested_target_gloss, str) and suggested_target_gloss.strip():
            suggested_target_exists = check_gloss_exists(suggested_target_gloss.strip(), dictionary, templates, sign_index)
            suggested_target_ready = all(suggested_target_exists.values())

        suggested_composite_exists = []
        suggested_composite_ready = False
        if isinstance(suggested_composite_glosses, list) and suggested_composite_glosses:
            for gloss in suggested_composite_glosses:
                gloss_str = str(gloss).strip()
                exists = check_gloss_exists(gloss_str, dictionary, templates, sign_index)
                suggested_composite_exists.append({"gloss": gloss_str, "exists": exists})
            suggested_composite_ready = all(all(item["exists"].values()) for item in suggested_composite_exists)

        suggested_viable = suggested_target_ready or suggested_composite_ready
        if suggested_viable:
            suggested_viable_count += 1

        checks.append(
            {
                "term": term,
                "status": status,
                "target_gloss": resolved_gloss or None,
                "target_composite_glosses": resolved_composite if has_composite_target else [],
                "ready": ready,
                "exists": exists_single,
                "composite_exists": exists_composite,
                "suggested": {
                    "target_gloss": suggested_target_gloss if isinstance(suggested_target_gloss, str) else None,
                    "target_exists": suggested_target_exists,
                    "composite_glosses": suggested_composite_glosses,
                    "composite_exists": suggested_composite_exists,
                    "viable": suggested_viable,
                },
                "notes": mapping.get("notes"),
            }
        )

    report = {
        "summary": {
            "total_mappings": len(mappings),
            "ready_mappings": ready_count,
            "pending_mappings": len(mappings) - ready_count,
            "suggested_viable_mappings": suggested_viable_count,
        },
        "checks": checks,
        "sources": {
            "curation": str(CURATION_PATH),
            "dictionary": str(DICTIONARY_PATH),
            "templates": str(TEMPLATES_PATH),
            "sign_index": str(SIGN_INDEX_PATH),
        },
    }

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)

    print(json.dumps(report["summary"], indent=2))
    print(f"Wrote curation verification to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
