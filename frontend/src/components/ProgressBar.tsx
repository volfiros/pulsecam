import { useEffect, useState } from "react";

interface ProgressBarProps {
  estimatedSeconds: number;
}

export default function ProgressBar({ estimatedSeconds }: ProgressBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 100 / (estimatedSeconds * 10);
      });
    }, 100);
    return () => clearInterval(interval);
  }, [estimatedSeconds]);

  return (
    <div className="w-64 h-1.5 rounded-full bg-bg-card overflow-hidden">
      <div
        className="h-full rounded-full bg-accent transition-all duration-100"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
}
