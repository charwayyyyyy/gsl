import { PoseFrame } from './poseLibrary';

export const lerp = (start: number, end: number, t: number) => {
  return start + (end - start) * t;
};

export const interpolateFrames = (f1: PoseFrame, f2: PoseFrame, t: number): PoseFrame => {
  const interpHand = (h1: number[][], h2: number[][]) => {
    return h1.map((point, i) => [
      lerp(point[0], h2[i][0], t),
      lerp(point[1], h2[i][1], t)
    ]);
  };

  return {
    hands: {
      left: interpHand(f1.hands.left, f2.hands.left),
      right: interpHand(f1.hands.right, f2.hands.right)
    },
    // face changes discrete at halfway point or just copy f1
    face: t < 0.5 ? f1.face : f2.face
  };
};

export class AnimationPlayer {
  private rafId: number | null = null;
  private isPlaying = false;
  
  public playFrames(frames: PoseFrame[], durationMs: number, onUpdate: (frame: PoseFrame) => void): Promise<void> {
    return new Promise((resolve) => {
      if (frames.length === 0) {
        resolve();
        return;
      }
      if (frames.length === 1) {
        onUpdate(frames[0]);
        setTimeout(resolve, durationMs);
        return;
      }

      this.isPlaying = true;
      const startTime = performance.now();
      
      const animate = (time: number) => {
        if (!this.isPlaying) {
          resolve();
          return;
        }
        
        const elapsed = time - startTime;
        let progress = elapsed / durationMs;
        if (progress > 1) progress = 1;

        // Find which frames to interpolate between
        // total segments = frames.length - 1
        const totalSegments = frames.length - 1;
        const segmentProgress = progress * totalSegments;
        let p1Index = Math.floor(segmentProgress);
        let p2Index = Math.ceil(segmentProgress);
        
        if (p1Index >= frames.length - 1) {
          p1Index = frames.length - 2;
          p2Index = frames.length - 1;
        }

        const localProgress = segmentProgress - p1Index;
        
        const currentFrame = interpolateFrames(frames[p1Index], frames[p2Index], localProgress);
        onUpdate(currentFrame);

        if (progress < 1) {
          this.rafId = requestAnimationFrame(animate);
        } else {
          this.isPlaying = false;
          resolve();
        }
      };

      this.rafId = requestAnimationFrame(animate);
    });
  }

  public stop() {
    this.isPlaying = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
