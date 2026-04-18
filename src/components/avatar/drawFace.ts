export type FaceState = {
  eyebrows: "neutral" | "raised" | "frown";
  mouth: "neutral" | "smile" | "open" | "round";
};

export const drawFace = (ctx: CanvasRenderingContext2D, face: FaceState) => {
  const midX = 300;
  const faceY = 120; // center of face
  
  ctx.strokeStyle = "#8B0000"; // dark red
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;

  // Head Oval
  ctx.beginPath();
  ctx.ellipse(midX, faceY, 40, 55, 0, 0, 2 * Math.PI);
  ctx.stroke();

  // Eyes (Simple dots or wide)
  ctx.fillStyle = "#8B0000";
  ctx.beginPath();
  ctx.arc(midX - 15, faceY - 10, 3, 0, 2 * Math.PI); // L eye
  ctx.arc(midX + 15, faceY - 10, 3, 0, 2 * Math.PI); // R eye
  ctx.fill();

  // Eyebrows
  ctx.beginPath();
  if (face.eyebrows === "raised") {
    ctx.moveTo(midX - 25, faceY - 25); ctx.lineTo(midX - 5, faceY - 30);
    ctx.moveTo(midX + 25, faceY - 25); ctx.lineTo(midX + 5, faceY - 30);
  } else if (face.eyebrows === "frown") {
    ctx.moveTo(midX - 25, faceY - 30); ctx.lineTo(midX - 5, faceY - 22);
    ctx.moveTo(midX + 25, faceY - 30); ctx.lineTo(midX + 5, faceY - 22);
  } else {
    // Neutral
    ctx.moveTo(midX - 25, faceY - 25); ctx.lineTo(midX - 5, faceY - 25);
    ctx.moveTo(midX + 25, faceY - 25); ctx.lineTo(midX + 5, faceY - 25);
  }
  ctx.stroke();

  // Mouth
  ctx.beginPath();
  if (face.mouth === "smile") {
    ctx.arc(midX, faceY + 15, 12, 0, Math.PI, false);
    ctx.stroke();
  } else if (face.mouth === "open") {
    ctx.ellipse(midX, faceY + 20, 10, 15, 0, 0, 2 * Math.PI);
    ctx.stroke();
  } else if (face.mouth === "round") {
    ctx.arc(midX, faceY + 20, 8, 0, 2 * Math.PI);
    ctx.stroke();
  } else {
    // Neutral
    ctx.moveTo(midX - 15, faceY + 20);
    ctx.lineTo(midX + 15, faceY + 20);
    ctx.stroke();
  }
};
