interface ROIOverlayProps {
  roi: { x: number; y: number; width: number; height: number } | null;
  videoWidth: number;
  videoHeight: number;
}

export default function ROIOverlay({ roi, videoWidth, videoHeight }: ROIOverlayProps) {
  if (!roi || videoWidth === 0 || videoHeight === 0) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const coverScale = Math.max(vw / videoWidth, vh / videoHeight);
  const offsetX = (vw - videoWidth * coverScale) / 2;
  const offsetY = (vh - videoHeight * coverScale) / 2;

  return (
    <div
      className="fixed border-2 rounded-md pointer-events-none"
      style={{
        left: roi.x * coverScale + offsetX,
        top: roi.y * coverScale + offsetY,
        width: roi.width * coverScale,
        height: roi.height * coverScale,
        borderColor: "rgba(16, 185, 129, 0.4)",
        backgroundColor: "rgba(16, 185, 129, 0.05)",
        zIndex: 1,
      }}
    />
  );
}
