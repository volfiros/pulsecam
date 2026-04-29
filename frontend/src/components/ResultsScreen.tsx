import { motion } from "framer-motion";

interface ResultsScreenProps {
  bpm: number;
  confidence: number;
  duration: number;
  onNewMeasurement: () => void;
  onBackToHome: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function ResultsScreen({
  bpm,
  confidence,
  duration,
  onNewMeasurement,
  onBackToHome,
}: ResultsScreenProps) {
  return (
    <motion.div
      key="results"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed inset-0 z-10 flex flex-col items-center justify-center px-6"
    >
      <div 
        className="w-full max-w-sm"
        style={{
          backgroundColor: "var(--color-bg-card)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "16px",
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
          <span className="label-secondary" style={{ marginBottom: "12px", fontSize: "14px" }}>Measurement complete</span>
          <div style={{ width: "40px", height: "1px", backgroundColor: "rgba(255, 255, 255, 0.1)" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "40px" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-accent)",
              fontSize: "80px",
              fontWeight: "bold",
              lineHeight: "1",
            }}
          >
            {bpm > 0 ? bpm : "—"}
          </span>
          <span
            style={{ 
              fontFamily: "var(--font-mono)",
              marginTop: "12px",
              fontSize: "16px",
              color: "var(--color-text-secondary)"
            }}
          >
            BPM
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "12px", marginBottom: "40px" }}>
          {confidence > 0 && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between", 
              width: "100%", 
              padding: "16px 20px", 
              borderRadius: "12px", 
              backgroundColor: "rgba(255, 255, 255, 0.02)", 
              border: "1px solid rgba(255, 255, 255, 0.06)" 
            }}>
              <span className="label-secondary" style={{ fontSize: "14px" }}>Confidence</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "15px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                {confidence}%
              </span>
            </div>
          )}
          {duration > 0 && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between", 
              width: "100%", 
              padding: "16px 20px", 
              borderRadius: "12px", 
              backgroundColor: "rgba(255, 255, 255, 0.02)", 
              border: "1px solid rgba(255, 255, 255, 0.06)" 
            }}>
              <span className="label-secondary" style={{ fontSize: "14px" }}>Duration</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "15px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                {formatDuration(duration)}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "16px" }}>
          <button
            onClick={onNewMeasurement}
            className="btn-cta w-full cursor-pointer"
            style={{ padding: "16px", fontSize: "16px", borderRadius: "10px" }}
          >
            New measurement
          </button>
          <button
            onClick={onBackToHome}
            className="btn-ghost w-full cursor-pointer"
            style={{ padding: "16px", fontSize: "16px", borderRadius: "10px" }}
          >
            Back to home
          </button>
        </div>
      </div>
    </motion.div>
  );
}
