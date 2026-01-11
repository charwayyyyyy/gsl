import json
from pathlib import Path

SAMPLES_DIR = Path("data")/"processed"/"samples"

def load_samples():
    return sorted(SAMPLES_DIR.glob("*.json"))

def label_sample(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    frames = data.get("frames", [])
    start_time = data.get("start_time", 0)
    end_time = data.get("end_time", 0)
    duration = max(0, end_time - start_time)
    print(f"File: {path.name}")
    print(f"Duration: {duration:.2f}s")
    print(f"Frames: {len(frames)}")
    gloss = input("Enter GSL gloss for this sample (e.g. THANK-YOU, HELLO) or SKIP: ").strip()
    if not gloss or gloss.upper() == "SKIP":
        print("Skipped")
        return False
    data["label"] = gloss
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved label: {gloss}")
    return True

if __name__ == "__main__":
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    files = load_samples()
    if not files:
        print("No samples found.")
    for p in files:
        label_sample(p)

