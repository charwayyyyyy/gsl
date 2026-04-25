export type PoseFrame = {
  hands: {
    left: number[][];   // 21 landmarks [x, y], normalized
    right: number[][];
  };
  face: {
    mouth: string;
    eyebrows: string;
  };
};

type HandSpec = {
  x: number;
  y: number;
  up?: boolean;
};

type FaceSpec = Partial<PoseFrame['face']>;

type PoseData = {
  frames: PoseFrame[];
  duration: number;
};

// Anatomically spread hand out
export const createWellFormedHand = (x: number, y: number, isRight: boolean = false, pointingUp: boolean = true) => {
  const hand = Array.from({ length: 21 }, () => [x, y]);
  const dirY = pointingUp ? -1 : 1; 
  const dirX = isRight ? 1 : -1;

  hand[0] = [x, y]; // Wrist
  // Thumb (fanning outward horizontally, slightly up/down depending on hand)
  hand[1] = [x + dirX * 0.02, y + dirY * 0.01]; 
  hand[2] = [x + dirX * 0.04, y + dirY * 0.02]; 
  hand[3] = [x + dirX * 0.05, y + dirY * 0.03]; 
  hand[4] = [x + dirX * 0.06, y + dirY * 0.04];
  // Index
  hand[5] = [x + dirX * 0.01, y + dirY * 0.04]; 
  hand[6] = [x + dirX * 0.02, y + dirY * 0.06]; 
  hand[7] = [x + dirX * 0.03, y + dirY * 0.08]; 
  hand[8] = [x + dirX * 0.03, y + dirY * 0.10];
  // Middle
  hand[9] = [x - dirX * 0.01, y + dirY * 0.04]; 
  hand[10] = [x - dirX * 0.01, y + dirY * 0.06]; 
  hand[11] = [x - dirX * 0.01, y + dirY * 0.08]; 
  hand[12] = [x - dirX * 0.01, y + dirY * 0.10];
  // Ring
  hand[13] = [x - dirX * 0.03, y + dirY * 0.03]; 
  hand[14] = [x - dirX * 0.04, y + dirY * 0.05]; 
  hand[15] = [x - dirX * 0.05, y + dirY * 0.06]; 
  hand[16] = [x - dirX * 0.05, y + dirY * 0.08];
  // Pinky
  hand[17] = [x - dirX * 0.04, y + dirY * 0.01]; 
  hand[18] = [x - dirX * 0.05, y + dirY * 0.02]; 
  hand[19] = [x - dirX * 0.06, y + dirY * 0.03]; 
  hand[20] = [x - dirX * 0.07, y + dirY * 0.04];
  
  return hand;
};

const HAND = {
  leftIdle: { x: 0.22, y: 0.82, up: false },
  rightIdle: { x: 0.78, y: 0.82, up: false },
  chestLeft: { x: 0.44, y: 0.46, up: true },
  chestRight: { x: 0.56, y: 0.46, up: true },
  centerLeft: { x: 0.46, y: 0.54, up: true },
  centerRight: { x: 0.54, y: 0.54, up: true },
  faceLeft: { x: 0.40, y: 0.30, up: true },
  faceRight: { x: 0.60, y: 0.30, up: true },
  chinRight: { x: 0.60, y: 0.36, up: true },
  templeRight: { x: 0.62, y: 0.22, up: true },
  foreheadRight: { x: 0.58, y: 0.18, up: true },
  mouthRight: { x: 0.60, y: 0.40, up: true },
  forwardLeft: { x: 0.34, y: 0.48, up: true },
  forwardRight: { x: 0.66, y: 0.48, up: true },
  farLeft: { x: 0.24, y: 0.42, up: true },
  farRight: { x: 0.76, y: 0.42, up: true },
  lowLeft: { x: 0.44, y: 0.68, up: true },
  lowRight: { x: 0.56, y: 0.68, up: true },
  crossLeft: { x: 0.49, y: 0.42, up: true },
  crossRight: { x: 0.51, y: 0.42, up: true },
  openBookLeft: { x: 0.42, y: 0.58, up: true },
  openBookRight: { x: 0.58, y: 0.58, up: true },
  helpLeft: { x: 0.47, y: 0.58, up: true },
  helpRight: { x: 0.57, y: 0.45, up: true },
  selfRight: { x: 0.54, y: 0.44, up: true },
  pointRight: { x: 0.72, y: 0.38, up: true },
};

const createFrame = ({ left, right, face }: { left?: HandSpec; right?: HandSpec; face?: FaceSpec }): PoseFrame => ({
  hands: {
    left: createWellFormedHand(left?.x ?? HAND.leftIdle.x, left?.y ?? HAND.leftIdle.y, false, left?.up ?? HAND.leftIdle.up),
    right: createWellFormedHand(right?.x ?? HAND.rightIdle.x, right?.y ?? HAND.rightIdle.y, true, right?.up ?? HAND.rightIdle.up),
  },
  face: {
    mouth: face?.mouth ?? 'neutral',
    eyebrows: face?.eyebrows ?? 'neutral',
  },
});

const createSequence = (
  steps: Array<{ left?: HandSpec; right?: HandSpec; face?: FaceSpec }>,
  duration: number,
): PoseData => ({
  frames: steps.map(createFrame),
  duration,
});

const BASE_POSE_LIBRARY: Record<string, PoseData> = {
  HELLO: createSequence([
    {},
    { right: HAND.faceRight },
    { right: HAND.farRight, face: { mouth: 'smile' } },
    { right: HAND.faceRight, face: { mouth: 'smile' } },
  ], 850),
  MY: createSequence([
    {},
    { right: HAND.selfRight },
    { right: HAND.chestRight },
  ], 560),
  I: createSequence([
    {},
    { right: HAND.selfRight },
    { right: HAND.chestRight },
  ], 560),
  ME: createSequence([
    {},
    { right: HAND.selfRight },
    { right: HAND.chestRight },
  ], 560),
  NAME: createSequence([
    {},
    { left: HAND.centerLeft, right: HAND.centerRight },
    { left: HAND.chestLeft, right: HAND.chestRight },
    { left: HAND.centerLeft, right: HAND.centerRight },
  ], 720),
  GOOD: createSequence([
    {},
    { right: HAND.chestRight, face: { mouth: 'smile' } },
    { right: HAND.forwardRight, face: { mouth: 'smile' } },
    { right: HAND.chestRight, face: { mouth: 'smile' } },
  ], 760),
  MORNING: createSequence([
    {},
    { right: HAND.lowRight },
    { right: HAND.faceRight, face: { eyebrows: 'raised' } },
    { right: HAND.forwardRight, face: { eyebrows: 'raised' } },
  ], 820),
  THANK: createSequence([
    {},
    { right: HAND.chinRight, face: { mouth: 'smile' } },
    { right: HAND.forwardRight, face: { mouth: 'smile' } },
    { right: HAND.pointRight, face: { mouth: 'smile' } },
  ], 780),
  YOU: createSequence([
    {},
    { right: HAND.pointRight },
    { right: HAND.farRight },
  ], 620),
  HELP: createSequence([
    {},
    { left: HAND.helpLeft, right: HAND.helpRight },
    { left: HAND.forwardLeft, right: HAND.forwardRight },
    { left: HAND.helpLeft, right: HAND.helpRight },
  ], 840),
  HOW: createSequence([
    {},
    { left: HAND.centerLeft, right: HAND.centerRight, face: { eyebrows: 'raised' } },
    { left: HAND.forwardLeft, right: HAND.forwardRight, face: { eyebrows: 'raised' } },
    { left: HAND.farLeft, right: HAND.farRight, face: { eyebrows: 'raised' } },
  ], 820),
  TODAY: createSequence([
    {},
    { right: HAND.faceRight, face: { eyebrows: 'raised' } },
    { right: HAND.forwardRight },
    { right: HAND.lowRight },
  ], 760),
  TEACHER: createSequence([
    {},
    { left: HAND.faceLeft, right: HAND.templeRight },
    { left: HAND.chestLeft, right: HAND.chestRight },
    { left: HAND.forwardLeft, right: HAND.forwardRight },
  ], 900),
  GHANA: createSequence([
    {},
    { right: HAND.chestRight },
    { right: HAND.forwardRight, face: { mouth: 'smile' } },
    { right: HAND.faceRight },
  ], 800),
  YES: createSequence([
    {},
    { right: HAND.centerRight },
    { right: { ...HAND.centerRight, y: 0.62 } },
    { right: { ...HAND.centerRight, y: 0.46 } },
  ], 650),
  NO: createSequence([
    {},
    { right: HAND.mouthRight },
    { right: HAND.faceRight },
    { right: HAND.mouthRight },
  ], 640),
  PLEASE: createSequence([
    {},
    { right: HAND.chestRight, face: { mouth: 'smile' } },
    { right: { ...HAND.chestRight, x: 0.62, y: 0.50 }, face: { mouth: 'smile' } },
    { right: { ...HAND.chestRight, x: 0.50, y: 0.42 }, face: { mouth: 'smile' } },
  ], 820),
  SORRY: createSequence([
    {},
    { right: HAND.chestRight, face: { eyebrows: 'frown' } },
    { right: { ...HAND.chestRight, x: 0.62, y: 0.50 }, face: { eyebrows: 'frown' } },
    { right: HAND.chestRight, face: { eyebrows: 'frown' } },
  ], 820),
  LOVE: createSequence([
    {},
    { left: HAND.crossLeft, right: HAND.crossRight, face: { mouth: 'smile' } },
    { left: HAND.chestLeft, right: HAND.chestRight, face: { mouth: 'smile' } },
  ], 720),
  BOOK: createSequence([
    {},
    { left: HAND.centerLeft, right: HAND.centerRight },
    { left: HAND.openBookLeft, right: HAND.openBookRight },
    { left: HAND.forwardLeft, right: HAND.forwardRight },
  ], 760),
  SCHOOL: createSequence([
    {},
    { left: HAND.centerLeft, right: HAND.centerRight },
    { left: HAND.chestLeft, right: HAND.chestRight },
    { left: HAND.centerLeft, right: HAND.centerRight },
  ], 760),
  FAMILY: createSequence([
    {},
    { left: HAND.centerLeft, right: HAND.centerRight, face: { mouth: 'smile' } },
    { left: HAND.faceLeft, right: HAND.faceRight, face: { mouth: 'smile' } },
    { left: HAND.forwardLeft, right: HAND.forwardRight, face: { mouth: 'smile' } },
  ], 900),
  FRIEND: createSequence([
    {},
    { left: HAND.centerLeft, right: HAND.centerRight },
    { left: HAND.chestLeft, right: HAND.chestRight, face: { mouth: 'smile' } },
    { left: HAND.forwardLeft, right: HAND.forwardRight, face: { mouth: 'smile' } },
  ], 820),
  WORK: createSequence([
    {},
    { left: HAND.centerLeft, right: HAND.centerRight },
    { left: HAND.chestLeft, right: HAND.centerRight },
    { left: HAND.centerLeft, right: HAND.chestRight },
  ], 720),
  STUDENT: createSequence([
    {},
    { right: HAND.foreheadRight },
    { left: HAND.centerLeft, right: HAND.centerRight },
    { left: HAND.openBookLeft, right: HAND.openBookRight },
  ], 860),
  WATER: createSequence([
    {},
    { right: HAND.mouthRight },
    { right: { ...HAND.mouthRight, y: 0.36 } },
    { right: HAND.mouthRight },
  ], 660),
  FOOD: createSequence([
    {},
    { right: HAND.mouthRight },
    { right: HAND.centerRight, face: { mouth: 'smile' } },
    { right: HAND.mouthRight, face: { mouth: 'smile' } },
  ], 680),
};

export const POSE_LIBRARY: Record<string, PoseData> = {
  ...BASE_POSE_LIBRARY,
  'THANK YOU': BASE_POSE_LIBRARY.THANK,
  THANK_YOU: BASE_POSE_LIBRARY.THANK,
  'GOOD MORNING': createSequence([
    {},
    { right: HAND.chestRight, face: { mouth: 'smile' } },
    { right: HAND.lowRight },
    { right: HAND.faceRight, face: { eyebrows: 'raised' } },
    { right: HAND.forwardRight, face: { mouth: 'smile' } },
  ], 1100),
  GOOD_MORNING: createSequence([
    {},
    { right: HAND.chestRight, face: { mouth: 'smile' } },
    { right: HAND.lowRight },
    { right: HAND.faceRight, face: { eyebrows: 'raised' } },
    { right: HAND.forwardRight, face: { mouth: 'smile' } },
  ], 1100),
};
