import React, { useEffect, useRef } from 'react';
import { PoseFrame } from '../lib/gsl/poseLibrary';

interface SkeletalAvatarProps {
  currentFrame: PoseFrame | null;
  showDebug?: boolean;
  playingGloss?: string;
}

const CONNECTIONS = [
  // thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // pinky
  [0, 17], [17, 18], [18, 19], [19, 20]
];

// sign.mt / Mediapipe standard hand tracking colors
const LEFT_HAND_COLOR = '#FF9900'; // Orange
const RIGHT_HAND_COLOR = '#00FFFF'; // Cyan
const BODY_COLOR = '#FFFFFF'; // White

export const SkeletalAvatar: React.FC<SkeletalAvatarProps> = ({ currentFrame, showDebug = false, playingGloss = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base body structure (Torso + Head + Arms)
    ctx.lineWidth = 6;
    ctx.strokeStyle = BODY_COLOR; // white lines
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Face/Head (rough approximation)
    ctx.beginPath();
    ctx.ellipse(300, 150, 45, 60, 0, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Face details
    if (currentFrame?.face.mouth === 'smile') {
      ctx.beginPath(); // Smile arc
      ctx.arc(300, 180, 15, 0, Math.PI, false);
      ctx.stroke();
    } else {
      ctx.beginPath(); // Neutral line
      ctx.moveTo(285, 180);
      ctx.lineTo(315, 180);
      ctx.stroke();
    }

    // Brows
    if (currentFrame?.face.eyebrows === 'raised') {
      ctx.beginPath(); ctx.moveTo(270, 115); ctx.lineTo(290, 105); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(330, 115); ctx.lineTo(310, 105); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(270, 120); ctx.lineTo(290, 120); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(330, 120); ctx.lineTo(310, 120); ctx.stroke();
    }

    // Eyes
    ctx.beginPath(); ctx.arc(285, 140, 2, 0, 2 * Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(315, 140, 2, 0, 2 * Math.PI); ctx.fill();

    // Body
    ctx.beginPath();
    ctx.moveTo(300, 210); // neck
    ctx.lineTo(300, 240); // center chest
    
    // Shoulders
    ctx.moveTo(200, 240);
    ctx.lineTo(400, 240);
    
    // Torso sides
    ctx.moveTo(200, 240); ctx.lineTo(250, 500);
    ctx.moveTo(400, 240); ctx.lineTo(350, 500);
    ctx.moveTo(250, 500); ctx.lineTo(350, 500);
    ctx.stroke();

    if (currentFrame) {
      // Arms connecting from shoulders to wrist (landmark 0)
      const lx = currentFrame.hands.left[0][0] * canvas.width;
      const ly = currentFrame.hands.left[0][1] * canvas.height;
      const rx = currentFrame.hands.right[0][0] * canvas.width;
      const ry = currentFrame.hands.right[0][1] * canvas.height;

      // Draw arms
      ctx.beginPath();
      ctx.moveTo(200, 240); // left shoulder
      ctx.lineTo(lx, ly);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(400, 240); // right shoulder
      ctx.lineTo(rx, ry);
      ctx.stroke();

      // Draw hands
      const drawHand = (hand: number[][], color: string) => {
        CONNECTIONS.forEach(([start, end]) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(hand[start][0] * canvas.width, hand[start][1] * canvas.height);
          ctx.lineTo(hand[end][0] * canvas.width, hand[end][1] * canvas.height);
          ctx.stroke();
        });

        // Always draw joint nodes like sign.mt
        ctx.fillStyle = color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        hand.forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x * canvas.width, y * canvas.height, 3.5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        });
      };

      drawHand(currentFrame.hands.left, LEFT_HAND_COLOR);
      drawHand(currentFrame.hands.right, RIGHT_HAND_COLOR);
    }

  }, [currentFrame, showDebug]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-black rounded-lg overflow-hidden relative">
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={600} 
        className="max-w-full max-h-full object-contain absolute z-10"
      />
      {showDebug && playingGloss && (
        <div className="absolute top-4 left-4 z-20 bg-black/80 px-4 py-2 rounded-lg border border-white/20 text-white font-mono text-sm tracking-widest uppercase">
          DEBUG: {playingGloss}
        </div>
      )}
    </div>
  );
};

export default SkeletalAvatar;
