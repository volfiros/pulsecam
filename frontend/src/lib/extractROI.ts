import { ROI_WIDTH_RATIO, ROI_HEIGHT_RATIO, ROI_OFFSET_UP_RATIO } from "./constants";

interface Keypoint {
  x: number;
  y: number;
}

export function computeForeheadROI(
  leftEye: Keypoint,
  rightEye: Keypoint,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; width: number; height: number } {
  const midX = (leftEye.x + rightEye.x) / 2;
  const midY = (leftEye.y + rightEye.y) / 2;
  const interEyeDist = Math.sqrt(
    (rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2
  );

  const width = interEyeDist * ROI_WIDTH_RATIO;
  const height = interEyeDist * ROI_HEIGHT_RATIO;
  const offsetX = midX * canvasWidth;
  const offsetY = midY * canvasHeight - interEyeDist * ROI_OFFSET_UP_RATIO * canvasHeight;

  const x = Math.max(0, offsetX - width * canvasWidth / 2);
  const y = Math.max(0, offsetY - height * canvasHeight);
  const w = width * canvasWidth;
  const h = height * canvasHeight;

  return {
    x,
    y,
    width: Math.min(w, canvasWidth - x),
    height: Math.min(h, canvasHeight - y),
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
