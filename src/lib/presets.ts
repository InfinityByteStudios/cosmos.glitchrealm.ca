import type { Settings } from "./settings";

export interface Preset {
  id: number;
  name: string;
  settings: Settings;
  updatedAt: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* non-JSON error */
    }
    throw new Error(msg);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const listPresets = () => request<Preset[]>("/api/presets");

export const savePreset = (name: string, settings: Settings) =>
  request<Preset>("/api/presets", { method: "POST", body: JSON.stringify({ name, settings }) });

export const deletePreset = (id: number) => request<void>(`/api/presets/${id}`, { method: "DELETE" });
