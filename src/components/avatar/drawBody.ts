export const drawBody = (
  ctx: CanvasRenderingContext2D,
  lx: number, ly: number,
  rx: number, ry: number
) => {
  const styles = {
    body: "#FF3B3B", // red torso
    joints: "#FF6B6B"
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;

  const neckY = 190;
  const chestY = 220;
  const shoulderWidth = 140;
  const waistWidth = 90;
  const waistY = 450;
  
  const midX = 300;

  // Shoulders & Torso Points
  const leftShoulderX = midX - shoulderWidth;
  const rightShoulderX = midX + shoulderWidth;
  const leftWaistX = midX - waistWidth;
  const rightWaistX = midX + waistWidth;

  // Torso Geometry (Trapezoid outline)
  ctx.strokeStyle = styles.body;
  ctx.beginPath();
  ctx.moveTo(leftShoulderX, chestY);
  ctx.lineTo(rightShoulderX, chestY);
  ctx.lineTo(rightWaistX, waistY);
  ctx.lineTo(leftWaistX, waistY);
  ctx.closePath();
  ctx.stroke();

  // Neck
  ctx.beginPath();
  ctx.moveTo(midX, neckY);
  ctx.lineTo(midX, chestY);
  ctx.stroke();

  // --- Depth Illusion & Arms ---
  
  // Left Arm (Usually further away if signing left-handed or standard)
  // Let's implement partial opacity for the left arm to give depth
  ctx.globalAlpha = 0.6; // Further back
  
  // Predict elbow location based on shoulder and wrist
  // Usually elbow naturally hangs down but pushes out
  const distL = Math.hypot(lx - leftShoulderX, ly - chestY);
  const leftElbowX = leftShoulderX - 20 - (distL * 0.1); 
  const leftElbowY = Math.min(chestY + 120, ((chestY + ly) / 2) + 60);

  ctx.beginPath();
  ctx.moveTo(leftShoulderX, chestY);
  ctx.lineTo(leftElbowX, leftElbowY);
  ctx.lineTo(lx, ly);
  ctx.stroke();

  // Right Arm (Closer)
  ctx.globalAlpha = 1.0;
  
  const distR = Math.hypot(rx - rightShoulderX, ry - chestY);
  const rightElbowX = rightShoulderX + 20 + (distR * 0.1);
  const rightElbowY = Math.min(chestY + 120, ((chestY + ry) / 2) + 60);

  ctx.beginPath();
  ctx.moveTo(rightShoulderX, chestY);
  ctx.lineTo(rightElbowX, rightElbowY);
  ctx.lineTo(rx, ry);
  ctx.stroke();

  // Reset opacity
  ctx.globalAlpha = 1.0;
};
