import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { usePulseCam } from "../hooks/usePulseCam";
import WebcamFeed from "../components/WebcamFeed";
import type { FramePayload } from "../components/WebcamFeed";
import WaveformChart from "../components/WaveformChart";
import MeasureHeader from "../components/MeasureHeader";
import ResultsScreen from "../components/ResultsScreen";
import PulseRing from "../components/PulseRing";
import StartButton from "../components/StartButton";
import InfoDialog from "../components/InfoDialog";
import ROIOverlay from "../components/ROIOverlay";
import { useState, useCallback, useEffect } from "react";

export default function MeasurePage() {
  const navigate = useNavigate();
  const { phase, bpm, finalBpm, finalConfidence, confidence, waveform, status, duration, loadingElapsed, sendFrame, start, stop } = usePulseCam();
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [rois, setRois] = useState<{ x: number; y: number; width: number; height: number }[] | null>(null);
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);

  const handleFrame = useCallback(
    (payload: FramePayload) => {
      sendFrame(payload);
    },
    [sendFrame]
  );

  const handleROIsDetected = useCallback(
    (newRois: { x: number; y: number; width: number; height: number }[] | null) => {
      setRois(newRois);
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

  useEffect(() => {
    start();
  }, [start]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      {isMeasuring && !cameraError && (
        <WebcamFeed
          onFrame={handleFrame}
          onROIsDetected={handleROIsDetected}
          onCameraError={handleCameraError}
          onVideoSize={handleVideoSize}
        />
      )}

      {isMeasuring && rois && videoSize && (
        <ROIOverlay rois={rois} videoWidth={videoSize.w} videoHeight={videoSize.h} />
      )}

      <AnimatePresence mode="wait">
        {(phase === "checking" || phase === "connecting") && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6"
          >
            <PulseRing />
            <p
              className="text-text-secondary text-sm sm:text-base text-center"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {phase === "checking" ? "Waking up the server…" : "Connecting…"}
              {loadingElapsed >= 10 && (
                <span
                  className="ml-2 text-text-muted text-xs"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {loadingElapsed}s
                </span>
              )}
            </p>
          </motion.div>
        )}

        {phase === "results" && (
          <ResultsScreen
            key="results"
            bpm={finalBpm}
            confidence={finalConfidence}
            duration={duration}
            onNewMeasurement={start}
            onBackToHome={() => navigate("/")}
          />
        )}

        {phase === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-10 flex flex-col items-center justify-center"
          >
            <p className="text-danger text-lg font-medium" style={{ fontFamily: "var(--font-sans)" }}>
              Something went wrong
            </p>
            <p className="mt-2 text-text-secondary text-sm text-center max-w-sm px-4">
              The server could not be reached. Please try again.
            </p>
            <button
              onClick={() => navigate("/")}
              className="btn-ghost mt-6 cursor-pointer"
            >
              Back to Home
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "measuring" && !cameraError && (
        <MeasureHeader bpm={bpm} status={status} confidence={confidence} />
      )}

      {isMeasuring && waveform.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 px-6 pb-6">
          <WaveformChart data={waveform} />
        </div>
      )}

      {isMeasuring && !cameraError && (
        <>
          <StartButton onStart={start} onStop={stop} isMeasuring={true} />
          <InfoDialog />
        </>
      )}

      {cameraError && (
        <div className="fixed inset-0 z-10 flex flex-col items-center justify-center">
          <p className="text-danger text-lg font-medium" style={{ fontFamily: "var(--font-sans)" }}>
            Camera access required
          </p>
          <p className="mt-2 text-text-secondary text-sm text-center max-w-sm px-4">
            {cameraError}. Please allow camera permission and try again.
          </p>
            <button
              onClick={() => { setCameraError(null); start(); }}
              className="btn-accent mt-10 cursor-pointer"
            >
              Retry
            </button>
        </div>
      )}
    </div>
  );
}
