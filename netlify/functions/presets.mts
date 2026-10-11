import type { Config } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { presets } from "../../db/schema.js";

const NUMERIC_KEYS = ["velocity", "turbulence", "gravity", "attraction", "size", "density"] as const;
const PALETTES = ["tokyo-night", "solar-flare", "mono-vapor", "acid-matrix"];

// Accept only known keys within sane bounds so stored presets always load cleanly.
function sanitizeSettings(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const out: Record<string, number | string> = {};
  for (const key of NUMERIC_KEYS) {
    const v = Number(raw[key]);
    const max = key === "density" ? 200 : 20;
    if (!Number.isFinite(v) || v < -20 || v > max) return null;
    out[key] = v;
  }
  if (typeof raw.palette !== "string" || !PALETTES.includes(raw.palette)) return null;
  out.palette = raw.palette;
  return out;
}

export default async (req: Request) => {
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = Number(url.pathname.split("/").pop());

  if (req.method === "GET") {
    const rows = await db
      .select({ id: presets.id, name: presets.name, settings: presets.settings, updatedAt: presets.updatedAt })
      .from(presets)
      .where(eq(presets.userId, user.id))
      .orderBy(desc(presets.updatedAt));
    return Response.json(rows);
  }

  if (req.method === "POST") {
    let body: { name?: unknown; settings?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
    const settings = sanitizeSettings(body.settings);
    if (!name) return Response.json({ error: "Name is required" }, { status: 422 });
    if (!settings) return Response.json({ error: "Invalid settings" }, { status: 422 });

    // Saving under an existing name overwrites that preset.
    const [row] = await db
      .insert(presets)
      .values({ userId: user.id, name, settings })
      .onConflictDoUpdate({
        target: [presets.userId, presets.name],
        set: { settings, updatedAt: sql`now()` },
      })
      .returning({ id: presets.id, name: presets.name, settings: presets.settings, updatedAt: presets.updatedAt });
    return Response.json(row, { status: 201 });
  }

  if (req.method === "DELETE") {
    if (!Number.isInteger(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
    await db.delete(presets).where(and(eq(presets.id, id), eq(presets.userId, user.id)));
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/presets", "/api/presets/:id"],
};
