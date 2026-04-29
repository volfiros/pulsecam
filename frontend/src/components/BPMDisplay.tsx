import { motion, AnimatePresence } from "framer-motion";
import { type MeasurementStatus } from "../lib/constants";
import { useState, useEffect, useRef } from "react";

interface BPMDisplayProps {
  bpm: number;
  status: MeasurementStatus;
}

function useStableBpm(bpm: number): number {
  const [stable, setStable] = useState(0);
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    const rounded = Math.round(bpm);
    if (rounded === stable) {
      pendingRef.current = null;
      return;
    }
    if (pendingRef.current === rounded) {
      setStable(rounded);
      pendingRef.current = null;
    } else {
      pendingRef.current = rounded;
    }
  }, [bpm, stable]);

  return stable;
}

export default function BPMDisplay({ bpm, status }: BPMDisplayProps) {
  const isActive = status === "measuring" || status === "calibrating";
  const displayedBpm = useStableBpm(bpm);

  return (
    <div className="flex flex-col items-center">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={displayedBpm}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -10 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="text-8xl md:text-9xl font-bold leading-none"
          style={{
            fontFamily: "var(--font-mono)",
            color: isActive ? "var(--color-accent)" : "rgba(255, 255, 255, 0.3)",
          }}
        >
          {displayedBpm > 0 ? displayedBpm : "—"}
        </motion.div>
      </AnimatePresence>
      <span
        className="mt-2 text-lg text-text-secondary uppercase tracking-widest"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        BPM
      </span>
    </div>
  );
}
