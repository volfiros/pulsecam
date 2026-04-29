import { motion } from "framer-motion";

interface StartButtonProps {
  onStart: () => void;
  onStop: () => void;
  isMeasuring: boolean;
}

export default function StartButton({ onStart, onStop, isMeasuring }: StartButtonProps) {
  if (isMeasuring) {
    return (
      <button
        onClick={onStop}
        className="fixed top-6 right-6 px-4 py-2 text-xs tracking-wide cursor-pointer"
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "9999px",
          color: "rgba(255, 255, 255, 0.5)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          zIndex: 10,
          transition: "all 150ms ease",
        }}
      >
        Stop
      </button>
    );
  }

  return (
    <motion.button
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onStart}
      className="px-10 py-4 bg-accent text-white font-semibold text-sm tracking-wide cursor-pointer"
      style={{ fontFamily: "var(--font-sans)", borderRadius: "9999px" }}
    >
      Start Measurement
    </motion.button>
  );
}
