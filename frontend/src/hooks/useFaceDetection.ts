import { useRef, useEffect, useState, useCallback } from "react";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

export interface DetectedFace {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  boundingBox: { x: number; y: number; width: number; height: number };
}

export function useFaceDetection() {
  const detectorRef = useRef<FaceDetector | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        );
        if (cancelled) return;
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
        });
        if (cancelled) {
          detector.close();
          return;
        }
        detectorRef.current = detector;
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load face detector");
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
    (video: HTMLVideoElement, timestampMs: number): DetectedFace | null => {
      if (!detectorRef.current) return null;
      const result = detectorRef.current.detectForVideo(video, timestampMs);
      if (!result.detections || result.detections.length === 0) return null;

      const detection = result.detections[0];
      const keypoints = detection.keypoints;
      if (!keypoints || keypoints.length < 2) return null;

      const bb = detection.boundingBox;
      if (!bb) return null;

      const leftEye = keypoints[0];
      const rightEye = keypoints[1];

      return {
        leftEye: { x: leftEye.x, y: leftEye.y },
        rightEye: { x: rightEye.x, y: rightEye.y },
        boundingBox: { x: bb.originX, y: bb.originY, width: bb.width, height: bb.height },
      };
    },
    []
  );

  return { detectFace, loading, error };
}
