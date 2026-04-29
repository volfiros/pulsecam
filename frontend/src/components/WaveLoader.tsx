export default function WaveLoader() {
  return (
    <div className="flex items-center justify-center gap-1" style={{ height: 64 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="w-1 rounded-full"
          style={{
            backgroundColor: "var(--color-accent)",
            height: 20,
            animation: `wave-bar 1.2s ease-in-out ${i * 0.08}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes wave-bar {
          0%, 100% { height: 8px; opacity: 0.3; }
          50% { height: 48px; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
