import json
import time
from pathlib import Path
from typing import Iterator

import cv2

from .camera import open_camera, read_frame, close_camera
from .landmarks import extract_landmarks

OUT_DIR = Path("data") / "processed" / "samples"

def stream_frames(save_every: int = 30) -> Iterator[str]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cap = open_camera(0)
    counter = 0
    try:
        while True:
            r = read_frame(cap)
            if r is None:
                break
            ts, frame = r
            lm = extract_landmarks(frame)
            msg = {
                "timestamp": ts,
                "hands": lm.get("hands", []),
                "pose": lm.get("pose", []),
                "face": lm.get("face", []),
            }
            if counter % save_every == 0:
                out_path = OUT_DIR / f"frame_{ts}.json"
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(msg, f)
            counter += 1
            yield json.dumps(msg)
    finally:
        close_camera(cap)

