import { POSE_LIBRARY, PoseFrame, createWellFormedHand } from './poseLibrary';
import { AnimationPlayer } from './animationPlayer';
import { applyFacialExpression } from './facialExpressions';

export class SignSequencePlayer {
  private player = new AnimationPlayer();
  private onUpdate: (frame: PoseFrame, currentGloss: string) => void;
  private shouldStop = false;

  constructor(onUpdate: (frame: PoseFrame, currentGloss: string) => void) {
    this.onUpdate = onUpdate;
  }

  private queue: any[] = [];
  private isPlaying = false;

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
      
      const gloss = typeof item === 'string' ? item : (item.gloss || item.word);
      const primitives = typeof item !== 'string' ? item.primitives : null;
      if (!gloss) continue;

      let poseData = POSE_LIBRARY[gloss];
      
      if (!poseData && primitives) {
        // Procedurally generate the animation frames from primitives
        const generateProceduralPose = (prim: any) => {
          let duration = 600;
          let lx = 0.2; let ly = 0.8; // default left idle
          let rx = 0.8; let ry = 0.8; // default right idle
          let tx = lx; let ty = ly;
          
          const loc = (prim.location || '').toUpperCase();
          const dir = (prim.direction || '').toUpperCase();
          const twoHands = prim.two_hands;

          // Map location to Y height
          let targetY = 0.5; // MID
          if (loc === 'FACE' || loc === 'HIGH') targetY = 0.3;
          if (loc === 'CHIN') targetY = 0.35;
          if (loc === 'CHEST') targetY = 0.45;
          if (loc === 'NEUTRAL') targetY = 0.6;
          
          let endRX = 0.5; let endRY = targetY;
          let endLX = 0.5; let endLY = targetY;

          // Map direction to end position
          if (dir === 'UP') { endRY = targetY - 0.2; endLY = targetY - 0.2; }
          else if (dir === 'DOWN') { endRY = targetY + 0.2; endLY = targetY + 0.2; }
          else if (dir === 'LEFT') { endRX = 0.3; endLX = 0.3; }
          else if (dir === 'RIGHT') { endRX = 0.7; endLX = 0.7; }
          
          const frames = [];
          
          // frame 1: move to target location
          frames.push({
            hands: { 
              left: createWellFormedHand(twoHands ? 0.4 : lx, twoHands ? targetY : ly, false, true),
              right: createWellFormedHand(twoHands ? 0.6 : 0.5, targetY, true, true)
            },
            face: { mouth: 'neutral', eyebrows: 'neutral' }
          });
          
          // frame 2: perform directional motion
          frames.push({
            hands: {
              left: createWellFormedHand(twoHands ? 0.4 : lx, twoHands ? endLY : ly, false, true),
              right: createWellFormedHand(twoHands ? 0.6 : endRX, endRY, true, true)
            },
            face: { mouth: 'neutral', eyebrows: 'neutral' }
          });

          // Handle repetition
          if ((prim.repetition || '').toUpperCase() === 'REPEAT') {
             duration = 1000;
             frames.push(JSON.parse(JSON.stringify(frames[0]))); // back to loc
             frames.push(JSON.parse(JSON.stringify(frames[1]))); // back to end
          }
          
          return { frames, duration };
        };
        poseData = generateProceduralPose(primitives);
      }

      if (poseData) {
        // apply facial expressions for this gloss
        const faceData = applyFacialExpression(gloss);
        const framesWithFace = poseData.frames.map(frame => ({
          ...frame,
          face: {
            mouth: faceData.mouth !== 'neutral' ? faceData.mouth : frame.face.mouth,
            eyebrows: faceData.eyebrows !== 'neutral' ? faceData.eyebrows : frame.face.eyebrows
          }
        }));

        await this.player.playFrames(framesWithFace, poseData.duration, (frame) => {
          this.onUpdate(frame, gloss);
        });
      } else {
        // If not in POSE_LIBRARY, we might want to just skip or do some default neutral pose
        // for now, we just wait a bit
        console.warn(`No pose data for gloss: ${gloss}`);
      }

      if (!this.shouldStop) {
        // small delay between words
        await new Promise(r => setTimeout(r, 250));
      }
    }
    
    this.isPlaying = false;
    
    if (!this.shouldStop) {
      // clear output to neutral
      this.onUpdate({
        hands: { 
          left: createWellFormedHand(0.2, 0.8, false, false), 
          right: createWellFormedHand(0.8, 0.8, true, false) 
        },
        face: { mouth: 'neutral', eyebrows: 'neutral' }
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
