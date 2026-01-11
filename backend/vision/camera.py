import cv2
import time
from typing import Optional, Tuple

def open_camera(index: int = 0) -> cv2.VideoCapture:
    cap = cv2.VideoCapture(index)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 30)
    return cap

def read_frame(cap: cv2.VideoCapture) -> Optional[Tuple[int, any]]:
    ts = int(time.time())
    ok, frame = cap.read()
    if not ok:
        return None
    return ts, frame

def close_camera(cap: cv2.VideoCapture) -> None:
    try:
        cap.release()
    except Exception:
        pass

