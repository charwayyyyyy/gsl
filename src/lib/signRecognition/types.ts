export type HandShape = 'FLAT' | 'FIST' | 'OPEN' | 'PINCH' | 'UNKNOWN';
export type MotionDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'FORWARD' | 'BACKWARD' | 'STATIC' | 'UNKNOWN';
export type MotionRepetition = 'SINGLE' | 'REPEATED';
export type RelativeLocation = 'HIGH' | 'MID' | 'LOW';

export interface ExtractedFeatures {
  handShape: HandShape;
  motionDirection: MotionDirection;
  motionRepetition: MotionRepetition;
  relativeLocation: RelativeLocation;
  twoHands: boolean;
}

export interface SignProfile {
  gloss: string;
  expectedFeatures: {
    handShape: HandShape | HandShape[];
    motionDirection?: MotionDirection | MotionDirection[];
    motionRepetition?: MotionRepetition;
    relativeLocation?: RelativeLocation | RelativeLocation[];
    twoHands?: boolean;
  };
}

export interface MatchResult {
  gloss: string;
  confidence: number;
}
