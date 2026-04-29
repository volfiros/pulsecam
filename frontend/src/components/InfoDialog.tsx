import * as Dialog from "@radix-ui/react-dialog";
import { Info } from "lucide-react";

const TIPS = [
  "Stay still — motion artifacts are the #1 enemy",
  "Face the camera directly — consistent ROI = stable signal",
  "Avoid backlighting — don't sit with a bright window behind you",
  "Decent indoor lighting — not too dim, not flickering fluorescent",
  "Clean forehead — hair, glasses, or glare can distort the reading",
  "Wait for calibration — 10-15 seconds for accurate results",
];

export default function InfoDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          className="fixed bottom-6 right-6 p-2 rounded-full bg-bg-card/60 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          style={{ zIndex: 10 }}
          aria-label="Tips for accurate reading"
        >
          <Info size={20} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60" style={{ zIndex: 50 }} />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-[24px] p-6"
          style={{
            zIndex: 51,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
          }}
        >
          <Dialog.Title
            className="text-lg font-semibold text-text mb-4"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Tips for Accurate Reading
          </Dialog.Title>
          <ul className="space-y-3">
            {TIPS.map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm text-text-secondary">
                <span className="text-accent mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <Dialog.Close asChild>
            <button
              className="mt-6 w-full py-2 rounded-full text-sm cursor-pointer"
              style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", color: "rgba(255, 255, 255, 0.7)", fontFamily: "var(--font-sans)" }}
            >
              Got it
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
