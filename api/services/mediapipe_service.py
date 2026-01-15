import cv2
import numpy as np
try:
    import mediapipe as mp
    _MP_AVAILABLE = hasattr(mp, "solutions")
except Exception:
    mp = None
    _MP_AVAILABLE = False
from typing import Dict, List, Any, Optional
import time
import asyncio
import logging
from dataclasses import dataclass

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class LandmarkData:
    x: float
    y: float
    z: float
    visibility: float = 1.0

@dataclass
class HandFeatures:
    landmarks: List[LandmarkData]
    handedness: str  # 'Left' or 'Right'
    confidence: float
    gesture: Optional[str] = None

@dataclass
class PoseFeatures:
    landmarks: List[LandmarkData]
    confidence: float
    body_orientation: Optional[str] = None

@dataclass
class FaceFeatures:
    landmarks: List[LandmarkData]
    expressions: Dict[str, float]
    confidence: float

class MediaPipeService:
    def __init__(self):
        """Initialize MediaPipe solutions for sign language processing"""
        if _MP_AVAILABLE:
            self.mp_hands = mp.solutions.hands
            self.mp_pose = mp.solutions.pose
            self.mp_face_mesh = mp.solutions.face_mesh
            self.mp_drawing = mp.solutions.drawing_utils
            self.mp_drawing_styles = mp.solutions.drawing_styles
        else:
            self.mp_hands = None
            self.mp_pose = None
            self.mp_face_mesh = None
            self.mp_drawing = None
            self.mp_drawing_styles = None
        
        # Initialize MediaPipe solutions with optimized parameters
        if _MP_AVAILABLE:
            self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            model_complexity=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
            )
        else:
            self.hands = None
        
        if _MP_AVAILABLE:
            self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
            )
        else:
            self.pose = None
        
        if _MP_AVAILABLE:
            self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
            )
        else:
            self.face_mesh = None
        
        # Sign language specific configurations
        if _MP_AVAILABLE:
            self.sign_language_joints = [
                self.mp_hands.HandLandmark.THUMB_TIP,
                self.mp_hands.HandLandmark.THUMB_IP,
                self.mp_hands.HandLandmark.THUMB_MCP,
                self.mp_hands.HandLandmark.INDEX_FINGER_TIP,
                self.mp_hands.HandLandmark.INDEX_FINGER_DIP,
                self.mp_hands.HandLandmark.INDEX_FINGER_PIP,
                self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP,
                self.mp_hands.HandLandmark.MIDDLE_FINGER_DIP,
                self.mp_hands.HandLandmark.MIDDLE_FINGER_PIP,
                self.mp_hands.HandLandmark.RING_FINGER_TIP,
                self.mp_hands.HandLandmark.RING_FINGER_DIP,
                self.mp_hands.HandLandmark.RING_FINGER_PIP,
                self.mp_hands.HandLandmark.PINKY_TIP,
                self.mp_hands.HandLandmark.PINKY_DIP,
                self.mp_hands.HandLandmark.PINKY_PIP,
                self.mp_hands.HandLandmark.WRIST
            ]
            self.body_joints = [
                self.mp_pose.PoseLandmark.NOSE,
                self.mp_pose.PoseLandmark.LEFT_SHOULDER,
                self.mp_pose.PoseLandmark.RIGHT_SHOULDER,
                self.mp_pose.PoseLandmark.LEFT_ELBOW,
                self.mp_pose.PoseLandmark.RIGHT_ELBOW,
                self.mp_pose.PoseLandmark.LEFT_WRIST,
                self.mp_pose.PoseLandmark.RIGHT_WRIST
            ]
        else:
            self.sign_language_joints = []
            self.body_joints = []
        
        logger.info("MediaPipe service initialized successfully")

    async def process_frame(self, frame_data: bytes) -> Dict[str, Any]:
        """
        Process a video frame and extract sign language relevant features
        
        Args:
            frame_data: Base64 encoded frame data
            
        Returns:
            Dictionary containing extracted landmarks and confidence scores
        """
        start_time = time.time()
        
        try:
            # Convert bytes to numpy array
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                raise ValueError("Could not decode frame")
            
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process frame with MediaPipe solutions
            results = await self._process_media_pipe(rgb_frame)
            
            # Extract sign language relevant features
            features = self._extract_sign_language_features(results, rgb_frame)
            
            # Calculate overall confidence
            confidence = self._calculate_overall_confidence(features)
            
            processing_time = int((time.time() - start_time) * 1000)
            
            return {
                "landmarks": features,
                "confidence": confidence,
                "processing_time_ms": processing_time,
                "timestamp": int(time.time() * 1000)
            }
            
        except Exception as e:
            logger.error(f"Error processing frame: {str(e)}")
            return {
                "landmarks": {},
                "confidence": 0.0,
                "processing_time_ms": int((time.time() - start_time) * 1000),
                "error": str(e)
            }

    async def _process_media_pipe(self, rgb_frame: np.ndarray) -> Dict[str, Any]:
        """Process frame with all MediaPipe solutions"""
        if not _MP_AVAILABLE:
            return {"hands": None, "pose": None, "face": None}
        results = {}
        hand_results = self.hands.process(rgb_frame) if self.hands else None
        results["hands"] = hand_results
        pose_results = self.pose.process(rgb_frame) if self.pose else None
        results["pose"] = pose_results
        face_results = self.face_mesh.process(rgb_frame) if self.face_mesh else None
        results["face"] = face_results
        return results

    def _extract_sign_language_features(self, results: Dict[str, Any], frame: np.ndarray) -> Dict[str, Any]:
        """Extract features specifically relevant for sign language recognition"""
        features = {}
        
        # Extract hand features
        if results.get("hands") and results["hands"].multi_hand_landmarks:
            features["hands"] = self._extract_hand_features(
                results["hands"], 
                results["hands"].multi_handedness
            )
        else:
            features["hands"] = []
        
        # Extract pose features
        if results.get("pose") and results["pose"].pose_landmarks:
            features["pose"] = self._extract_pose_features(results["pose"])
        else:
            features["pose"] = None
        
        # Extract face features
        if results.get("face") and results["face"].multi_face_landmarks:
            features["face"] = self._extract_face_features(results["face"])
        else:
            features["face"] = None
        
        # Extract additional sign language specific metrics
        features["sign_metrics"] = self._calculate_sign_language_metrics(features)
        
        return features

    def _extract_hand_features(self, hand_results, multi_handedness) -> List[Dict[str, Any]]:
        """Extract detailed hand features for sign language"""
        hand_features = []
        
        for idx, (hand_landmarks, handedness) in enumerate(
            zip(hand_results.multi_hand_landmarks, multi_handedness)
        ):
            hand_data = {
                "handedness": handedness.classification[0].label,
                "confidence": handedness.classification[0].score,
                "landmarks": []
            }
            
            # Extract all hand landmarks
            for landmark in hand_landmarks.landmark:
                hand_data["landmarks"].append({
                    "x": landmark.x,
                    "y": landmark.y,
                    "z": landmark.z,
                    "visibility": getattr(landmark, 'visibility', 1.0)
                })
            
            # Calculate hand-specific metrics
            hand_data["palm_orientation"] = self._calculate_palm_orientation(hand_landmarks)
            hand_data["finger_states"] = self._calculate_finger_states(hand_landmarks)
            hand_data["hand_gesture"] = self._classify_hand_gesture(hand_landmarks)
            
            hand_features.append(hand_data)
        
        return hand_features

    def _extract_pose_features(self, pose_results) -> Dict[str, Any]:
        """Extract pose features relevant for sign language"""
        pose_data = {
            "landmarks": [],
            "confidence": pose_results.pose_landmarks.landmark[0].visibility if pose_results.pose_landmarks else 0.0
        }
        
        if pose_results.pose_landmarks:
            for landmark in pose_results.pose_landmarks.landmark:
                pose_data["landmarks"].append({
                    "x": landmark.x,
                    "y": landmark.y,
                    "z": landmark.z,
                    "visibility": landmark.visibility
                })
            
            # Calculate body orientation and key angles
            pose_data["body_orientation"] = self._calculate_body_orientation(pose_results.pose_landmarks)
            pose_data["shoulder_angles"] = self._calculate_shoulder_angles(pose_results.pose_landmarks)
            pose_data["arm_positions"] = self._calculate_arm_positions(pose_results.pose_landmarks)
        
        return pose_data

    def _extract_face_features(self, face_results) -> Dict[str, Any]:
        """Extract facial features relevant for sign language expressions"""
        face_data = {
            "landmarks": [],
            "expressions": {},
            "confidence": 0.0
        }
        
        if face_results.multi_face_landmarks:
            face_landmarks = face_results.multi_face_landmarks[0]
            
            # Extract facial landmarks
            for landmark in face_landmarks.landmark:
                face_data["landmarks"].append({
                    "x": landmark.x,
                    "y": landmark.y,
                    "z": landmark.z
                })
            
            # Calculate facial expressions relevant for sign language
            face_data["expressions"] = self._calculate_facial_expressions(face_landmarks)
            face_data["confidence"] = 0.8  # Placeholder confidence
        
        return face_data

    def _calculate_palm_orientation(self, hand_landmarks) -> Dict[str, float]:
        """Calculate palm orientation for sign language recognition"""
        wrist = hand_landmarks.landmark[self.mp_hands.HandLandmark.WRIST]
        middle_finger_mcp = hand_landmarks.landmark[self.mp_hands.HandLandmark.MIDDLE_FINGER_MCP]
        
        # Calculate palm normal vector
        palm_vector = {
            "x": middle_finger_mcp.x - wrist.x,
            "y": middle_finger_mcp.y - wrist.y,
            "z": middle_finger_mcp.z - wrist.z
        }
        
        # Normalize vector
        magnitude = np.sqrt(palm_vector["x"]**2 + palm_vector["y"]**2 + palm_vector["z"]**2)
        if magnitude > 0:
            palm_vector = {k: v/magnitude for k, v in palm_vector.items()}
        
        return palm_vector

    def _calculate_finger_states(self, hand_landmarks) -> Dict[str, str]:
        """Calculate finger states (extended, bent, touching)"""
        finger_states = {}
        
        # Define finger landmark groups
        fingers = {
            "thumb": [
                self.mp_hands.HandLandmark.THUMB_TIP,
                self.mp_hands.HandLandmark.THUMB_IP,
                self.mp_hands.HandLandmark.THUMB_MCP
            ],
            "index": [
                self.mp_hands.HandLandmark.INDEX_FINGER_TIP,
                self.mp_hands.HandLandmark.INDEX_FINGER_DIP,
                self.mp_hands.HandLandmark.INDEX_FINGER_PIP
            ],
            "middle": [
                self.mp_hands.HandLandmark.MIDDLE_FINGER_TIP,
                self.mp_hands.HandLandmark.MIDDLE_FINGER_DIP,
                self.mp_hands.HandLandmark.MIDDLE_FINGER_PIP
            ],
            "ring": [
                self.mp_hands.HandLandmark.RING_FINGER_TIP,
                self.mp_hands.HandLandmark.RING_FINGER_DIP,
                self.mp_hands.HandLandmark.RING_FINGER_PIP
            ],
            "pinky": [
                self.mp_hands.HandLandmark.PINKY_TIP,
                self.mp_hands.HandLandmark.PINKY_DIP,
                self.mp_hands.HandLandmark.PINKY_PIP
            ]
        }
        
        for finger_name, landmarks in fingers.items():
            # Calculate finger extension based on joint angles
            tip = hand_landmarks.landmark[landmarks[0]]
            dip = hand_landmarks.landmark[landmarks[1]]
            pip = hand_landmarks.landmark[landmarks[2]]
            
            # Simple heuristic: check if finger tip is further from palm than pip joint
            wrist = hand_landmarks.landmark[self.mp_hands.HandLandmark.WRIST]
            
            tip_distance = np.sqrt((tip.x - wrist.x)**2 + (tip.y - wrist.y)**2)
            pip_distance = np.sqrt((pip.x - wrist.x)**2 + (pip.y - wrist.y)**2)
            
            if tip_distance > pip_distance * 1.1:  # Extended
                finger_states[finger_name] = "extended"
            else:  # Bent
                finger_states[finger_name] = "bent"
        
        return finger_states

    def _classify_hand_gesture(self, hand_landmarks) -> str:
        """Classify basic hand gestures relevant for sign language"""
        finger_states = self._calculate_finger_states(hand_landmarks)
        
        # Simple gesture classification based on finger states
        extended_fingers = sum(1 for state in finger_states.values() if state == "extended")
        
        if extended_fingers == 0:
            return "fist"
        elif extended_fingers == 1 and finger_states.get("index") == "extended":
            return "pointing"
        elif extended_fingers == 5:
            return "open_palm"
        elif extended_fingers == 2 and finger_states.get("index") == "extended" and finger_states.get("middle") == "extended":
            return "peace_sign"
        else:
            return f"custom_{extended_fingers}_fingers"

    def _calculate_body_orientation(self, pose_landmarks) -> str:
        """Calculate body orientation relevant for sign language"""
        left_shoulder = pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_SHOULDER]
        right_shoulder = pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_SHOULDER]
        
        # Calculate shoulder line angle
        shoulder_dx = right_shoulder.x - left_shoulder.x
        shoulder_dy = right_shoulder.y - left_shoulder.y
        
        if abs(shoulder_dx) > abs(shoulder_dy):
            return "facing_forward" if shoulder_dx > 0 else "facing_backward"
        else:
            return "upright"

    def _calculate_shoulder_angles(self, pose_landmarks) -> Dict[str, float]:
        """Calculate shoulder angles for sign language posture analysis"""
        left_shoulder = pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_SHOULDER]
        right_shoulder = pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_SHOULDER]
        left_elbow = pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_ELBOW]
        right_elbow = pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_ELBOW]
        
        # Calculate shoulder angles (simplified)
        angles = {}
        
        # Left shoulder angle
        if left_elbow and left_shoulder:
            left_angle = np.arctan2(
                left_elbow.y - left_shoulder.y,
                left_elbow.x - left_shoulder.x
            ) * 180 / np.pi
            angles["left_shoulder"] = left_angle
        
        # Right shoulder angle
        if right_elbow and right_shoulder:
            right_angle = np.arctan2(
                right_elbow.y - right_shoulder.y,
                right_elbow.x - right_shoulder.x
            ) * 180 / np.pi
            angles["right_shoulder"] = right_angle
        
        return angles

    def _calculate_arm_positions(self, pose_landmarks) -> Dict[str, str]:
        """Calculate arm positions relevant for sign language"""
        positions = {}
        
        # Get key points
        left_shoulder = pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_SHOULDER]
        right_shoulder = pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_SHOULDER]
        left_wrist = pose_landmarks.landmark[self.mp_pose.PoseLandmark.LEFT_WRIST]
        right_wrist = pose_landmarks.landmark[self.mp_pose.PoseLandmark.RIGHT_WRIST]
        
        # Determine arm positions relative to shoulders
        if left_wrist.y < left_shoulder.y:
            positions["left_arm"] = "raised"
        elif left_wrist.y > left_shoulder.y + 0.2:
            positions["left_arm"] = "lowered"
        else:
            positions["left_arm"] = "neutral"
        
        if right_wrist.y < right_shoulder.y:
            positions["right_arm"] = "raised"
        elif right_wrist.y > right_shoulder.y + 0.2:
            positions["right_arm"] = "lowered"
        else:
            positions["right_arm"] = "neutral"
        
        return positions

    def _calculate_facial_expressions(self, face_landmarks) -> Dict[str, float]:
        """Calculate facial expressions relevant for sign language"""
        expressions = {
            "eyebrow_raise": 0.0,
            "eye_squint": 0.0,
            "mouth_open": 0.0,
            "smile": 0.0
        }
        
        # Simplified facial expression detection
        # In a real implementation, you would use more sophisticated algorithms
        
        # Eyebrow raise (compare eyebrow and eye positions)
        left_eyebrow = face_landmarks.landmark[70]  # Approximate landmark
        left_eye = face_landmarks.landmark[33]      # Approximate landmark
        eyebrow_raise = max(0, left_eyebrow.y - left_eye.y)
        expressions["eyebrow_raise"] = min(1.0, eyebrow_raise * 5)
        
        # Mouth open (compare upper and lower lip)
        upper_lip = face_landmarks.landmark[13]     # Approximate landmark
        lower_lip = face_landmarks.landmark[14]     # Approximate landmark
        mouth_open = max(0, lower_lip.y - upper_lip.y)
        expressions["mouth_open"] = min(1.0, mouth_open * 10)
        
        return expressions

    def _calculate_sign_language_metrics(self, features: Dict[str, Any]) -> Dict[str, float]:
        """Calculate metrics specific to sign language recognition"""
        metrics = {
            "hand_visibility": 0.0,
            "signing_space_coverage": 0.0,
            "hand_symmetry": 0.0,
            "facial_expression_intensity": 0.0
        }
        
        # Hand visibility
        if features.get("hands"):
            hand_confidences = [hand["confidence"] for hand in features["hands"]]
            metrics["hand_visibility"] = sum(hand_confidences) / len(hand_confidences) if hand_confidences else 0.0
        
        # Signing space coverage (how much of the signing space is used)
        if features.get("hands") and features.get("pose"):
            hand_positions = []
            for hand in features["hands"]:
                if hand["landmarks"]:
                    wrist = hand["landmarks"][0]  # Wrist landmark
                    hand_positions.append([wrist["x"], wrist["y"], wrist["z"]])
            
            if hand_positions:
                positions_array = np.array(hand_positions)
                # Calculate spatial coverage (simplified)
                x_range = np.ptp(positions_array[:, 0])
                y_range = np.ptp(positions_array[:, 1])
                coverage = (x_range + y_range) / 2  # Normalize this as needed
                metrics["signing_space_coverage"] = min(1.0, coverage)
        
        # Hand symmetry (for two-handed signs)
        if features.get("hands") and len(features["hands"]) == 2:
            left_hand = next((h for h in features["hands"] if h["handedness"] == "Left"), None)
            right_hand = next((h for h in features["hands"] if h["handedness"] == "Right"), None)
            
            if left_hand and right_hand:
                # Compare hand positions and gestures
                left_pos = left_hand["landmarks"][0] if left_hand["landmarks"] else {"x": 0, "y": 0, "z": 0}
                right_pos = right_hand["landmarks"][0] if right_hand["landmarks"] else {"x": 0, "y": 0, "z": 0}
                
                # Calculate symmetry based on position similarity
                pos_diff = abs(left_pos["x"] - right_pos["x"]) + abs(left_pos["y"] - right_pos["y"])
                metrics["hand_symmetry"] = max(0, 1.0 - pos_diff)
        
        # Facial expression intensity
        if features.get("face") and features["face"].get("expressions"):
            expressions = features["face"]["expressions"]
            avg_expression = sum(expressions.values()) / len(expressions) if expressions else 0.0
            metrics["facial_expression_intensity"] = avg_expression
        
        return metrics

    def _calculate_overall_confidence(self, features: Dict[str, Any]) -> float:
        """Calculate overall confidence score for the frame"""
        confidence_scores = []
        
        # Hand confidence
        if features.get("hands"):
            hand_confidences = [hand["confidence"] for hand in features["hands"]]
            confidence_scores.extend(hand_confidences)
        
        # Pose confidence
        if features.get("pose") and features["pose"].get("confidence") is not None:
            confidence_scores.append(features["pose"]["confidence"])
        
        # Face confidence
        if features.get("face") and features["face"].get("confidence") is not None:
            confidence_scores.append(features["face"]["confidence"])
        
        # Sign language metrics confidence
        if features.get("sign_metrics"):
            metrics = features["sign_metrics"]
            avg_metric = sum(metrics.values()) / len(metrics) if metrics else 0.0
            confidence_scores.append(avg_metric)
        
        return sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0

    def __del__(self):
        """Cleanup MediaPipe resources"""
        try:
            self.hands.close()
            self.pose.close()
            self.face_mesh.close()
        except Exception as e:
            logger.error(f"Error cleaning up MediaPipe resources: {str(e)}")

# Example usage and testing
async def test_mediapipe_service():
    """Test the MediaPipe service with a sample image"""
    service = MediaPipeService()
    
    # Create a dummy frame for testing
    test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Convert to bytes
    _, buffer = cv2.imencode('.jpg', test_frame)
    frame_bytes = buffer.tobytes()
    
    # Process frame
    result = await service.process_frame(frame_bytes)
    
    print(f"Processing result: {result}")
    return result

if __name__ == "__main__":
    # Run test
    asyncio.run(test_mediapipe_service())
