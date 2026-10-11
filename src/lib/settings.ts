export type PaletteId = "tokyo-night" | "solar-flare" | "mono-vapor" | "acid-matrix";

export interface Settings {
  velocity: number; // orbital drift speed
  turbulence: number; // turbulence wave speed
  gravity: number; // spring stiffness back to the field
  attraction: number; // cursor pull (negative repels)
  size: number; // particle size scale
  density: number; // particle count, in thousands
  palette: PaletteId;
}

export interface Palette {
  id: PaletteId;
  name: string;
  code: string;
  colors: [string, string, string];
  accent: string;
}

export const PALETTES: Palette[] = [
  { id: "tokyo-night", name: "Tokyo Night", code: "TN-01", colors: ["#7aa2f7", "#bb9af7", "#7dcfff"], accent: "#7aa2f7" },
  { id: "solar-flare", name: "Solar Flare", code: "SF-02", colors: ["#ff4d2e", "#ff9e3d", "#ffd66b"], accent: "#ff9e3d" },
  { id: "mono-vapor", name: "Monochromatic Vapor", code: "MV-03", colors: ["#6f7488", "#c9ccd8", "#ffffff"], accent: "#e6e8f0" },
  { id: "acid-matrix", name: "Acid Matrix", code: "AM-04", colors: ["#00ffa3", "#39ff14", "#d4ff00"], accent: "#39ff14" },
];

export const paletteById = (id: PaletteId) => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

export const MAX_PARTICLES = 120000;

export const DEFAULT_SETTINGS: Settings = {
  velocity: 1,
  turbulence: 1,
  gravity: 1,
  attraction: 1.2,
  size: 1,
  density: 40,
  palette: "tokyo-night",
};

export interface SliderSpec {
  key: keyof Omit<Settings, "palette">;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (v: number) => string;
}

export const SLIDER_GROUPS: { id: string; title: string; sliders: SliderSpec[] }[] = [
  {
    id: "01",
    title: "Motion",
    sliders: [
      { key: "velocity", label: "Velocity", min: 0, max: 3, step: 0.01, unit: "v" },
      { key: "turbulence", label: "Wave speed", min: 0, max: 3, step: 0.01, unit: "hz" },
    ],
  },
  {
    id: "02",
    title: "Forces",
    sliders: [
      { key: "gravity", label: "Field gravity", min: 0.05, max: 3, step: 0.01, unit: "g" },
      {
        key: "attraction",
        label: "Cursor pull",
        min: -3,
        max: 3,
        step: 0.01,
        format: (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2),
      },
    ],
  },
  {
    id: "03",
    title: "Matter",
    sliders: [
      { key: "size", label: "Size scale", min: 0.3, max: 3, step: 0.01, unit: "×" },
      {
        key: "density",
        label: "Density",
        min: 5,
        max: 120,
        step: 1,
        format: (v) => Math.round(v * 1000).toLocaleString("en-US"),
      },
    ],
  },
];

export function normalizeSettings(input: Partial<Settings> | undefined): Settings {
  const out = { ...DEFAULT_SETTINGS };
  if (!input) return out;
  for (const group of SLIDER_GROUPS) {
    for (const s of group.sliders) {
      const v = Number(input[s.key]);
      if (Number.isFinite(v)) out[s.key] = Math.min(s.max, Math.max(s.min, v));
    }
  }
  if (input.palette && PALETTES.some((p) => p.id === input.palette)) out.palette = input.palette;
  return out;
}
