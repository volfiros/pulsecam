import { motion } from "framer-motion";
import { type MeasurementStatus } from "../lib/constants";

interface StatusPillProps {
  status: MeasurementStatus;
}

const STATUS_CONFIG: Record<MeasurementStatus, { label: string; color: string; bg: string; border: string }> = {
  buffering: { label: "Buffering...", color: "text-warning", bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.2)" },
  calibrating: { label: "Calibrating...", color: "text-warning", bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.2)" },
  measuring: { label: "Measuring", color: "text-accent", bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.2)" },
  poor_signal: { label: "Stay still", color: "text-danger", bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.2)" },
  error: { label: "Error", color: "text-danger", bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.2)" },
};

export default function StatusPill({ status }: StatusPillProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.error;

  return (
    <motion.div
      layout
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full`}
      style={{ background: config.bg, border: `1px solid ${config.border}` }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{
          backgroundColor:
            status === "measuring"
              ? "var(--color-accent)"
              : status === "poor_signal" || status === "error"
                ? "var(--color-danger)"
                : "var(--color-warning)",
          animation: status === "measuring" ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      />
      <span
        className={`text-sm font-medium ${config.color}`}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {config.label}
      </span>
    </motion.div>
  );
}
