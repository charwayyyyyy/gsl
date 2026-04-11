import json
from pathlib import Path
from typing import Any, Dict, List, Tuple


BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
DICTIONARY_PATH = PROCESSED_DIR / "gsl_dictionary.json"
TEMPLATES_PATH = PROCESSED_DIR / "dictionary_motion_templates.json"
SIGN_INDEX_PATH = PROCESSED_DIR / "gsl_sign_index.json"
OUTPUT_PATH = PROCESSED_DIR / "sign_coverage_audit.json"
QUEUE_OUTPUT_PATH = PROCESSED_DIR / "sign_curation_queue.json"


CORE_TERMS: List[str] = [
    "hello",
    "hi",
    "bye",
    "goodbye",
    "please",
    "thank you",
    "sorry",
    "yes",
    "no",
    "help",
    "stop",
    "go",
    "come",
    "wait",
    "eat",
    "drink",
    "water",
    "food",
    "family",
    "mother",
    "father",
    "brother",
    "sister",
    "friend",
    "teacher",
    "student",
    "school",
    "home",
    "work",
    "name",
    "what",
    "where",
    "when",
    "why",
    "who",
    "how",
    "me",
    "you",
    "we",
    "they",
    "he",
    "she",
    "good",
    "bad",
    "like",
    "love",
    "want",
    "need",
    "open",
    "close",
    "day",
    "today",
    "tomorrow",
    "now",
    "time",
    "money",
    "doctor",
    "hospital",
    "church",
    "ghana",
    "sign",
    "language",
]


TERM_ALIASES: Dict[str, List[str]] = {
    "hello": ["HELLO", "GREET"],
    "hi": ["HELLO", "GREET"],
    "bye": ["BYE", "GOODBYE", "GOOD BYE"],
    "goodbye": ["GOODBYE", "GOOD BYE", "BYE"],
    "please": ["PLEASE"],
    "thank you": ["THANK YOU", "THANK", "FINE"],
    "sorry": ["SORRY", "APOLOGIZE", "APOLOGISE"],
    "yes": ["YES"],
    "no": ["NO"],
    "help": ["HELP", "ASSIST"],
    "stop": ["STOP"],
    "go": ["GO"],
    "come": ["COME"],
    "wait": ["WAIT"],
    "eat": ["EAT"],
    "drink": ["DRINK"],
    "water": ["WATER"],
    "food": ["FOOD"],
    "family": ["FAMILY"],
    "mother": ["MOTHER", "MOM", "MUM"],
    "father": ["FATHER", "DAD", "DADDY"],
    "brother": ["BROTHER"],
    "sister": ["SISTER"],
    "friend": ["FRIEND"],
    "teacher": ["TEACHER"],
    "student": ["STUDENT"],
    "school": ["SCHOOL"],
    "home": ["HOME"],
    "work": ["WORK"],
    "name": ["NAME"],
    "what": ["WHAT"],
    "where": ["WHERE"],
    "when": ["WHEN"],
    "why": ["WHY"],
    "who": ["WHO"],
    "how": ["HOW"],
    "me": ["ME", "I"],
    "you": ["YOU"],
    "we": ["WE"],
    "they": ["THEY"],
    "he": ["HE"],
    "she": ["SHE"],
    "good": ["GOOD"],
    "bad": ["BAD"],
    "like": ["LIKE"],
    "love": ["LOVE"],
    "want": ["WANT"],
    "need": ["NEED"],
    "open": ["OPEN"],
    "close": ["CLOSE"],
    "day": ["DAY"],
    "today": ["TODAY"],
    "tomorrow": ["TOMORROW"],
    "now": ["NOW"],
    "time": ["TIME"],
    "money": ["MONEY"],
    "doctor": ["DOCTOR"],
    "hospital": ["HOSPITAL"],
    "church": ["CHURCH"],
    "ghana": ["GHANA", "GHANAIAN"],
    "sign": ["SIGN"],
    "language": ["LANGUAGE"],
}


BOILERPLATE_GLOSSES = {
    "GHANAIAN",
    "SIGN",
    "LANGUAGE",
    "THIRD",
    "EDITION",
    "DICTIONARY",
    "II",
    "III",
    "IV",
    "FOREWORD",
    "MESSAGE",
    "OF",
}


def normalize(text: str) -> str:
    return " ".join(text.lower().replace("-", " ").split())


def tokenize(text: str) -> List[str]:
    return [token for token in normalize(text).split() if token]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def find_entry(dictionary: Dict[str, Any], term: str) -> Tuple[str, Dict[str, Any]]:
    normalized_term = normalize(term)

    candidate_terms = [normalized_term]
    candidate_terms.extend(normalize(alias) for alias in TERM_ALIASES.get(term, []))

    for gloss, entry in dictionary.items():
        if gloss in BOILERPLATE_GLOSSES:
            continue

        normalized_gloss = normalize(gloss)
        english = normalize(str(entry.get("english") or ""))

        if normalized_gloss in candidate_terms or english in candidate_terms:
            return gloss, entry

    for alias in TERM_ALIASES.get(term, []):
        normalized_alias = normalize(alias)
        for gloss, entry in dictionary.items():
            if gloss in BOILERPLATE_GLOSSES:
                continue

            normalized_gloss = normalize(gloss)
            english = normalize(str(entry.get("english") or ""))

            if normalized_gloss == normalized_alias or english == normalized_alias:
                return gloss, entry

    return "", {}


def _candidate_terms_for(term: str) -> List[str]:
    candidates = [normalize(term)]
    candidates.extend(normalize(alias) for alias in TERM_ALIASES.get(term, []))
    return [c for c in candidates if c]


def find_boilerplate_hit(term: str) -> str:
    candidates = set(_candidate_terms_for(term))
    for gloss in BOILERPLATE_GLOSSES:
        if normalize(gloss) in candidates:
            return gloss
    return ""


def suggest_candidates(dictionary: Dict[str, Any], term: str, limit: int = 5) -> List[Dict[str, Any]]:
    candidates = _candidate_terms_for(term)
    scored: List[Tuple[int, str, Dict[str, Any]]] = []

    for gloss, entry in dictionary.items():
        if gloss in BOILERPLATE_GLOSSES:
            continue

        normalized_gloss = normalize(gloss)
        normalized_english = normalize(str(entry.get("english") or ""))
        gloss_tokens = set(tokenize(normalized_gloss))
        english_tokens = set(tokenize(normalized_english))

        score = 0
        for cand in candidates:
            cand_tokens = set(tokenize(cand))
            if not cand_tokens:
                continue

            if cand == normalized_gloss or cand == normalized_english:
                score += 10
            elif cand_tokens.issubset(gloss_tokens) or cand_tokens.issubset(english_tokens):
                score += 5

            overlap = len(cand_tokens & gloss_tokens) + len(cand_tokens & english_tokens)
            score += overlap

        if score > 0:
            scored.append((score, gloss, entry))

    scored.sort(key=lambda item: (-item[0], item[1]))

    suggestions: List[Dict[str, Any]] = []
    for score, gloss, entry in scored[:limit]:
        suggestions.append(
            {
                "gloss": gloss,
                "english": entry.get("english"),
                "page": entry.get("page"),
                "score": score,
            }
        )
    return suggestions


def main() -> None:
    if not DICTIONARY_PATH.exists():
        raise FileNotFoundError(f"Dictionary not found: {DICTIONARY_PATH}")

    dictionary: Dict[str, Any] = load_json(DICTIONARY_PATH)
    templates: Dict[str, Any] = load_json(TEMPLATES_PATH) if TEMPLATES_PATH.exists() else {}
    sign_index_data: Dict[str, Any] = load_json(SIGN_INDEX_PATH) if SIGN_INDEX_PATH.exists() else {"index": {}}
    sign_index: Dict[str, Any] = sign_index_data.get("index", {}) if isinstance(sign_index_data, dict) else {}

    coverage_rows: List[Dict[str, Any]] = []
    covered_terms: List[str] = []
    missing_terms: List[str] = []

    for term in CORE_TERMS:
        gloss, entry = find_entry(dictionary, term)
        template_hit = gloss in templates
        index_hit = gloss in sign_index

        row = {
            "term": term,
            "covered": bool(gloss),
            "matched_gloss": gloss or None,
            "page": entry.get("page") if entry else None,
            "template": template_hit,
            "index": index_hit,
            "english": entry.get("english") if entry else None,
            "description": entry.get("description") if entry else None,
        }
        coverage_rows.append(row)

        if gloss and template_hit and index_hit:
            covered_terms.append(term)
        else:
            missing_terms.append(term)

    report = {
        "counts": {
            "dictionary_entries": len(dictionary),
            "templates": len(templates),
            "sign_index": len(sign_index),
            "core_terms_total": len(CORE_TERMS),
            "core_terms_fully_covered": len(covered_terms),
            "core_terms_needing_attention": len(missing_terms),
        },
        "core_terms": coverage_rows,
        "missing_terms": missing_terms,
        "generated_from": {
            "dictionary": str(DICTIONARY_PATH),
            "templates": str(TEMPLATES_PATH),
            "sign_index": str(SIGN_INDEX_PATH),
        },
    }

    curation_queue: List[Dict[str, Any]] = []
    for term in missing_terms:
        boilerplate_hit = find_boilerplate_hit(term)
        if boilerplate_hit:
            reason = "exists_only_as_boilerplate_heading"
        else:
            reason = "no_exact_core_match_found"

        curation_queue.append(
            {
                "term": term,
                "reason": reason,
                "boilerplate_hit": boilerplate_hit or None,
                "aliases": TERM_ALIASES.get(term, []),
                "suggested_candidates": suggest_candidates(dictionary, term, limit=5),
                "status": "todo",
            }
        )

    queue_report = {
        "summary": {
            "missing_terms": len(missing_terms),
            "queue_items": len(curation_queue),
        },
        "items": curation_queue,
    }

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
    with QUEUE_OUTPUT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(queue_report, handle, ensure_ascii=False, indent=2)

    print(json.dumps(report["counts"], indent=2))
    if missing_terms:
        print("Missing or partial core terms:")
        for term in missing_terms:
            print(f"- {term}")
    print(f"Wrote coverage report to {OUTPUT_PATH}")
    print(f"Wrote curation queue to {QUEUE_OUTPUT_PATH}")


if __name__ == "__main__":
    main()