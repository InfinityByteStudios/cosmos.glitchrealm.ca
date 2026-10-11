import { useCallback, useEffect, useRef, useState } from "react";
import {
  AuthError,
  MissingIdentityError,
  login,
  logout,
  requestPasswordRecovery,
  signup,
  type User,
} from "@netlify/identity";
import { deletePreset, listPresets, savePreset, type Preset } from "../lib/presets";
import { normalizeSettings, paletteById, type Settings } from "../lib/settings";
import type { AuthNotice } from "../lib/useAuth";

interface AccountBarProps {
  user: User | null;
  ready: boolean;
  notice: AuthNotice;
  clearNotice: () => void;
  settings: Settings;
  onLoad: (s: Settings) => void;
}

type Panel = null | "auth" | "presets";

export default function AccountBar({ user, ready, notice, clearNotice, settings, onLoad }: AccountBarProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the popover on outside click / Escape
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPanel(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  // After sign-in, move from auth form to presets
  useEffect(() => {
    if (user && panel === "auth") setPanel("presets");
    if (!user && panel === "presets") setPanel(null);
  }, [user, panel]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearNotice, 6000);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  const toggle = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p));
  const label = user ? (user.name || user.email || "Signed in") : "Guest";

  return (
    <div ref={rootRef} className="fixed bottom-3 right-3 z-40 flex flex-col items-end gap-2 md:bottom-5 md:right-6">
      {notice && (
        <div
          role="status"
          className={`glass-solid pop max-w-[300px] px-3 py-2 text-[10px] tracking-wider ${notice.tone === "err" ? "text-[#ff7a8a]" : "text-white/80"}`}
        >
          {notice.text}
        </div>
      )}

      {panel === "auth" && !user && <AuthForm />}
      {panel === "presets" && user && <PresetsPanel settings={settings} onLoad={onLoad} />}

      <div className="glass-solid flex h-8 items-stretch text-[9.5px] uppercase tracking-[0.22em]">
        <span className="flex items-center gap-2 px-3 text-white/65">
          <span
            className={`h-1.5 w-1.5 rotate-45 ${user ? "bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" : "bg-white/30"} ${!ready ? "blink" : ""}`}
          />
          <span className="max-w-[110px] truncate normal-case tracking-[0.06em] sm:max-w-[160px]">
            {ready ? label : "…"}
          </span>
        </span>
        <span className="w-px bg-white/10" />
        <button
          type="button"
          onClick={() => toggle(user ? "presets" : "auth")}
          aria-expanded={panel === "presets"}
          className={`px-3 transition-colors duration-500 hover:text-[var(--accent)] ${panel === "presets" ? "text-[var(--accent)]" : "text-white/55"}`}
          title={user ? "Your saved presets" : "Sign in to save presets"}
        >
          Presets{!user && <span className="ml-1 text-white/25">⌁</span>}
        </button>
        <span className="w-px bg-white/10" />
        {user ? (
          <button
            type="button"
            onClick={() => logout().catch(() => undefined)}
            className="px-3 text-white/40 transition-colors duration-500 hover:text-white"
          >
            Sign out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => toggle("auth")}
            aria-expanded={panel === "auth"}
            className={`px-3 transition-colors duration-500 hover:text-[var(--accent)] ${panel === "auth" ? "text-[var(--accent)]" : "text-white/70"}`}
          >
            Sign in →
          </button>
        )}
      </div>
    </div>
  );
}

function describeError(err: unknown) {
  if (err instanceof MissingIdentityError) return "Accounts are unavailable right now.";
  if (err instanceof AuthError) {
    if (err.status === 401) return "Invalid email or password.";
    if (err.status === 403) return "Signups are currently closed.";
    if (err.status === 422) return "Check your email and use a password of 8+ characters.";
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

function AuthForm() {
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "in") {
        await login(email, password);
      } else if (mode === "up") {
        const u = await signup(email, password);
        if (!u.confirmedAt) setInfo("Check your inbox to confirm your account, then sign in.");
      } else {
        await requestPasswordRecovery(email);
        setInfo("If that address has an account, a reset link is on its way.");
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: typeof mode; label: string }[] = [
    { id: "in", label: "Sign in" },
    { id: "up", label: "Create" },
  ];

  return (
    <form onSubmit={submit} className="glass-solid glow-edge pop relative w-[min(300px,calc(100vw-1.5rem))]" noValidate>
      <div className="flex border-b border-white/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setMode(t.id);
              setError(null);
              setInfo(null);
            }}
            className={`flex-1 py-2.5 text-[9px] uppercase tracking-[0.3em] transition-colors duration-500 ${
              mode === t.id ? "bg-white/[0.03] text-[var(--accent)]" : "text-white/55 hover:text-white/85"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-2.5 p-4">
        <p className="font-display text-[17px] italic leading-snug text-white/85">
          {mode === "reset" ? "Recover access." : "Keep your universes."}
        </p>
        <p className="text-[10px] leading-relaxed text-white/60">
          {mode === "reset"
            ? "We'll email you a link to set a new password."
            : "Optional. Everything works as a guest — an account just syncs your presets across devices."}
        </p>
        <input
          className="field"
          type="email"
          autoComplete="email"
          placeholder="email@domain"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {mode !== "reset" && (
          <input
            className="field"
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        )}
        {error && <p className="text-[10px] text-[#ff7a8a]">✕ {error}</p>}
        {info && <p className="text-[10px] text-[var(--accent)]">✓ {info}</p>}
        <button type="submit" disabled={busy || !email || (mode !== "reset" && !password)} className="btn-line btn-solid w-full">
          {busy ? "Working…" : mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "reset" ? "in" : "reset")}
          className="w-full pt-1 text-center text-[9px] uppercase tracking-[0.25em] text-white/50 transition-colors hover:text-white/85"
        >
          {mode === "reset" ? "← Back to sign in" : "Forgot password"}
        </button>
      </div>
    </form>
  );
}

function PresetsPanel({ settings, onLoad }: { settings: Settings; onLoad: (s: Settings) => void }) {
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPresets(await listPresets());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load presets.");
      setPresets([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await savePreset(n, settings);
      setName("");
      setFlash(saved.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save preset.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setPresets((p) => p?.filter((x) => x.id !== id) ?? null);
    try {
      await deletePreset(id);
    } catch {
      refresh();
    }
  };

  return (
    <div className="glass-solid glow-edge pop relative w-[min(320px,calc(100vw-1.5rem))]">
      <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-3">
        <h2 className="font-display text-lg italic leading-none">Saved presets</h2>
        <span className="text-[9px] tracking-[0.25em] text-white/30">{presets ? String(presets.length).padStart(2, "0") : "--"}</span>
      </div>

      <form onSubmit={save} className="flex gap-px border-b border-white/10 p-3">
        <input
          className="field flex-1"
          placeholder="Name this configuration"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={busy || !name.trim()} className="btn-line btn-solid shrink-0">
          {busy ? "…" : "Save"}
        </button>
      </form>

      {error && <p className="px-4 pt-3 text-[10px] text-[#ff7a8a]">✕ {error}</p>}

      <ul className="scroll-thin max-h-[40vh] overflow-y-auto py-1">
        {presets === null &&
          [0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="h-5 w-1.5 animate-pulse bg-white/10" />
              <span className="h-2 flex-1 animate-pulse bg-white/[0.06]" style={{ maxWidth: `${70 - i * 15}%` }} />
            </li>
          ))}
        {presets?.length === 0 && (
          <li className="px-4 py-6 text-center">
            <p className="font-display text-base italic text-white/60">An empty archive.</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/50">Tune the field, name it above, and it follows you to every device.</p>
          </li>
        )}
        {presets?.map((p) => {
          const s = normalizeSettings(p.settings);
          const pal = paletteById(s.palette);
          return (
            <li
              key={p.id}
              className={`group flex items-stretch transition-colors duration-700 ${flash === p.id ? "bg-white/[0.05]" : ""}`}
            >
              <button
                type="button"
                onClick={() => onLoad(s)}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left transition-colors duration-500 hover:bg-white/[0.03]"
              >
                <span className="flex h-5 w-1.5 flex-col">
                  {pal.colors.map((c) => (
                    <span key={c} className="flex-1" style={{ background: c }} />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] text-white/85 group-hover:text-white">{p.name}</span>
                  <span className="block text-[8.5px] tracking-[0.18em] text-white/50">
                    {pal.code} · V{s.velocity.toFixed(1)} · G{s.gravity.toFixed(1)} · {Math.round(s.density)}K
                  </span>
                </span>
                <span className="text-[9px] uppercase tracking-[0.25em] text-white/0 transition-colors duration-500 group-hover:text-[var(--accent)]">
                  Load
                </span>
              </button>
              <button
                type="button"
                onClick={() => remove(p.id)}
                aria-label={`Delete ${p.name}`}
                className="px-3 text-[11px] text-white/20 transition-colors duration-500 hover:text-[#ff7a8a]"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
