import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import ShaderBackground from "../components/ShaderBackground";

const sectionReveal = {
  hidden: { opacity: 0, y: 60, filter: "blur(10px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.9,
      delay: i * 0.25,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      <ShaderBackground />

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 gap-4 md:gap-5 lg:gap-6">
        <motion.h1
          variants={sectionReveal}
          initial="hidden"
          animate="visible"
          custom={0}
          className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold text-text text-center leading-[1.05]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Your pulse,
          <br />
          <motion.span
            className="text-accent inline-block"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.6, ease: "easeOut" }}
          >
            from your camera.
          </motion.span>
        </motion.h1>

        <motion.p
          variants={sectionReveal}
          initial="hidden"
          animate="visible"
          custom={1}
          className="text-base sm:text-lg md:text-xl text-text-secondary text-center max-w-lg"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          No wearables. No apps to pair.
          <br className="hidden md:block" />
          Just your face and a webcam.
        </motion.p>

        <motion.button
          type="button"
          variants={sectionReveal}
          initial="hidden"
          animate="visible"
          custom={2}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate("/measure")}
          className="btn-cta"
        >
          Try it now
        </motion.button>
      </div>
    </div>
  );
}
