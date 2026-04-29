import { useRef, useEffect } from "react";
import { useFaceDetection } from "../hooks/useFaceDetection";
import { computeFaceROI, extractRGBMeans } from "../lib/extractROI";
import { FPS } from "../lib/constants";

interface WebcamFeedProps {
  onFrame: (r: number, g: number, b: number) => void;
  onFaceDetected: (roi: { x: number; y: number; width: number; height: number } | null) => void;
  onCameraError: (error: string) => void;
  onVideoSize?: (width: number, height: number) => void;
}

export default function WebcamFeed({ onFrame, onFaceDetected, onCameraError, onVideoSize }: WebcamFeedProps) {
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
          const roi = computeFaceROI(
            face.leftEye,
            face.rightEye,
            canvas.width,
            canvas.height
          );
          onFaceDetected(roi);
          const rgb = extractRGBMeans(ctx, roi);
          onFrame(rgb.r, rgb.g, rgb.b);
        } else {
          onFaceDetected(null);
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    }

    loop();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [detectorLoading, detectFace, onFrame, onFaceDetected]);

  return (
    <>
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full object-cover" style={{ zIndex: 0 }} />
    </>
  );
}
