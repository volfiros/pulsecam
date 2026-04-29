import { useState, useEffect, useRef } from "react";

export function useStableBpm(bpm: number): number {
  const [stable, setStable] = useState(0);
  const prevBpmRef = useRef(0);

  useEffect(() => {
    const rounded = Math.round(bpm);
    if (rounded !== prevBpmRef.current) {
      prevBpmRef.current = rounded;
      setStable(rounded);
    }
  }, [bpm]);

  return stable;
}
