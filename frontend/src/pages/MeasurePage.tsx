import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { usePulseCam } from "../hooks/usePulseCam";
import WebcamFeed from "../components/WebcamFeed";
import BPMDisplay from "../components/BPMDisplay";
import WaveformChart from "../components/WaveformChart";
import StatusPill from "../components/StatusPill";
import PulseRing from "../components/PulseRing";
import StartButton from "../components/StartButton";
import InfoDialog from "../components/InfoDialog";
import ROIOverlay from "../components/ROIOverlay";
import { useState, useCallback } from "react";

export default function MeasurePage() {
  const navigate = useNavigate();
  const { phase, bpm, confidence, waveform, status, sendFrame, start, stop } = usePulseCam();
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [roi, setRoi] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);

  const handleFrame = useCallback(
    (r: number, g: number, b: number) => {
      sendFrame(r, g, b);
    },
    [sendFrame]
  );

  const handleFaceDetected = useCallback(
    (newRoi: { x: number; y: number; width: number; height: number } | null) => {
      setRoi(newRoi);
    },
    []
  );

  const handleCameraError = useCallback((error: string) => {
    setCameraError(error);
  }, []);

  const handleVideoSize = useCallback((w: number, h: number) => {
    setVideoSize((prev) => (prev && prev.w === w && prev.h === h) ? prev : { w, h });
  }, []);

  const isMeasuring = phase === "measuring";

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg-primary">
      {isMeasuring && !cameraError && (
        <WebcamFeed
          onFrame={handleFrame}
          onFaceDetected={handleFaceDetected}
          onCameraError={handleCameraError}
          onVideoSize={handleVideoSize}
        />
      )}

      {isMeasuring && roi && videoSize && (
        <ROIOverlay roi={roi} videoWidth={videoSize.w} videoHeight={videoSize.h} />
      )}

      <AnimatePresence mode="wait">
        {phase === "idle" && !cameraError && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center justify-center h-full"
          >
            <StartButton onStart={start} onStop={stop} isMeasuring={false} />
          </motion.div>
        )}

        {phase === "checking" && (
          <motion.div
            key="checking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center justify-center h-full"
          >
            <PulseRing />
            <p className="mt-6 text-text-secondary" style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Checking server...
            </p>
          </motion.div>
        )}

        {phase === "connecting" && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center justify-center h-full"
          >
            <PulseRing />
            <p className="mt-6 text-text-secondary" style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Connecting...
            </p>
          </motion.div>
        )}

        {phase === "measuring" && !cameraError && (
          <motion.div
            key="measuring"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center justify-center h-full pointer-events-none"
          >
            <BPMDisplay bpm={bpm} status={status} />
            <div className="mt-4">
              <StatusPill status={status} />
            </div>
            {confidence > 0 && (
              <p
                className="mt-2"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.1em", color: "rgba(255, 255, 255, 0.4)" }}
              >
                Confidence: {Math.round(confidence * 100)}%
              </p>
            )}
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col items-center justify-center h-full"
          >
            <p className="text-danger text-lg font-medium" style={{ fontFamily: "var(--font-sans)" }}>
              Something went wrong
            </p>
            <p className="mt-2 text-text-secondary text-sm text-center max-w-sm px-4">
              The server could not be reached. Please try again.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 px-6 py-2 cursor-pointer"
              style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "9999px", color: "rgba(255, 255, 255, 0.7)", fontFamily: "var(--font-sans)", transition: "all 150ms ease" }}
            >
              Back to Home
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {isMeasuring && waveform.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 px-4 pb-4">
          <WaveformChart data={waveform} />
        </div>
      )}

      {isMeasuring && (
        <>
          <StartButton onStart={start} onStop={stop} isMeasuring={true} />
          <InfoDialog />
        </>
      )}

      <button
        onClick={() => navigate("/")}
        className="fixed top-6 left-6 text-sm font-semibold cursor-pointer z-10"
        style={{ fontFamily: "var(--font-sans)", color: "rgba(255, 255, 255, 0.5)", transition: "all 150ms ease" }}
      >
        PulseCam
      </button>

      {cameraError && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <p className="text-danger text-lg font-medium" style={{ fontFamily: "var(--font-sans)" }}>
            Camera access required
          </p>
          <p className="mt-2 text-text-secondary text-sm text-center max-w-sm px-4">
            {cameraError}. Please allow camera permission and try again.
          </p>
          <button
            onClick={() => { setCameraError(null); start(); }}
            className="mt-6 px-6 py-2 cursor-pointer"
            style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "9999px", color: "#10b981", fontFamily: "var(--font-sans)", transition: "all 150ms ease" }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
