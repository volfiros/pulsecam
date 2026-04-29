import { motion, AnimatePresence } from "framer-motion";
import { useStableBpm } from "../hooks/useStableBpm";
import { type MeasurementStatus } from "../lib/constants";
import StatusPill from "./StatusPill";

interface MeasureHeaderProps {
  bpm: number;
  status: MeasurementStatus;
  confidence: number;
}

export default function MeasureHeader({ bpm, status, confidence }: MeasureHeaderProps) {
  const displayedBpm = useStableBpm(bpm);
  const isActive = status === "measuring" || status === "calibrating";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-20 flex items-center justify-center pointer-events-none"
    >
      <div 
        className="surface flex items-center justify-between px-24 py-8 pointer-events-auto min-w-[440px]" 
        style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 0, marginTop: "-1px" }}
      >
        <div className="flex flex-col items-center justify-center flex-1" style={{ marginTop: "16px", marginBottom: "8px" }}>
          <AnimatePresence mode="popLayout">
            <motion.span
              key={displayedBpm}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-4xl font-bold leading-none mb-3"
              style={{
                fontFamily: "var(--font-mono)",
                color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                minWidth: "3ch",
                textAlign: "center",
              }}
            >
              {displayedBpm > 0 ? displayedBpm : "—"}
            </motion.span>
          </AnimatePresence>
          <span
            className="text-base text-text-secondary"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            BPM
          </span>
        </div>

        <div className="h-16 w-px bg-white/10 mx-10" style={{ marginTop: "16px", marginBottom: "8px" }} />

        <div className="flex flex-col items-center justify-center flex-1" style={{ marginTop: "16px", marginBottom: "8px" }}>
          <StatusPill status={status} />
          {confidence > 0 && (
            <span 
              className="text-xs font-medium"
              style={{
                marginTop: "12px",
                fontFamily: "var(--font-mono)",
                color: confidence >= 0.8 ? "var(--color-accent)" : confidence >= 0.5 ? "var(--color-warning)" : "var(--color-danger)"
              }}
            >
              Confidence: {Math.round(confidence * 100)}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
