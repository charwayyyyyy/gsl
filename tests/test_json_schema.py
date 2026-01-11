import json
from pathlib import Path

SCHEMA = {
    "required": ["id", "gloss", "english_meaning", "source_page"],
}

def test_json_chunks_schema():
    chunks = sorted(Path("data/gsl_json").glob("gsl_dict_entries_*.json"))
    # If none exist yet, skip
    if not chunks:
        return
    with open(chunks[0], "r", encoding="utf-8") as f:
        data = json.load(f)
    assert "entries" in data
    for e in data["entries"]:
        for k in SCHEMA["required"]:
            assert k in e

