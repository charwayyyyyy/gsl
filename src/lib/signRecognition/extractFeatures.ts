import { 
  ExtractedFeatures, HandShape, MotionDirection, 
  RelativeLocation, HandState, FrameData, MultiHandFeatures,
  HandednessType
} from './types';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';

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

function getRelativeLocation(wrist: NormalizedLandmark): RelativeLocation {
  if (wrist.y < 0.3) return 'HIGH';
  if (wrist.y < 0.6) return 'MID';
  return 'LOW';
}

function computeMotionFeatures(wristHistory: NormalizedLandmark[], timestamps: number[]) {
  if (wristHistory.length < 5) {
    return { primaryDirection: 'STATIC' as MotionDirection, averageVelocity: 0, repetition: 0, stability: 1.0 };
  }

  const oldest = wristHistory[0];
  const newest = wristHistory[wristHistory.length - 1];
  
  const dx = newest.x - oldest.x;
  const dy = newest.y - oldest.y;
  
  const dt = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000.0; // seconds
  const distance = Math.hypot(dx, dy);
  const velocity = dt > 0 ? distance / dt : 0;
  
  const threshold = 0.05; // Base movement needed
  
  let primaryDirection: MotionDirection = 'STATIC';
  if (distance > threshold) {
    if (Math.abs(dx) > Math.abs(dy)) {
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

  // Process Hand 1
  const hand1 = currentFrame.landmarks[0];
  const hand1Cat = currentFrame.handednesses?.[0]?.[0];
  const hand1Label = hand1Cat ? (hand1Cat.categoryName.toUpperCase() as HandednessType) : 'UNKNOWN';
  
  const wrist1 = hand1[0];

  const ExtractHandState = (handIndex: number): HandState => {
    const hand = currentFrame.landmarks[handIndex];
    const wrist = hand[0];
    
    const history = frames
      .map(f => f.landmarks[handIndex]?.[0])
      .filter(Boolean) as NormalizedLandmark[];
    
    return {
      present: true,
      handShape: extractHandShape(hand, wrist),
      relativeLocation: getRelativeLocation(wrist),
      motion: computeMotionFeatures(history, frames.map(f => f.timestamp))
    };
  };

  const primaryHandState = ExtractHandState(0);
  const features: ExtractedFeatures = {
    primaryHand: primaryHandState,
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
