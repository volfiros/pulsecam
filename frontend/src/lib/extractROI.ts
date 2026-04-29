interface Keypoint {
  x: number;
  y: number;
}

export function computeFaceROI(
  leftEye: Keypoint,
  rightEye: Keypoint,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; width: number; height: number } {
  const midX = (leftEye.x + rightEye.x) / 2;
  const midY = (leftEye.y + rightEye.y) / 2;
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const interEyeDist = Math.sqrt(dx * dx + dy * dy);

  const roiCenterX = midX * canvasWidth;
  const roiCenterY = (midY + interEyeDist * 0.55) * canvasHeight;

  const roiWidth = interEyeDist * 1.3 * canvasWidth;
  const roiHeight = interEyeDist * 0.7 * canvasHeight;

  const x = Math.max(0, roiCenterX - roiWidth / 2);
  const y = Math.max(0, roiCenterY - roiHeight / 2);

  return {
    x,
    y,
    width: Math.min(roiWidth, canvasWidth - x),
    height: Math.min(roiHeight, canvasHeight - y),
  };
}

export function extractRGBMeans(
  ctx: CanvasRenderingContext2D,
  roi: { x: number; y: number; width: number; height: number }
): { r: number; g: number; b: number } {
  const x = Math.floor(roi.x);
  const y = Math.floor(roi.y);
  const w = Math.floor(roi.width);
  const h = Math.floor(roi.height);

  if (w <= 0 || h <= 0) return { r: 0, g: 0, b: 0 };

  const imageData = ctx.getImageData(x, y, w, h);
  const data = imageData.data;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
  }

  return {
    r: totalR / pixelCount,
    g: totalG / pixelCount,
    b: totalB / pixelCount,
  };
}
