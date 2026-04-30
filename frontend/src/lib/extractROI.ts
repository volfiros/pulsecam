import type { LandmarkPoint } from "../hooks/useFaceDetection";

interface RGBMeans {
  r: number;
  g: number;
  b: number;
}

export interface MultiROIResult {
  rois: {
    forehead: RGBMeans;
    left_cheek: RGBMeans;
    right_cheek: RGBMeans;
  };
  luminance: number;
}

function patchRGB(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  patchSize: number,
  canvasWidth: number,
  canvasHeight: number
): RGBMeans {
  const x = Math.max(0, Math.floor(centerX - patchSize / 2));
  const y = Math.max(0, Math.floor(centerY - patchSize / 2));
  const w = Math.max(0, Math.min(Math.floor(patchSize), Math.floor(canvasWidth - x)));
  const h = Math.max(0, Math.min(Math.floor(patchSize), Math.floor(canvasHeight - y)));

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

export function extractMultiROI(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  canvasWidth: number,
  canvasHeight: number
): MultiROIResult {
  const foreheadLM = landmarks[10];
  const leftCheekLM = landmarks[234];
  const rightCheekLM = landmarks[454];
  const noseLM = landmarks[1];

  const interEyeDist = Math.sqrt(
    Math.pow((landmarks[33].x - landmarks[263].x) * canvasWidth, 2) +
    Math.pow((landmarks[33].y - landmarks[263].y) * canvasHeight, 2)
  );
  const patchSize = Math.max(10, interEyeDist * 0.3);

  const forehead = patchRGB(
    ctx,
    ((foreheadLM.x + noseLM.x) / 2) * canvasWidth,
    (foreheadLM.y - interEyeDist * 0.1 / canvasHeight) * canvasHeight,
    patchSize,
    canvasWidth,
    canvasHeight
  );
  const left_cheek = patchRGB(
    ctx,
    leftCheekLM.x * canvasWidth,
    leftCheekLM.y * canvasHeight,
    patchSize,
    canvasWidth,
    canvasHeight
  );
  const right_cheek = patchRGB(
    ctx,
    rightCheekLM.x * canvasWidth,
    rightCheekLM.y * canvasHeight,
    patchSize,
    canvasWidth,
    canvasHeight
  );

  const luminance = (forehead.r + forehead.g + forehead.b + left_cheek.r + left_cheek.g + left_cheek.b + right_cheek.r + right_cheek.g + right_cheek.b) / 9.0;

  return { rois: { forehead, left_cheek, right_cheek }, luminance };
}

export function computeROIBox(
  landmarks: LandmarkPoint[],
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; width: number; height: number }[] {
  const foreheadLM = landmarks[10];
  const leftCheekLM = landmarks[234];
  const rightCheekLM = landmarks[454];
  const noseLM = landmarks[1];

  const interEyeDist = Math.sqrt(
    Math.pow((landmarks[33].x - landmarks[263].x) * canvasWidth, 2) +
    Math.pow((landmarks[33].y - landmarks[263].y) * canvasHeight, 2)
  );
  const patchSize = Math.max(10, interEyeDist * 0.3);

  const rois = [
    { cx: ((foreheadLM.x + noseLM.x) / 2) * canvasWidth, cy: (foreheadLM.y - interEyeDist * 0.1 / canvasHeight) * canvasHeight },
    { cx: leftCheekLM.x * canvasWidth, cy: leftCheekLM.y * canvasHeight },
    { cx: rightCheekLM.x * canvasWidth, cy: rightCheekLM.y * canvasHeight },
  ];

  return rois.map(({ cx, cy }) => ({
    x: Math.max(0, cx - patchSize / 2),
    y: Math.max(0, cy - patchSize / 2),
    width: patchSize,
    height: patchSize,
  }));
}
