import { motion } from "framer-motion";
import { type MeasurementStatus } from "../lib/constants";

interface StatusPillProps {
  status: MeasurementStatus;
}

const STATUS_CONFIG: Record<MeasurementStatus, { label: string; color: string; bg: string; border: string }> = {
  buffering: { label: "Buffering", color: "text-warning", bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.2)" },
  calibrating: { label: "Calibrating", color: "text-warning", bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.2)" },
  measuring: { label: "Measuring", color: "text-accent", bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.2)" },
  poor_signal: { label: "Stay still", color: "text-danger", bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.2)" },
  error: { label: "Error", color: "text-danger", bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.2)" },
};

export default function StatusPill({ status }: StatusPillProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.error;

  return (
    <motion.div
      layout
      className="inline-flex items-center rounded-md whitespace-nowrap"
      style={{ 
        background: config.bg, 
        border: `1px solid ${config.border}`,
        padding: "8px 16px" 
      }}
    >
      <span
        className="rounded-full flex-shrink-0"
        style={{
          width: "10px",
          height: "10px",
          marginRight: "10px",
          backgroundColor:
            status === "measuring"
              ? "var(--color-accent)"
              : status === "poor_signal" || status === "error"
                ? "var(--color-danger)"
                : "var(--color-warning)",
        }}
      />
      <span
        className={`font-medium ${config.color} whitespace-nowrap`}
        style={{ fontFamily: "var(--font-mono)", fontSize: "14px" }}
      >
        {config.label}
      </span>
    </motion.div>
  );
}
