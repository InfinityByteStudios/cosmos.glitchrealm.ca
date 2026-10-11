import { useEffect, useRef, useState } from "react";

/** Eases a displayed number toward its target with exponential decay, so readouts glide rather than snap. */
export function useEased(target: number, rate = 9) {
  const [value, setValue] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      cur.current += (target - cur.current) * (1 - Math.exp(-dt * rate));
      if (Math.abs(target - cur.current) < 1e-3) cur.current = target;
      setValue(cur.current);
      if (cur.current !== target) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, rate]);
  return value;
}
