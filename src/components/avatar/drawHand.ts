export const drawHand = (
  ctx: CanvasRenderingContext2D,
  handPoints: number[][],
  canvasWidth: number,
  canvasHeight: number,
  isLeft: boolean
) => {
  if (!handPoints || handPoints.length === 0) return;

  const baseColor = isLeft ? "#00D1FF" : "#FFA500";
  
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;

  const fingerIndices = [
    { name: 'thumb', indices: [0, 1, 2, 3, 4], color: "#00FF00" },      // Green
    { name: 'index', indices: [0, 5, 6, 7, 8], color: "#0000FF" },      // Blue
    { name: 'middle', indices: [0, 9, 10, 11, 12], color: "#00FFFF" },  // Cyan
    { name: 'ring', indices: [0, 13, 14, 15, 16], color: "#ADD8E6" },   // Light Blue
    { name: 'pinky', indices: [0, 17, 18, 19, 20], color: "#FFA500" },  // Orange
  ];

  // Map to canvas coords
  const pts = handPoints.map(p => ({
    x: p[0] * canvasWidth,
    y: p[1] * canvasHeight
  }));

  // Draw base points connecting wrist to MCPs (knuckles) to form palm
  ctx.strokeStyle = baseColor;
  ctx.beginPath();
  [0, 5, 9, 13, 17, 0].forEach((idx, i) => {
    if (i === 0) ctx.moveTo(pts[idx].x, pts[idx].y);
    else ctx.lineTo(pts[idx].x, pts[idx].y);
  });
  ctx.stroke();

  // Draw explicitly articulated fingers
  fingerIndices.forEach(finger => {
    ctx.strokeStyle = finger.color;
    ctx.beginPath();
    ctx.moveTo(pts[finger.indices[0]].x, pts[finger.indices[0]].y);
    
    for (let i = 1; i < finger.indices.length; i++) {
      const idx = finger.indices[i];
      ctx.lineTo(pts[idx].x, pts[idx].y);
    }
    ctx.stroke();
  });
  
  // Optionally highlight fingertips
  fingerIndices.forEach(finger => {
    const tipIdx = finger.indices[4];
    ctx.fillStyle = finger.color;
    ctx.beginPath();
    ctx.arc(pts[tipIdx].x, pts[tipIdx].y, 3, 0, 2 * Math.PI);
    ctx.fill();
  });
};
