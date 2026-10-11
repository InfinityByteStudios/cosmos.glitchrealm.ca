import type { SliderSpec } from "../lib/settings";
import { useEased } from "../lib/useEased";

interface SliderProps {
  spec: SliderSpec;
  value: number;
  index: string;
  onChange: (v: number) => void;
}

export default function Slider({ spec, value, index, onChange }: SliderProps) {
  const eased = useEased(value);
  const pct = ((value - spec.min) / (spec.max - spec.min)) * 100;
  const display = spec.format ? spec.format(eased) : eased.toFixed(2);
  const id = `s-${spec.key}`;

  return (
    <div className="group py-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="flex items-baseline gap-2 text-[10px] uppercase tracking-[0.2em] text-white/50 transition-colors duration-500 group-hover:text-white/80">
          <span className="text-white/25">{index}</span>
          {spec.label}
        </label>
        <output htmlFor={id} className="font-mono text-[12px] tabular-nums text-[var(--accent)] transition-colors duration-1000">
          {display}
          {spec.unit && <span className="ml-0.5 text-[9px] text-white/30">{spec.unit}</span>}
        </output>
      </div>
      <div className="relative mt-1">
        <input
          id={id}
          type="range"
          className="slider"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ "--fill": `${pct}%` } as React.CSSProperties}
        />
        {/* zero / midpoint tick for bipolar ranges */}
        {spec.min < 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-2 w-px -translate-y-1/2 bg-white/30"
            style={{ left: `${(-spec.min / (spec.max - spec.min)) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}
