# Particle Cosmos

An interactive deep-space particle field. Up to 120,000 glowing bodies orbit in a spiral galaxy, respond to your cursor with spring physics, and ripple outward when you click. A minimal HUD lets you tune velocity, turbulence, gravity, cursor pull, size, density and colour palette. Everything works as a guest; signing in (Netlify Identity) lets you name, save and reload presets across devices.

## Interactions

| Input | Effect |
| --- | --- |
| Move cursor | Attract (or repel, with negative pull) nearby particles |
| Click / tap | Radial shockwave from the point under the cursor |
| Drag | Orbit the camera with inertia |
| Scroll / pinch | Zoom |

## Tech

- **React 19 + Vite** single-page app
- **Three.js** via **@react-three/fiber** — custom GLSL point shader with additive glow, CPU spring-physics simulation
- **Tailwind CSS v4** with JetBrains Mono + Instrument Serif
- **Netlify Identity** (`@netlify/identity`) for optional accounts
- **Netlify Functions** (`/api/presets`) + **Netlify Database** (Postgres via Drizzle ORM) for saved presets

## Running locally

```bash
npm install
netlify dev --port 8889
```

`netlify dev` is needed so Identity, Functions and the Database are emulated. The canvas and controls also run under plain `npm run dev`, but presets and sign-in won't.

Database schema lives in `db/schema.ts`; after changing it, generate a migration with:

```bash
npx drizzle-kit generate --name <describe_change>
```

Migrations are applied automatically by Netlify on deploy.
