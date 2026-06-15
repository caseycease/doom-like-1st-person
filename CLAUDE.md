# CLAUDE.md

Guidance for future sessions working in this repo. Keep it current.

## What this is

**Carnival of Fear** — a mobile-first, Doom-style first-person shooter using a
2.5D raycasting renderer (not real 3D). Theme: abandoned amusement park overrun
by clowns. Full design lives in [`docs/SPEC.md`](docs/SPEC.md). Build order is
enforced: **spec → vertical slice → expansion.** We are currently at the end of
**Phase 1 (vertical slice)**.

## Stack (and why)

- **TypeScript** (strict) — type safety for math-heavy engine code.
- **Vite** — dev server + bundler.
- **HTML5 Canvas 2D** — raycaster writes a packed `Uint32Array` pixel buffer,
  blitted via `putImageData` then upscaled. Kept DOM-free so it is unit-testable.
  Deliberately **not** WebGL (no required gain at this scope).
- **Vitest** — headless engine tests in Node.
- **vite-plugin-pwa** — generates manifest + service worker (installable, offline).

**Runtime dependencies: zero.** Every dev dependency is justified in the SPEC.
Do not add dependencies without updating the SPEC's dependency-policy section.

## Architecture — the one rule

**Engine logic (`src/engine/**`) never imports the DOM, Canvas, or `window`.**
Platform code lives at the edges and talks to pure logic through plain data
(`InputState` in, `World` mutated, `GameEvent[]` out). This split is what makes
the engine unit-testable and the sim deterministic.

```
src/engine/   PURE, Node-testable: math, rng, map, raycast, collision, combat,
              entities, ai, projection, input, world (createWorld + step)
src/render/   Canvas raycasting renderer, sprite billboards, HUD
src/assets/   SpriteProvider / TextureProvider contracts + ProceduralAssets
src/platform/ touch, keyboard (dev), audio, fixed-timestep loop
src/levels/   hand-authored map data
src/main.ts   composition root (the only file that wires everything)
test/         Vitest specs mirroring src/engine/**
```

- **Determinism:** the sim uses a seeded PRNG (`engine/rng.ts`). Never use
  `Math.random` in `src/engine/**`. `world.step(dt, input)` must stay a pure
  function of its inputs (the determinism test enforces this).
- **Fixed timestep:** sim runs at `DT = 1/60`; rendering is decoupled (RAF).
- **Art-swap contract:** entities carry a `spriteId` **string**, never a file
  path. Real art drops in by swapping the `SpriteProvider` impl behind
  `src/assets/manifest.ts` — no entity/AI/combat changes.

## Commands

```bash
npm install        # once
npm run dev        # dev server (http://localhost:5173) — open on phone via LAN/tunnel
npm test           # run all Vitest suites (headless)
npm run test:watch # watch mode
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build (dist/) incl. PWA service worker
npm run preview    # serve the production build (use --host for phone testing)
```

## Conventions

- Write tests alongside engine systems; keep `src/engine/**` near-100% covered.
- Keep the renderer free of game-state mutation — it only reads `World`.
- Tune-able constants live near their system (e.g. AI ranges in `engine/ai.ts`,
  player speed in `engine/world.ts`, control sensitivity in `platform/touch.ts`).
- Mobile/touch is the primary target; keyboard/mouse is a dev fallback only.

## Status / next

- **Done (Phase 1):** raycasting render + adaptive resolution, touch controls,
  basic clown, pistol hitscan, HUD.
- **Done (Phase 2):** clown variants (jester/brute/acrobat/bomber, the last
  ranged via projectiles), weapon progression (pistol → shotgun → nailgun →
  rocket) with ammo pools and weapon pickups, 3-level campaign with carry-over +
  difficulty curve, projectile system with rocket splash, pause, and
  save/checkpoint to `localStorage`. **59 passing tests** including a campaign
  validator (no entity/player spawned inside a wall).
- **Key systems & where they live:**
  - Weapons/ammo/enemy stats are data tables in `engine/entities.ts`
    (`WEAPONS`, `ENEMIES`, `AMMO_MAX`). Tune balance there.
  - Firing, hitscan spread, projectiles + splash: `engine/combat.ts`.
  - Per-archetype AI (melee/ranged/strafe): `engine/ai.ts`.
  - Campaign order: `levels/index.ts`. Levels validate via `test/levels.test.ts`.
  - Save format: `engine/save.ts` (pure); platform glue in `main.ts`.
- **Art-upgrade path (planned):** all visuals are procedural placeholders behind
  `SpriteProvider`/`TextureProvider` (`assets/spriteProvider.ts`). To drop in real
  art, add an `AtlasSpriteProvider` (load a texture atlas + JSON frame map) and
  swap it in at the composition root — no engine/AI/combat/level changes. Sprite
  ids (`clown.brute`, `projectile.rocket`, …) are the stable contract; the 8-way
  `facing` + `state` params already exist in `SpriteSet.frame()`.
- **Next (Phase 3 ideas):** real art via atlas provider, audio samples, locked
  doors/keys, more maps, boss clown, settings menu (sensitivity/resolution).
