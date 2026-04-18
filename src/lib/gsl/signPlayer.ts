import { POSE_LIBRARY, PoseFrame, createWellFormedHand } from './poseLibrary';
import { AnimationPlayer } from './animationPlayer';
import { applyFacialExpression } from './facialExpressions';

// Generate a procedural pose animation from sign primitives or sensible defaults
function generateProceduralPose(prim: {
  location?: string;
  direction?: string;
  two_hands?: boolean;
  repetition?: string;
}): { frames: PoseFrame[]; duration: number } {
  let duration = 700;
  const lx = 0.2; const ly = 0.8; // idle left
  const rx = 0.8; // idle right

  const loc = (prim.location || 'CHEST').toUpperCase();
  const dir = (prim.direction || 'STATIC').toUpperCase();
  const twoHands = Boolean(prim.two_hands);

  // Map location → Y position on canvas
  let targetY = 0.5;
  if (loc === 'FACE' || loc === 'HIGH')  targetY = 0.28;
  else if (loc === 'CHIN')               targetY = 0.33;
  else if (loc === 'CHEST')              targetY = 0.45;
  else if (loc === 'NEUTRAL')            targetY = 0.60;

  // Starting X positions
  const startLX = twoHands ? 0.38 : lx;
  const startRX = twoHands ? 0.62 : 0.55;

  // End positions based on motion direction
  let endLX = startLX; let endLY = targetY;
  let endRX = startRX; let endRY = targetY;

  if      (dir === 'UP')       { endLY = targetY - 0.18; endRY = targetY - 0.18; }
  else if (dir === 'DOWN')     { endLY = targetY + 0.18; endRY = targetY + 0.18; }
  else if (dir === 'LEFT')     { endLX = startLX - 0.15; endRX = startRX - 0.15; }
  else if (dir === 'RIGHT')    { endLX = startLX + 0.15; endRX = startRX + 0.15; }
  else if (dir === 'FORWARD')  { /* keep same X/Y, depth only */ }

  const frames: PoseFrame[] = [];

  // Frame 0: Neutral ready position (hands drop to sides)
  frames.push({
    hands: {
      left:  createWellFormedHand(lx, ly,      false, true),
      right: createWellFormedHand(rx, 0.8,     true,  true),
    },
    face: { mouth: 'neutral', eyebrows: 'neutral' },
  });

  // Frame 1: Hands move to sign location
  frames.push({
    hands: {
      left:  createWellFormedHand(startLX, targetY, false, true),
      right: createWellFormedHand(startRX, targetY, true,  true),
    },
    face: { mouth: 'neutral', eyebrows: 'neutral' },
  });

  // Frame 2: Perform directional motion
  frames.push({
    hands: {
      left:  createWellFormedHand(endLX, endLY, false, true),
      right: createWellFormedHand(endRX, endRY, true,  true),
    },
    face: { mouth: 'neutral', eyebrows: 'neutral' },
  });

  // Handle repetition — bounce back to Frame 1 then Frame 2 again
  if ((prim.repetition || '').toUpperCase() === 'REPEAT') {
    duration = 1100;
    frames.push(JSON.parse(JSON.stringify(frames[1])));
    frames.push(JSON.parse(JSON.stringify(frames[2])));
  }

  // Frame last: Return to neutral
  frames.push({
    hands: {
      left:  createWellFormedHand(lx, ly,  false, false),
      right: createWellFormedHand(rx, 0.8, true,  false),
    },
    face: { mouth: 'neutral', eyebrows: 'neutral' },
  });

  return { frames, duration };
}

export class SignSequencePlayer {
  private player = new AnimationPlayer();
  private onUpdate: (frame: PoseFrame, currentGloss: string) => void;
  private shouldStop = false;
  private queue: any[] = [];
  private isPlaying = false;

  constructor(onUpdate: (frame: PoseFrame, currentGloss: string) => void) {
    this.onUpdate = onUpdate;
  }

  public async playGlossSequence(sequence: any[]) {
    this.stop();
    this.queue = [...sequence];
    this.shouldStop = false;

    if (!this.isPlaying) {
      this.isPlaying = true;
      await this.processQueue();
    }
  }

  private async processQueue() {
    while (this.queue.length > 0 && !this.shouldStop) {
      const item = this.queue.shift();
      if (!item) continue;

      const gloss = typeof item === 'string' ? item : (item.gloss || item.word || '');
      const primitives = typeof item !== 'string' ? (item.primitives ?? null) : null;
      if (!gloss) continue;

      // 1. Try static POSE_LIBRARY first
      let poseData = POSE_LIBRARY[gloss.toUpperCase()] || POSE_LIBRARY[gloss];

      // 2. Fallback: procedural generation from primitives (or sane defaults)
      if (!poseData) {
        poseData = generateProceduralPose(
          primitives ?? { location: 'CHEST', direction: 'STATIC', two_hands: true, repetition: 'SINGLE' }
        );
      }

      // 3. Overlay facial expressions
      const faceData = applyFacialExpression(gloss);
      const framesWithFace: PoseFrame[] = poseData.frames.map(frame => ({
        ...frame,
        face: {
          mouth:    faceData.mouth    !== 'neutral' ? faceData.mouth    : frame.face.mouth,
          eyebrows: faceData.eyebrows !== 'neutral' ? faceData.eyebrows : frame.face.eyebrows,
        },
      }));

      // 4. Play the frames
      await this.player.playFrames(framesWithFace, poseData.duration, frame => {
        this.onUpdate(frame, gloss);
      });

      if (!this.shouldStop) {
        // short pause between words
        await new Promise(r => setTimeout(r, 250));
      }
    }

    this.isPlaying = false;

    // Return to neutral idle pose
    if (!this.shouldStop) {
      this.onUpdate({
        hands: {
          left:  createWellFormedHand(0.2, 0.8, false, false),
          right: createWellFormedHand(0.8, 0.8, true,  false),
        },
        face: { mouth: 'neutral', eyebrows: 'neutral' },
      }, '');
    }
  }

  public stop() {
    this.shouldStop = true;
    this.player.stop();
    this.queue = [];
    this.isPlaying = false;
  }
}
