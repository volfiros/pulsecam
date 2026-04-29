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
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md"
          style={{
            zIndex: 51,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
            backgroundColor: "var(--color-bg-card)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "32px",
          }}
        >
          <Dialog.Title
            className="font-semibold text-text"
            style={{ fontFamily: "var(--font-sans)", fontSize: "20px", marginBottom: "24px" }}
          >
            Tips for Accurate Reading
          </Dialog.Title>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {TIPS.map((tip, i) => (
              <li key={i} style={{ display: "flex", gap: "16px", marginBottom: i === TIPS.length - 1 ? 0 : "16px", fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: "1.6" }}>
                <span className="text-accent font-bold" style={{ marginTop: "2px" }}>•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <Dialog.Close asChild>
              <button
                className="btn-ghost w-full text-sm cursor-pointer"
                style={{ padding: "12px" }}
              >
                Got it
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
