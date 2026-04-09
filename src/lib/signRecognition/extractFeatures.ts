import type { HandLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { ExtractedFeatures, HandShape, MotionDirection, MotionRepetition, RelativeLocation } from './types';

export interface FrameData {
  timestamp: number;
  landmarks: NormalizedLandmark[][];
}

export function extractFeatures(frames: FrameData[]): ExtractedFeatures | null {
  if (frames.length === 0) return null;
  const currentFrame = frames[frames.length - 1];
  if (!currentFrame.landmarks || currentFrame.landmarks.length === 0) return null;

  const hand = currentFrame.landmarks[0]; // primary hand
  const wrist = hand[0];

  // 1. Hand Shape
  const isTipExtended = (tipIdx: number, dipIdx: number) => {
    // A tip is extended if it's further from the wrist than the DIP joint
    const distTip = Math.hypot(hand[tipIdx].x - wrist.x, hand[tipIdx].y - wrist.y);
    const distDip = Math.hypot(hand[dipIdx].x - wrist.x, hand[dipIdx].y - wrist.y);
    return distTip > distDip * 1.1; // generous threshold
  };

  const indexExt = isTipExtended(8, 6);
  const middleExt = isTipExtended(12, 10);
  const ringExt = isTipExtended(16, 14);
  const pinkyExt = isTipExtended(20, 18);
  const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

  const pinchDist = Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y);

  let handShape: HandShape = 'UNKNOWN';
  if (pinchDist < 0.05) {
    handShape = 'PINCH';
  } else if (extendedCount >= 3) {
    handShape = 'OPEN';
  } else if (extendedCount === 0) {
    handShape = 'FIST';
  } else if (extendedCount >= 2) {
    handShape = 'FLAT';
  }

  // 2. Relative Location
  // Y goes 0 (top) to 1 (bottom). 
  let relativeLocation: RelativeLocation = 'LOW';
  if (wrist.y < 0.4) relativeLocation = 'HIGH';
  else if (wrist.y < 0.7) relativeLocation = 'MID';

  // 3. Motion Detection (look at wrist over the last N frames)
  let motionDirection: MotionDirection = 'STATIC';
  let motionRepetition: MotionRepetition = 'SINGLE';

  if (frames.length > 5) {
    const oldestFrame = frames[Math.max(0, frames.length - 15)];
    if (oldestFrame.landmarks && oldestFrame.landmarks.length > 0) {
      const oldWrist = oldestFrame.landmarks[0][0];
      const dx = wrist.x - oldWrist.x;
      const dy = wrist.y - oldWrist.y;
      
      const threshold = 0.05; // 5% of screen movement
      
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > threshold) motionDirection = 'RIGHT';
        else if (dx < -threshold) motionDirection = 'LEFT';
      } else {
        if (dy > threshold) motionDirection = 'DOWN';
        else if (dy < -threshold) motionDirection = 'UP';
      }
      
      // Rough repetition heuristic based on direction inversions could be here,
      // but for V1 we keep it basic.
      if (Math.abs(dx) > threshold*3 || Math.abs(dy) > threshold*3) {
        motionRepetition = 'SINGLE'; // Long stroke
      } else {
        motionRepetition = 'REPEATED'; // Micro movements
      }
    }
  }

  return {
    handShape,
    motionDirection,
    relativeLocation,
    motionRepetition,
    twoHands: currentFrame.landmarks.length > 1
  };
}
