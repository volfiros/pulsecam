import type { LandmarkPoint } from "../hooks/useFaceDetection";

export interface RGBMeans {
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
  background: RGBMeans;
}

interface PatchCenter {
  cx: number;
  cy: number;
}

function trimmedMean(values: number[], trimRatio = 0.1): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const trimCount = Math.floor(values.length * trimRatio);
  const start = Math.min(trimCount, values.length - 1);
  const end = Math.max(start + 1, values.length - trimCount);
  let total = 0;
  for (let i = start; i < end; i++) {
    total += values[i];
  }
  return total / (end - start);
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
  const rValues: number[] = [];
  const gValues: number[] = [];
  const bValues: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    rValues.push(data[i]);
    gValues.push(data[i + 1]);
    bValues.push(data[i + 2]);
  }

  return {
    r: trimmedMean(rValues),
    g: trimmedMean(gValues),
    b: trimmedMean(bValues),
  };
}

function getPatchGeometry(
  landmarks: LandmarkPoint[],
  canvasWidth: number,
  canvasHeight: number
): { patchSize: number; skinCenters: PatchCenter[]; backgroundCenter: PatchCenter } {
  const foreheadLM = landmarks[10];
  const leftCheekLM = landmarks[234];
  const rightCheekLM = landmarks[454];
  const noseLM = landmarks[1];

  const interEyeDist = Math.sqrt(
    Math.pow((landmarks[33].x - landmarks[263].x) * canvasWidth, 2) +
    Math.pow((landmarks[33].y - landmarks[263].y) * canvasHeight, 2)
  );
  const patchSize = Math.max(10, interEyeDist * 0.3);
  const leftCheekCenter = {
    cx: (leftCheekLM.x * 0.65 + noseLM.x * 0.35) * canvasWidth,
    cy: (leftCheekLM.y * 0.72 + noseLM.y * 0.28) * canvasHeight,
  };
  const rightCheekCenter = {
    cx: (rightCheekLM.x * 0.65 + noseLM.x * 0.35) * canvasWidth,
    cy: (rightCheekLM.y * 0.72 + noseLM.y * 0.28) * canvasHeight,
  };
  const skinCenters = [
    {
      cx: ((foreheadLM.x + noseLM.x) / 2) * canvasWidth,
      cy: (foreheadLM.y - interEyeDist * 0.1 / canvasHeight) * canvasHeight,
    },
    leftCheekCenter,
    rightCheekCenter,
  ];

  const xs = landmarks.map((lm) => lm.x * canvasWidth);
  const ys = landmarks.map((lm) => lm.y * canvasHeight);
  const faceBounds = {
    left: Math.min(...xs) - patchSize,
    right: Math.max(...xs) + patchSize,
    top: Math.min(...ys) - patchSize,
    bottom: Math.max(...ys) + patchSize,
  };
  const candidates = [
    { cx: patchSize, cy: patchSize },
    { cx: canvasWidth - patchSize, cy: patchSize },
    { cx: patchSize, cy: canvasHeight - patchSize },
    { cx: canvasWidth - patchSize, cy: canvasHeight - patchSize },
  ];
  const nose = { cx: noseLM.x * canvasWidth, cy: noseLM.y * canvasHeight };
  const outsideFace = candidates.filter(
    ({ cx, cy }) =>
      cx < faceBounds.left ||
      cx > faceBounds.right ||
      cy < faceBounds.top ||
      cy > faceBounds.bottom
  );
  const backgroundCenter = (outsideFace.length > 0 ? outsideFace : candidates).sort((a, b) => {
    const distA = Math.hypot(a.cx - nose.cx, a.cy - nose.cy);
    const distB = Math.hypot(b.cx - nose.cx, b.cy - nose.cy);
    return distB - distA;
  })[0];

  return { patchSize, skinCenters, backgroundCenter };
}

export function extractMultiROI(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  canvasWidth: number,
  canvasHeight: number
): MultiROIResult {
  const { patchSize, skinCenters, backgroundCenter } = getPatchGeometry(landmarks, canvasWidth, canvasHeight);

  const forehead = patchRGB(
    ctx,
    skinCenters[0].cx,
    skinCenters[0].cy,
    patchSize,
    canvasWidth,
    canvasHeight
  );
  const left_cheek = patchRGB(
    ctx,
    skinCenters[1].cx,
    skinCenters[1].cy,
    patchSize,
    canvasWidth,
    canvasHeight
  );
  const right_cheek = patchRGB(
    ctx,
    skinCenters[2].cx,
    skinCenters[2].cy,
    patchSize,
    canvasWidth,
    canvasHeight
  );
  const background = patchRGB(
    ctx,
    backgroundCenter.cx,
    backgroundCenter.cy,
    patchSize,
    canvasWidth,
    canvasHeight
  );

  const luminance = (forehead.r + forehead.g + forehead.b + left_cheek.r + left_cheek.g + left_cheek.b + right_cheek.r + right_cheek.g + right_cheek.b) / 9.0;

  return { rois: { forehead, left_cheek, right_cheek }, luminance, background };
}

export function computeROIBox(
  landmarks: LandmarkPoint[],
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; width: number; height: number }[] {
  const { patchSize, skinCenters } = getPatchGeometry(landmarks, canvasWidth, canvasHeight);

  return skinCenters.map(({ cx, cy }) => ({
    x: Math.max(0, cx - patchSize / 2),
    y: Math.max(0, cy - patchSize / 2),
    width: patchSize,
    height: patchSize,
  }));
}
