import { useState } from "react";
import { DEFAULT_SETTINGS, PALETTES, SLIDER_GROUPS, type Settings } from "../lib/settings";
import Slider from "./Slider";

interface ControlPanelProps {
  settings: Settings;
  onChange: (next: Settings) => void;
  onReset: () => void;
  open: boolean;
  onClose: () => void;
}

function shuffle(current: Settings): Settings {
  const rnd = (min: number, max: number) => Math.round((min + Math.random() * (max - min)) * 100) / 100;
  return {
    velocity: rnd(0.2, 2.6),
    turbulence: rnd(0.2, 2.8),
    gravity: rnd(0.3, 2.4),
    attraction: rnd(-2.5, 2.5),
    size: rnd(0.6, 2),
    density: current.density,
    palette: PALETTES[Math.floor(Math.random() * PALETTES.length)].id,
  };
}

export default function ControlPanel({ settings, onChange, onReset, open, onClose }: ControlPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isDefault = (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).every((k) => settings[k] === DEFAULT_SETTINGS[k]);
  const set = <K extends keyof Settings>(key: K, v: Settings[K]) => onChange({ ...settings, [key]: v });

  return (
    <aside
      aria-label="Particle controls"
      className={[
        "glass glow-edge ticks fixed z-30 flex flex-col",
        // mobile: bottom sheet
        "inset-x-3 bottom-14 max-h-[62vh] transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
        open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[110%] opacity-0",
        // desktop: floating rail
        "md:pointer-events-auto md:inset-x-auto md:right-6 md:top-24 md:bottom-auto md:w-[300px] md:max-h-[calc(100vh-11rem)] md:translate-y-0 md:opacity-100",
      ].join(" ")}
    >
      <span className="tick tl" />
      <span className="tick tr" />
      <span className="tick bl" />
      <span className="tick br" />

      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] tracking-[0.3em] text-white/30">CTRL</span>
          <h2 className="font-display text-lg italic leading-none text-white">Field parameters</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onReset}
            disabled={isDefault}
            title="Reset every parameter and the palette to defaults"
            className="flex h-6 items-center border border-white/10 px-2 text-[8.5px] uppercase tracking-[0.25em] text-white/60 transition-colors duration-500 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:border-white/5 disabled:text-white/20 disabled:hover:border-white/5 disabled:hover:text-white/20"
          >
            ↺ Defaults
          </button>
          <button
            type="button"
            onClick={() => (window.matchMedia("(min-width: 768px)").matches ? setCollapsed((c) => !c) : onClose())}
            className="flex h-6 w-6 items-center justify-center border border-white/10 text-[11px] text-white/60 transition-colors duration-500 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            aria-label={collapsed ? "Expand controls" : "Collapse controls"}
          >
            <span className="hidden md:inline">{collapsed ? "+" : "−"}</span>
            <span className="md:hidden">×</span>
          </button>
        </div>
      </header>

      <div
        className={[
          "scroll-thin min-h-0 overflow-y-auto transition-[max-height,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
          collapsed ? "md:max-h-0 md:opacity-0" : "md:max-h-[80vh] md:opacity-100",
        ].join(" ")}
      >
        {SLIDER_GROUPS.map((group) => (
          <section key={group.id} className="border-b border-white/[0.06] px-4 pb-2 pt-3">
            <h3 className="mb-1 flex items-center gap-2 text-[9px] uppercase tracking-[0.35em] text-white/35">
              <span className="text-[var(--accent)]">{group.id}</span>
              <span className="h-px flex-1 bg-white/[0.07]" />
              {group.title}
            </h3>
            {group.sliders.map((spec, i) => (
              <Slider
                key={spec.key}
                spec={spec}
                index={`${group.id}.${i + 1}`}
                value={settings[spec.key]}
                onChange={(v) => set(spec.key, v)}
              />
            ))}
          </section>
        ))}

        <section className="px-4 pb-3 pt-3">
          <h3 className="mb-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.35em] text-white/35">
            <span className="text-[var(--accent)]">04</span>
            <span className="h-px flex-1 bg-white/[0.07]" />
            Palette
          </h3>
          <div role="radiogroup" aria-label="Aesthetic palette" className="grid grid-cols-2 gap-px border border-white/10 bg-white/10">
            {PALETTES.map((p) => {
              const active = p.id === settings.palette;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set("palette", p.id)}
                  className={[
                    "group/p relative flex flex-col gap-2 bg-[#0b0b11] p-2.5 text-left transition-colors duration-500",
                    active ? "bg-[#12121a]" : "hover:bg-[#101017]",
                  ].join(" ")}
                >
                  <span className="flex h-1.5 w-full">
                    {p.colors.map((c) => (
                      <span
                        key={c}
                        className="flex-1 transition-[filter] duration-500"
                        style={{
                          background: c,
                          boxShadow: active ? `0 0 10px ${c}` : "none",
                        }}
                      />
                    ))}
                  </span>
                  <span className="flex items-baseline justify-between">
                    <span className={`text-[10px] leading-tight ${active ? "text-white" : "text-white/55 group-hover/p:text-white/80"}`}>
                      {p.name}
                    </span>
                  </span>
                  <span className="text-[8px] tracking-[0.25em] text-white/25">{p.code}</span>
                  {active && (
                    <span
                      className="absolute right-2 top-[18px] h-1 w-1 rotate-45"
                      style={{
                        background: p.accent,
                        boxShadow: `0 0 8px ${p.accent}`,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <footer className="flex gap-px border-t border-white/10">
          <button
            type="button"
            onClick={onReset}
            disabled={isDefault}
            className="flex-1 py-2.5 text-[9px] uppercase tracking-[0.3em] text-white/45 transition-colors duration-500 hover:bg-white/[0.03] hover:text-white disabled:text-white/20 disabled:hover:bg-transparent"
          >
            ↺ Reset to defaults
          </button>
          <span className="w-px bg-white/10" />
          <button
            type="button"
            onClick={() => onChange(shuffle(settings))}
            className="flex-1 py-2.5 text-[9px] uppercase tracking-[0.3em] text-white/45 transition-colors duration-500 hover:bg-white/[0.03] hover:text-[var(--accent)]"
          >
            ⁂ Shuffle
          </button>
        </footer>
      </div>
    </aside>
  );
}
