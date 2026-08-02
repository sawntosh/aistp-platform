import { useEffect, useState } from "react";

// Animates a number from 0 up to `target` on mount/change -- purely cosmetic,
// used for dashboard stat tiles.
export function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const to = Number(target) || 0;
    const start = performance.now();
    let frame;

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(to * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
