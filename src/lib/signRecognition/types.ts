export type HandShape = 'FLAT' | 'FIST' | 'OPEN' | 'PINCH' | 'POINT' | 'CURVED' | 'UNKNOWN';
export type MotionDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'FORWARD' | 'BACKWARD' | 'STATIC' | 'CIRCULAR' | 'UNKNOWN';
export type RelativeLocation = 'HIGH' | 'MID' | 'LOW' | 'FACE' | 'CHEST' | 'NEUTRAL';
export type HandednessType = 'LEFT' | 'RIGHT' | 'UNKNOWN';

export interface MotionFeatures {
  primaryDirection: MotionDirection;
  averageVelocity: number;
  repetition: number;
  stability: number;
}

export interface HandState {
  present: boolean;
  handShape: HandShape;
  relativeLocation: RelativeLocation;
  motion: MotionFeatures;
}

export interface MultiHandFeatures {
  leftHandPresent: boolean;
  rightHandPresent: boolean;
  activeHand: HandednessType | 'BOTH';
  interHandDistance?: number;
  symmetry: number;
}

export interface ExtractedFeatures {
  primaryHand: HandState;
  secondaryHand?: HandState;
  multiHand: MultiHandFeatures;
}

export interface SignProfile {
  id: string;
  gloss: string;
  handshape: HandShape[];
  handedness?: 'LEFT' | 'RIGHT' | 'RIGHT_OR_LEFT';
  location: RelativeLocation | RelativeLocation[];
  locationTolerance?: number; // 0.0 to 1.0
  motion: {
    primaryDirection: MotionDirection | MotionDirection[];
    movementType?: 'LINEAR' | 'CIRCULAR';
    repetition?: number; // minimum repetition count (e.g. 0, 1, 2)
  };
  orientation?: 'FORWARD' | 'UP' | 'DOWN' | 'IN' | 'OUT';
  requiresTwoHands: boolean;
  stabilityFrames?: number; 
}

export interface ScoreBreakdown {
  handshape: number;
  location: number;
  motion: number;
  handedness: number;
  multiHand: number;
  facial: number;
}

export interface MatchResult {
  gloss: string;
  confidence: number;
  breakdown: ScoreBreakdown;
  status?: 'reject' | 'tentative' | 'accept';
}

export interface FrameData {
  timestamp: number;
  landmarks: import('@mediapipe/tasks-vision').NormalizedLandmark[][];
  handednesses: import('@mediapipe/tasks-vision').Category[][];
}
