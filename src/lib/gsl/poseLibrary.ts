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

// Anatomically spread hand out
export const createWellFormedHand = (x: number, y: number, isRight: boolean = false, pointingUp: boolean = true) => {
  const hand = Array(21).fill([x, y]);
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

const createBasicFrame = (lx = 0.5, ly = 0.5, rx = 0.5, ry = 0.5): PoseFrame => ({
  hands: {
    left: createWellFormedHand(lx, ly, false, true),
    right: createWellFormedHand(rx, ry, true, true)
  },
  face: { mouth: 'neutral', eyebrows: 'neutral' }
});

export const POSE_LIBRARY: Record<string, { frames: PoseFrame[]; duration: number }> = {
  'HELLO': {
    frames: [
      createBasicFrame(0.2, 0.8, 0.4, 0.4),
      createBasicFrame(0.2, 0.8, 0.5, 0.2), // raise right hand
      createBasicFrame(0.2, 0.8, 0.6, 0.2) // wave
    ],
    duration: 800
  },
  'MY': {
    frames: [
      createBasicFrame(0.2, 0.8, 0.5, 0.5),
      createBasicFrame(0.2, 0.8, 0.5, 0.4) // point towards self
    ],
    duration: 500
  },
  'NAME': {
    frames: [
      createBasicFrame(0.4, 0.4, 0.6, 0.4), // both hands up
      createBasicFrame(0.45, 0.4, 0.55, 0.4) // tap fingers
    ],
    duration: 600
  }
};
