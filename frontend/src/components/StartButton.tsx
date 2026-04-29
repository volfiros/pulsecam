import { motion } from "framer-motion";

interface StartButtonProps {
  onStart: () => void;
  onStop: () => void;
  isMeasuring: boolean;
}

export default function StartButton({ onStart, onStop, isMeasuring }: StartButtonProps) {
  if (isMeasuring) {
    return (
      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onStop}
        className="fixed top-6 right-6 text-white font-semibold text-sm cursor-pointer"
        style={{
          fontFamily: "var(--font-sans)",
          zIndex: 50,
          backgroundColor: "var(--color-danger)",
          borderRadius: "10px",
          padding: "12px 24px",
          border: "none",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)"
        }}
      >
        Stop
      </motion.button>
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
