import React, { useEffect, useRef } from 'react';
import { PoseFrame, createWellFormedHand } from '../lib/gsl/poseLibrary';
import { drawBody } from './avatar/drawBody';
import { drawHand } from './avatar/drawHand';
import { drawFace, FaceState } from './avatar/drawFace';

interface SkeletalAvatarProps {
  currentFrame: PoseFrame | null;
  showDebug?: boolean;
  playingGloss?: string;
}

// Low-pass filter for smooth motion interpolation
const lerp = (current: number, target: number, factor = 0.25) => {
  return current + (target - current) * factor;
};

const SkeletalAvatar: React.FC<SkeletalAvatarProps> = ({ currentFrame, showDebug = false, playingGloss = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smoothedHands = useRef({
    left: createWellFormedHand(0.2, 0.8, false, false),
    right: createWellFormedHand(0.8, 0.8, true, false),
  });

  useEffect(() => {
    let animationId: number;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Ensure stable framerate rendering
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Resolve targets (either currentFrame or default idle)
      const targetLeft = (currentFrame?.hands.left && currentFrame.hands.left.length > 0) 
        ? currentFrame.hands.left 
        : createWellFormedHand(0.2, 0.8, false, false);
        
      const targetRight = (currentFrame?.hands.right && currentFrame.hands.right.length > 0) 
        ? currentFrame.hands.right 
        : createWellFormedHand(0.8, 0.8, true, false);

      // Perform interpolation step (Part 5 Smooth Motion)
      const interpHands = (smoothed: number[][], target: number[][]) => {
        return target.map((point, i) => [
          lerp(smoothed[i][0], point[0]),
          lerp(smoothed[i][1], point[1])
        ]);
      };

      smoothedHands.current.left = interpHands(smoothedHands.current.left, targetLeft);
      smoothedHands.current.right = interpHands(smoothedHands.current.right, targetRight);

      // Render Pipeline (Part 7 Clean Render)
      const lx = smoothedHands.current.left[0][0] * canvas.width;
      const ly = smoothedHands.current.left[0][1] * canvas.height;
      const rx = smoothedHands.current.right[0][0] * canvas.width;
      const ry = smoothedHands.current.right[0][1] * canvas.height;

      // 1. Draw Body
      drawBody(ctx, lx, ly, rx, ry);

      // 2. Draw Hands explicitly (Left then Right)
      drawHand(ctx, smoothedHands.current.left, canvas.width, canvas.height, true);
      drawHand(ctx, smoothedHands.current.right, canvas.width, canvas.height, false);

      // 3. Draw Face
      const faceState: FaceState = {
        eyebrows: (currentFrame?.face.eyebrows as any) || "neutral",
        mouth: (currentFrame?.face.mouth as any) || "neutral",
      };
      drawFace(ctx, faceState);

      // Continue render loop
      animationId = requestAnimationFrame(renderLoop);
    };

    animationId = requestAnimationFrame(renderLoop);

    return () => cancelAnimationFrame(animationId);
  }, [currentFrame]); // Also triggers on currentFrame change to ensure latest targets

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#F9F9F9] rounded-lg overflow-hidden relative border border-gray-100 shadow-inner">
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={600} 
        className="max-w-full max-h-full object-contain filter drop-shadow-md"
      />
      {showDebug && playingGloss && (
        <div className="absolute top-4 left-4 bg-black/60 text-white text-xs font-mono px-3 py-1.5 rounded-md backdrop-blur-sm">
          {playingGloss}
        </div>
      )}
    </div>
  );
};

export default SkeletalAvatar;
