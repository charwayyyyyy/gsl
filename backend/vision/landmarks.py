from typing import Dict, Any, Optional
import numpy as np

try:
    import mediapipe as mp
    _MP = True
except Exception:
    mp = None
    _MP = False

def extract_landmarks(frame_bgr: Any) -> Dict[str, Any]:
    if not _MP:
        return {"hands": [], "pose": [], "face": [], "confidence": 0.0}

    rgb = frame_bgr[:, :, ::-1]
    hands = mp.solutions.hands.Hands(static_image_mode=False, max_num_hands=2)
    pose = mp.solutions.pose.Pose(static_image_mode=False)
    face = mp.solutions.face_mesh.FaceMesh(static_image_mode=False)

    result_h = hands.process(rgb)
    result_p = pose.process(rgb)
    result_f = face.process(rgb)

    hands.close(); pose.close(); face.close()

    def lm_to_array(lm_list):
        arr = []
        if lm_list and lm_list.landmark:
            for lm in lm_list.landmark:
                arr.append([lm.x, lm.y, lm.z])
        return arr

    out = {
        "hands": [lm_to_array(h) for h in (result_h.multi_hand_landmarks or [])],
        "pose": lm_to_array(result_p.pose_landmarks) if result_p.pose_landmarks else [],
        "face": lm_to_array(result_f.multi_face_landmarks[0]) if result_f.multi_face_landmarks else [],
        "confidence": 0.8,
    }
    return out

