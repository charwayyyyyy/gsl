import { 
  ExtractedFeatures, HandShape, MotionDirection, 
  RelativeLocation, HandState, FrameData,
  HandednessType, PoseContext
} from './types';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';

type Point3D = Pick<NormalizedLandmark, 'x' | 'y' | 'z'>;

function averagePoint(a: Point3D, b: Point3D): Point3D {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}

function getPoseContext(poseLandmarks?: NormalizedLandmark[]): PoseContext | undefined {
  if (!poseLandmarks || poseLandmarks.length < 25) return undefined;
  const nose = poseLandmarks[0];
  const leftShoulder = poseLandmarks[11];
  const rightShoulder = poseLandmarks[12];
  const leftHip = poseLandmarks[23];
  const rightHip = poseLandmarks[24];
  if (!nose || !leftShoulder || !rightShoulder || !leftHip || !rightHip) return undefined;

  const shoulderCenter = averagePoint(leftShoulder, rightShoulder);
  const hipCenter = averagePoint(leftHip, rightHip);
  const shoulderWidth = Math.max(0.08, Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y));
  const torsoHeight = Math.max(0.16, Math.abs(hipCenter.y - shoulderCenter.y));

  return {
    available: true,
    faceAnchor: { x: nose.x, y: nose.y, z: nose.z },
    shoulderCenter,
    hipCenter,
    shoulderWidth,
    torsoHeight,
  };
}

function toBodyRelativePoint(point: Point3D, poseContext?: PoseContext): Point3D {
  if (!poseContext?.shoulderCenter) {
    return point;
  }
  const scale = Math.max(0.08, poseContext.shoulderWidth || 0.18);
  return {
    x: (point.x - poseContext.shoulderCenter.x) / scale,
    y: (point.y - poseContext.shoulderCenter.y) / scale,
    z: point.z - poseContext.shoulderCenter.z,
  };
}

function extractHandShape(hand: NormalizedLandmark[], wrist: NormalizedLandmark): HandShape {
  const isTipExtended = (tipIdx: number, dipIdx: number) => {
    const distTip = Math.hypot(hand[tipIdx].x - wrist.x, hand[tipIdx].y - wrist.y);
    const distDip = Math.hypot(hand[dipIdx].x - wrist.x, hand[dipIdx].y - wrist.y);
    return distTip > distDip * 1.05;
  };

  const thumbExt = isTipExtended(4, 2);
  const indexExt = isTipExtended(8, 6);
  const middleExt = isTipExtended(12, 10);
  const ringExt = isTipExtended(16, 14);
  const pinkyExt = isTipExtended(20, 18);
  const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

  const pinchDist = Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y);

  if (pinchDist < 0.05) return 'PINCH';
  if (extendedCount === 1 && indexExt) return 'POINT';
  if (extendedCount >= 3) return 'OPEN';
  if (extendedCount === 0) return 'FIST';
  if (extendedCount >= 2) return 'FLAT';
  return 'UNKNOWN';
}

function getRelativeLocation(wrist: NormalizedLandmark, poseContext?: PoseContext): RelativeLocation {
  if (poseContext?.faceAnchor && poseContext.shoulderCenter && poseContext.hipCenter) {
    const shoulderWidth = Math.max(0.08, poseContext.shoulderWidth || 0.18);
    const torsoHeight = Math.max(0.16, poseContext.torsoHeight || shoulderWidth * 1.6);
    const faceDistance = Math.hypot(wrist.x - poseContext.faceAnchor.x, wrist.y - poseContext.faceAnchor.y);

    if (faceDistance <= shoulderWidth * 0.55 || wrist.y <= poseContext.shoulderCenter.y - shoulderWidth * 0.18) {
      return 'FACE';
    }
    if (wrist.y <= poseContext.shoulderCenter.y - shoulderWidth * 0.55) {
      return 'HIGH';
    }
    if (Math.abs(wrist.y - poseContext.shoulderCenter.y) <= torsoHeight * 0.45) {
      return 'CHEST';
    }
    if (wrist.y <= poseContext.hipCenter.y + torsoHeight * 0.15) {
      return 'MID';
    }
    return 'LOW';
  }

  if (wrist.y < 0.25) return 'FACE';
  if (wrist.y < 0.4) return 'HIGH';
  if (wrist.y < 0.62) return 'CHEST';
  if (wrist.y < 0.8) return 'MID';
  return 'LOW';
}

function computeMotionFeatures(wristHistory: Point3D[], timestamps: number[]) {
  if (wristHistory.length < 5) {
    return { primaryDirection: 'STATIC' as MotionDirection, averageVelocity: 0, repetition: 0, stability: 1.0 };
  }

  const oldest = wristHistory[0];
  const newest = wristHistory[wristHistory.length - 1];
  
  const dx = newest.x - oldest.x;
  const dy = newest.y - oldest.y;
  const dz = newest.z - oldest.z;
  
  const dt = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000.0; // seconds
  const distance = Math.hypot(dx, dy, dz);
  const velocity = dt > 0 ? distance / dt : 0;
  
  const threshold = 0.05; // Base movement needed
  
  let primaryDirection: MotionDirection = 'STATIC';
  if (distance > threshold) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const absZ = Math.abs(dz);

    if (absZ > absX && absZ > absY && absZ > 0.035) {
      primaryDirection = dz < 0 ? 'FORWARD' : 'BACKWARD';
    } else if (absX > absY) {
      primaryDirection = dx > 0 ? 'RIGHT' : 'LEFT';
    } else {
      primaryDirection = dy > 0 ? 'DOWN' : 'UP';
    }
  }

  // Calculate repetitions (direction changes)
  let changes = 0;
  for (let i = 2; i < wristHistory.length; i++) {
    const prevDeltaY = wristHistory[i-1].y - wristHistory[i-2].y;
    const currDeltaY = wristHistory[i].y - wristHistory[i-1].y;
    
    const prevDeltaX = wristHistory[i-1].x - wristHistory[i-2].x;
    const currDeltaX = wristHistory[i].x - wristHistory[i-1].x;

    // Check if direction inverted strongly
    if ((prevDeltaY * currDeltaY < 0 && Math.abs(currDeltaY) > 0.02) || 
        (prevDeltaX * currDeltaX < 0 && Math.abs(currDeltaX) > 0.02)) {
      changes++;
    }
  }
  
  // Repetition is roughly shifts / 2 (up/down = 1 rep)
  const repetition = Math.floor(changes / 2);
  
  // Stability proxy: straightforward line vs noisy
  const pathLength = wristHistory.slice(1).reduce((acc, pt, i) => acc + Math.hypot(pt.x - wristHistory[i].x, pt.y - wristHistory[i].y), 0);
  const stability = distance > 0 ? distance / (pathLength || 1) : 1;

  // Heuristic circular detection: noisy, multi-axis movement with direction changes.
  if (primaryDirection !== 'FORWARD' && primaryDirection !== 'BACKWARD' && changes >= 3 && stability < 0.62) {
    primaryDirection = 'CIRCULAR';
  }

  return {
    primaryDirection,
    averageVelocity: velocity,
    repetition,
    stability: Math.min(1, Math.max(0, stability)),
  };
}

export function extractFeatures(frames: FrameData[]): ExtractedFeatures | null {
  if (frames.length === 0) return null;
  const currentFrame = frames[frames.length - 1];
  
  if (!currentFrame.landmarks || currentFrame.landmarks.length === 0) return null;
  const poseContext = getPoseContext(currentFrame.poseLandmarks?.[0]);

  // Process Hand 1
  const hand1 = currentFrame.landmarks[0];
  const hand1Cat = currentFrame.handednesses?.[0]?.[0];
  const hand1Label = hand1Cat ? (hand1Cat.categoryName.toUpperCase() as HandednessType) : 'UNKNOWN';
  
  const wrist1 = hand1[0];

  const ExtractHandState = (handIndex: number): HandState => {
    const hand = currentFrame.landmarks[handIndex];
    const wrist = hand[0];
    
    const history = frames
      .map(f => {
        const frameWrist = f.landmarks[handIndex]?.[0];
        if (!frameWrist) return null;
        const framePose = getPoseContext(f.poseLandmarks?.[0]);
        return toBodyRelativePoint(frameWrist, framePose);
      })
      .filter(Boolean) as Point3D[];
    
    return {
      present: true,
      handShape: extractHandShape(hand, wrist),
      relativeLocation: getRelativeLocation(wrist, poseContext),
      motion: computeMotionFeatures(history, frames.map(f => f.timestamp))
    };
  };

  const primaryHandState = ExtractHandState(0);
  const features: ExtractedFeatures = {
    primaryHand: primaryHandState,
    pose: poseContext,
    multiHand: {
      leftHandPresent: hand1Label === 'LEFT',
      rightHandPresent: hand1Label === 'RIGHT',
      activeHand: hand1Label,
      symmetry: 0
    }
  };

  if (currentFrame.landmarks.length > 1) {
    const hand2 = currentFrame.landmarks[1];
    const hand2Cat = currentFrame.handednesses?.[1]?.[0];
    const hand2Label = hand2Cat ? (hand2Cat.categoryName.toUpperCase() as HandednessType) : 'UNKNOWN';
    
    features.secondaryHand = ExtractHandState(1);
    
    if (hand2Label === 'LEFT') features.multiHand.leftHandPresent = true;
    if (hand2Label === 'RIGHT') features.multiHand.rightHandPresent = true;

    // Determine active hand by velocity
    const v1 = features.primaryHand.motion.averageVelocity;
    const v2 = features.secondaryHand.motion.averageVelocity;
    
    if (v1 > 0.2 && v2 > 0.2) {
      features.multiHand.activeHand = 'BOTH';
    } else if (v2 > v1 * 1.5) {
      features.multiHand.activeHand = hand2Label;
      // Swap so primary is always the most active for single hand focus signs
      const temp = features.primaryHand;
      features.primaryHand = features.secondaryHand;
      features.secondaryHand = temp;
    } else {
      features.multiHand.activeHand = hand1Label;
    }

    const wrist2 = hand2[0];
    features.multiHand.interHandDistance = Math.hypot(wrist1.x - wrist2.x, wrist1.y - wrist2.y);
    features.multiHand.symmetry = features.primaryHand.handShape === features.secondaryHand.handShape ? 1 : 0.5;
  }

  return features;
}
