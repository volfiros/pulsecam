import { useRef, useEffect, useState, useCallback } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface MultiFaceResult {
  landmarks: LandmarkPoint[];
  motion: number;
}

export function useFaceDetection() {
  const detectorRef = useRef<FaceLandmarker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevLandmarksRef = useRef<LandmarkPoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        );
        if (cancelled) return;
        const detector = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
        if (cancelled) {
          detector.close();
          return;
        }
        detectorRef.current = detector;
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load face landmarker");
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
      detectorRef.current?.close();
    };
  }, []);

  const detectFace = useCallback(
    (video: HTMLVideoElement, timestampMs: number): MultiFaceResult | null => {
      if (!detectorRef.current) return null;
      const result = detectorRef.current.detectForVideo(video, timestampMs);
      if (!result.faceLandmarks || result.faceLandmarks.length === 0) return null;

      const landmarks = result.faceLandmarks[0].map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
      }));

      let motion = 0.0;
      if (prevLandmarksRef.current && prevLandmarksRef.current.length === landmarks.length) {
        let totalDist = 0.0;
        for (let i = 0; i < landmarks.length; i++) {
          const dx = landmarks[i].x - prevLandmarksRef.current[i].x;
          const dy = landmarks[i].y - prevLandmarksRef.current[i].y;
          totalDist += Math.sqrt(dx * dx + dy * dy);
        }
        const interEyeDist = Math.sqrt(
          Math.pow(landmarks[33].x - landmarks[263].x, 2) +
          Math.pow(landmarks[33].y - landmarks[263].y, 2)
        ) || 0.1;
        motion = (totalDist / landmarks.length) / interEyeDist;
      }
      prevLandmarksRef.current = landmarks;

      return { landmarks, motion };
    },
    []
  );

  return { detectFace, loading, error };
}
