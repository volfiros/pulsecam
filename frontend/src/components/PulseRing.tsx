import { motion } from "framer-motion";

export default function PulseRing() {
  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.2, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-full h-full rounded-full border-2 border-accent"
      />
      <motion.div
        animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0.1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        className="absolute w-full h-full rounded-full border border-accent-glow"
      />
      <div className="w-4 h-4 rounded-full bg-accent" />
    </div>
  );
}
