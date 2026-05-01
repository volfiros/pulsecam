import { useRef, useEffect } from "react";
import { useFaceDetection } from "../hooks/useFaceDetection";
import { extractMultiROI, computeROIBox } from "../lib/extractROI";
import { FPS } from "../lib/constants";

export interface FramePayload {
  rois: {
    forehead: { r: number; g: number; b: number };
    left_cheek: { r: number; g: number; b: number };
    right_cheek: { r: number; g: number; b: number };
  };
  motion: number;
  luminance: number;
}

interface WebcamFeedProps {
  onFrame: (payload: FramePayload) => void;
  onROIsDetected: (rois: { x: number; y: number; width: number; height: number }[] | null) => void;
  onCameraError: (error: string) => void;
  onVideoSize?: (width: number, height: number) => void;
}

async function lockCameraSettings(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  await new Promise((r) => setTimeout(r, 1500));
  const caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown> & {
    exposureMode?: string[];
    whiteBalanceMode?: string[];
    focusMode?: string[];
  };
  const advanced: MediaTrackConstraintSet[] = [];
  if (caps.exposureMode?.includes("manual")) {
    advanced.push({ exposureMode: "manual" } as MediaTrackConstraintSet);
  }
  if (caps.whiteBalanceMode?.includes("manual")) {
    advanced.push({ whiteBalanceMode: "manual" } as MediaTrackConstraintSet);
  }
  if (caps.focusMode?.includes("manual")) {
    advanced.push({ focusMode: "manual" } as MediaTrackConstraintSet);
  }
  if (import.meta.env.DEV) {
    console.log("[PulseCam] camera capabilities:", {
      exposureMode: caps.exposureMode,
      whiteBalanceMode: caps.whiteBalanceMode,
      focusMode: caps.focusMode,
    });
  }
  if (advanced.length === 0) {
    if (import.meta.env.DEV) console.warn("[PulseCam] camera does not support manual exposure/wb/focus — auto modes still active");
    return;
  }
  try {
    await track.applyConstraints({ advanced });
    if (import.meta.env.DEV) {
      const settings = track.getSettings() as Record<string, unknown>;
      console.log("[PulseCam] camera locked. Settings after:", {
        exposureMode: settings.exposureMode,
        whiteBalanceMode: settings.whiteBalanceMode,
        focusMode: settings.focusMode,
      });
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[PulseCam] applyConstraints rejected:", err);
  }
}

export default function WebcamFeed({ onFrame, onROIsDetected, onCameraError, onVideoSize }: WebcamFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { detectFace, loading: detectorLoading } = useFaceDetection();
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: { ideal: FPS } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        await lockCameraSettings(stream);
      } catch (err) {
        if (!cancelled) {
          onCameraError(err instanceof Error ? err.message : "Camera access denied");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [onCameraError]);

  useEffect(() => {
    if (detectorLoading) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let lastTimestamp = 0;

    function loop() {
      if (!video || !ctx || !canvas) return;

      if (
        video.readyState < video.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      if (canvas.width > 0 && canvas.height > 0) {
        onVideoSize?.(canvas.width, canvas.height);
      }
      ctx.drawImage(video, 0, 0);

      const now = performance.now();
      if (now - lastTimestamp >= 1000 / FPS) {
        lastTimestamp = now;
        const face = detectFace(video, now);

        if (face) {
          const { landmarks, motion } = face;
          const { rois, luminance } = extractMultiROI(ctx, landmarks, canvas.width, canvas.height);
          onFrame({ rois, motion, luminance });
          onROIsDetected(computeROIBox(landmarks, canvas.width, canvas.height));
        } else {
          onROIsDetected(null);
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    }

    loop();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [detectorLoading, detectFace, onFrame, onROIsDetected]);

  return (
    <>
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full object-cover" style={{ zIndex: 0 }} />
    </>
  );
}
