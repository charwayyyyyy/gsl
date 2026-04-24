import os
import json
import cv2
import mediapipe as mp
from glob import glob

# Folders for the 10 signs
SIGN_FOLDERS = [
    "FAMILY", "FRIEND", "HELP", "HOUSE", "WATER", "FOOD", "SCHOOL", "MOTHER", "FATHER", "LOVE"
]

INPUT_ROOT = "data/processed/images"
OUTPUT_ROOT = "data/processed/poses"
os.makedirs(OUTPUT_ROOT, exist_ok=True)

mp_pose = mp.solutions.pose.Pose(static_image_mode=True)
mp_hands = mp.solutions.hands.Hands(static_image_mode=True, max_num_hands=2)

pose_results = {}

def extract_landmarks(image_path):
    image = cv2.imread(image_path)
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results_pose = mp_pose.process(image_rgb)
    results_hands = mp_hands.process(image_rgb)
    pose_landmarks = []
    hand_landmarks = []
    if results_pose.pose_landmarks:
        pose_landmarks = [
            {"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility}
            for lm in results_pose.pose_landmarks.landmark
        ]
    if results_hands.multi_hand_landmarks:
        for hand in results_hands.multi_hand_landmarks:
            hand_landmarks.append([
                {"x": lm.x, "y": lm.y, "z": lm.z}
                for lm in hand.landmark
            ])
    return {"pose": pose_landmarks, "hands": hand_landmarks}

for sign in SIGN_FOLDERS:
    folder_path = os.path.join(INPUT_ROOT, sign)
    if not os.path.exists(folder_path):
        print(f"Warning: {folder_path} does not exist.")
        continue
    image_files = glob(os.path.join(folder_path, "*.png")) + glob(os.path.join(folder_path, "*.jpg"))
    sign_poses = {}
    for img_path in image_files:
        fname = os.path.basename(img_path)
        sign_poses[fname] = extract_landmarks(img_path)
    pose_results[sign] = sign_poses
    # Save per-sign JSON
    with open(os.path.join(OUTPUT_ROOT, f"{sign}.json"), "w") as f:
        json.dump(sign_poses, f, indent=2)

# Save all results
with open(os.path.join(OUTPUT_ROOT, "all_signs_poses.json"), "w") as f:
    json.dump(pose_results, f, indent=2)

print("Pose extraction complete. Results saved to:", OUTPUT_ROOT)
