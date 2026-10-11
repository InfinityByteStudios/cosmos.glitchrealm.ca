import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import AccountBar from "./components/AccountBar";
import ControlPanel from "./components/ControlPanel";
import type { Telemetry } from "./components/Cosmos";
import { DEFAULT_SETTINGS, normalizeSettings, paletteById, type Settings } from "./lib/settings";
import { useAuth } from "./lib/useAuth";

const Cosmos = lazy(() => import("./components/Cosmos"));

const LOCAL_KEY = "particle-cosmos:settings";

function loadLocal(): Settings {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "null") ?? undefined);
  } catch {
    return normalizeSettings(undefined);
  }
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadLocal);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [telemetry, setTelemetry] = useState<Telemetry>({ fps: 0, count: 0, cursor: [0, 0, 0], waves: 0 });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, ready, notice, setNotice } = useAuth();
  const palette = paletteById(settings.palette);

  // Last-used configuration survives reloads for guests and members alike.
  useEffect(() => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--accent", palette.accent);
    root.setProperty("--accent-2", palette.colors[1]);
    root.setProperty("--accent-3", palette.colors[2]);
  }, [palette]);

  const onTelemetry = useCallback((t: Telemetry) => setTelemetry(t), []);
  const clearNotice = useCallback(() => setNotice(null), [setNotice]);
  const onLoadPreset = useCallback(
    (s: Settings) => {
      setSettings(s);
      setNotice({ tone: "ok", text: "Preset loaded — the field is settling." });
    },
    [setNotice],
  );

  const onReset = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
    setNotice({ tone: "ok", text: "Reset to defaults — the field is settling." });
  }, [setNotice]);

  const [cx, cy, cz] = telemetry.cursor;

  return (
    <main className="relative h-full w-full select-none overflow-hidden bg-void">
      {/* nebula wash tinted by the active palette */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute left-1/2 top-1/2 h-[90vmax] w-[90vmax] -translate-x-1/2 -translate-y-1/2 opacity-[0.13] blur-3xl transition-[background] duration-[2000ms]"
          style={{ background: `radial-gradient(circle, ${palette.colors[1]} 0%, transparent 55%)` }}
        />
        <div
          className="absolute -left-[20vmax] -top-[25vmax] h-[60vmax] w-[60vmax] opacity-[0.07] blur-3xl transition-[background] duration-[2000ms]"
          style={{ background: `radial-gradient(circle, ${palette.colors[0]} 0%, transparent 60%)` }}
        />
      </div>

      <Suspense fallback={<BootScreen />}>
        <Cosmos settingsRef={settingsRef} onTelemetry={onTelemetry} />
      </Suspense>

      <div className="vignette" />
      <div className="grain" />

      {/* editorial frame + grid hairlines */}
      <div aria-hidden className="pointer-events-none fixed inset-3 z-10 border border-white/[0.05] md:inset-5" />
      <div aria-hidden className="pointer-events-none fixed inset-y-0 left-1/3 z-10 hidden w-px bg-gradient-to-b from-transparent via-white/[0.035] to-transparent lg:block" />
      <div aria-hidden className="pointer-events-none fixed inset-y-0 left-2/3 z-10 hidden w-px bg-gradient-to-b from-transparent via-white/[0.035] to-transparent lg:block" />

      {/* masthead */}
      <header className="reveal pointer-events-none fixed left-6 top-6 z-20 md:left-10 md:top-9">
        <p className="mb-3 flex items-center gap-3 text-[9px] uppercase tracking-[0.35em] text-white/35">
          <span className="text-[var(--accent)] transition-colors duration-1000">№ 001</span>
          <span className="h-px w-8 bg-white/20" />
          Interactive field study
        </p>
        <h1 className="leading-[0.82]">
          <span className="block font-display text-[3.4rem] italic text-white/95 md:text-[5.5rem]">Particle</span>
          <span className="block pl-1 text-[1.35rem] font-bold uppercase tracking-[0.62em] text-white md:text-[2.1rem]">
            Cosmos
          </span>
        </h1>
        <dl className="mt-6 hidden grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[9.5px] uppercase tracking-[0.22em] text-white/35 md:grid">
          <dt className="text-white/60">Move</dt>
          <dd>Attract / repel</dd>
          <dt className="text-white/60">Click</dt>
          <dd>Radial shockwave</dd>
          <dt className="text-white/60">Drag</dt>
          <dd>Orbit camera</dd>
          <dt className="text-white/60">Scroll</dt>
          <dd>Depth</dd>
        </dl>
        <p className="mt-4 text-[9px] uppercase tracking-[0.22em] text-white/35 md:hidden">Touch · tap · drag · pinch</p>
      </header>

      {/* live telemetry */}
      <section
        aria-label="Telemetry"
        className="reveal pointer-events-none fixed right-6 top-6 z-20 text-right text-[9.5px] uppercase tracking-[0.2em] text-white/35 md:hidden lg:block lg:right-[22rem] lg:top-9"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="flex items-baseline justify-end gap-2">
          <span className="text-[22px] font-light tabular-nums tracking-normal text-white/90">{telemetry.fps || "--"}</span>
          <span>fps</span>
        </div>
        <div className="mt-1 tabular-nums">
          <span className="text-white/70">{telemetry.count.toLocaleString("en-US")}</span> bodies
        </div>
        <div className="mt-3 hidden space-y-0.5 tabular-nums md:block">
          <div>x {fmt(cx)}</div>
          <div>y {fmt(cy)}</div>
          <div>z {fmt(cz)}</div>
        </div>
        <div className="mt-3 hidden items-center justify-end gap-2 md:flex">
          <span className={telemetry.waves ? "text-[var(--accent)]" : ""}>wave {String(telemetry.waves).padStart(2, "0")}</span>
          <span className="h-px w-4 bg-white/20" />
          <span className="text-[var(--accent)] transition-colors duration-1000">{palette.code}</span>
        </div>
      </section>

      {/* bottom-left colophon */}
      <footer className="pointer-events-none fixed bottom-6 left-10 z-20 hidden text-[9px] uppercase tracking-[0.3em] text-white/25 md:block">
        <span className="text-white/45">{palette.name}</span> · {settings.attraction >= 0 ? "attractor" : "repulsor"} field ·{" "}
        {user ? "synced" : "guest session"}
      </footer>

      <ControlPanel
        settings={settings}
        onChange={setSettings}
        onReset={onReset}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* mobile controls trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        aria-expanded={mobileOpen}
        className="glass fixed bottom-3 left-3 z-40 flex h-8 items-center gap-2 px-3 text-[9.5px] uppercase tracking-[0.25em] text-white/70 md:hidden"
      >
        <span className={`h-1.5 w-1.5 rotate-45 border border-[var(--accent)] ${mobileOpen ? "bg-[var(--accent)]" : ""}`} />
        Controls
      </button>

      <AccountBar
        user={user}
        ready={ready}
        notice={notice}
        clearNotice={clearNotice}
        settings={settings}
        onLoad={onLoadPreset}
      />
    </main>
  );
}

function fmt(n: number) {
  return (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(2).padStart(5, "0");
}

function BootScreen() {
  return (
    <div className="fixed inset-0 z-0 flex items-center justify-center">
      <span className="blink text-[9px] uppercase tracking-[0.5em] text-white/40">Initializing field</span>
    </div>
  );
}
