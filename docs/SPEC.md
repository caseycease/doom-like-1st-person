# SPEC — "Carnival of Fear" (working title)

A mobile-first, old-school Doom-style first-person shooter. 2.5D raycasting
renderer (not real 3D). Theme: an abandoned amusement park overrun by creepy
clowns. Multiple levels, escalating weapons.

This document is **Phase 0**: the technical spec. No code is written until it is
approved.

---

## 1. Goals & Non-Goals

**Goals**
- Runs in a mobile browser, installable as a PWA (add to home screen, offline-capable).
- Holds **30+ fps on mid-tier mobile** (think ~2020 mid-range Android, e.g. Snapdragon 6-series).
- Touch-first controls that feel good with thumbs, no peripherals required.
- Engine correctness is **provable headlessly** — raycasting math, collision, hit
  detection and enemy AI are unit-tested without a canvas.
- Art-agnostic: gameplay is fully playable with procedural placeholder sprites;
  real clown art drops in later with **zero gameplay code changes**.

**Non-Goals (for the engine, ever)**
- True 3D, room-over-room, sloped floors, or look-up/down geometry (we fake vertical
  look with a pitch offset only).
- Networking / multiplayer.
- A level editor (maps are hand-authored data files; an editor is out of scope).

---

## 2. Stack & Dependencies

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) | Type safety for math-heavy engine; catches geometry/index bugs at compile time. |
| Bundler / dev server | **Vite** | Fast HMR, zero-config TS, first-class PWA story, tiny prod output. |
| Rendering | **HTML5 Canvas 2D** (`CanvasRenderingContext2D`, `ImageData`) | Raycasters write a column/pixel buffer; 2D canvas with a typed pixel buffer is the simplest path and is plenty fast at our resolution. WebGL is a deliberate non-choice (see below). |
| Test runner | **Vitest** | Native Vite integration, shares the TS/ESM config, runs headless in Node, fast watch mode. |
| PWA | **vite-plugin-pwa** (build-time only) | Generates the service worker + manifest with Workbox precaching. Avoids hand-writing/maintaining a correct SW. Build-time dep, not shipped as a runtime framework. |

**Dependency policy: default to zero.** Every runtime dependency must be justified
here. Current runtime dependencies: **none**. The game ships hand-written engine code.

Dev/build dependencies (not shipped to the user, or only as generated output):
- `vite`, `typescript`, `vitest` — toolchain, non-negotiable for the chosen stack.
- `vite-plugin-pwa` — build-time SW/manifest generator. Justified: writing and
  maintaining a correct, cache-versioned service worker by hand is error-prone; this
  is a well-maintained, narrowly-scoped plugin. If it ever feels heavy we can replace
  it with a ~40-line hand-written SW; the manifest itself is static JSON either way.

**No game engine, no ECS library, no math library, no UI framework.** Vectors and
matrices are a handful of functions; an ECS abstraction is unjustified at this scale.

### Why Canvas 2D and not WebGL
At our internal render resolution (see Performance Budget) the raycaster is
fill-rate bound on a few hundred wall columns plus a handful of sprites. A typed
`Uint32Array` pixel buffer blitted via `putImageData` comfortably clears 30 fps on
mid-tier hardware and keeps the renderer **pure and unit-testable** (it writes to a
plain buffer, not a GPU context). WebGL would add complexity, shader tooling, and a
harder-to-test render path for no required gain at this scope. We keep the renderer
behind an interface so a WebGL backend remains possible later without touching game logic.

---

## 3. Core Architecture

### 3.1 Module layout (logic vs. platform)
The hard rule that makes everything testable: **engine logic never imports the DOM,
Canvas, or `window`.** Platform code (canvas, input, audio, RAF loop) lives at the
edges and talks to pure logic through plain data.

```
Pure (Node-testable, no DOM)        Platform (browser-only, thin)
─────────────────────────────       ─────────────────────────────
math (vectors, angles)              canvas renderer backend
map (grid, tiles, query)            touch/keyboard input
raycaster (DDA, columns)            audio
collision (move & slide)            RAF / fixed-timestep driver
combat (hitscan, damage)            PWA shell
entities + AI (state machines)
world/game state + step()
```

### 3.2 Fixed-timestep game loop
- **Simulation** runs at a fixed `dt` of **1/60 s**. We accumulate real elapsed time
  and step the simulation in whole ticks; leftover time is passed to the renderer as
  an interpolation alpha. This makes physics/AI deterministic and frame-rate
  independent (critical for headless tests — same inputs, same result).
- **Rendering** runs once per `requestAnimationFrame`, decoupled from sim rate. If the
  device can only paint 30 fps, the sim still advances correctly (it just runs ~2 sim
  ticks per paint).
- Spiral-of-death guard: clamp max accumulated time per frame (e.g. 0.25 s) so a
  background tab or stall can't trigger a runaway catch-up.

```
loop(now):
  frameTime = min(now - last, MAX_FRAME)       // clamp
  last = now
  acc += frameTime
  while acc >= DT:
    world.step(DT, input.sample())             // pure, deterministic
    acc -= DT
  renderer.draw(world, acc / DT)               // alpha for interpolation
```

`world.step()` is pure and exported from the logic layer, so tests call it directly
with synthetic input and assert on resulting state — **no loop, no canvas, no clock.**

### 3.3 Map format (grid-based)
Maps are plain data (TS object / JSON), authored by hand:

```ts
interface GameMap {
  width: number;
  height: number;
  tiles: Uint8Array;          // width*height, 0 = empty, >0 = wall texture id
  floorTexture: number;
  ceilTexture: number;
  lightLevel: number;         // base ambient 0..1
  player: { x: number; y: number; angle: number };
  entities: EntitySpawn[];    // clowns, pickups, exit
}
```
- Tile coordinates are integers; world coordinates are floats with tile size = 1.0.
- A `0` tile is walkable space; non-zero indexes into a texture table.
- Wall textures and lighting falloff are properties of the renderer, driven by tile id
  and distance — no per-wall 3D geometry.

### 3.4 Raycasting renderer
- Classic **DDA grid raycast** per screen column: cast a ray from the player through
  each column's view direction, step tile-by-tile until a wall tile is hit, compute the
  **perpendicular distance** (corrects fisheye), derive wall slice height, and sample
  the wall texture column.
- **Lighting falloff**: shade each column by `clamp(lightLevel * (1 / (1 + dist*k)))`
  (or a distance-banded LUT for speed), plus a small N/S vs E/W side darkening for
  fake directional light. Produces the moody, distance-fogged Doom look.
- **Z-buffer**: store per-column wall distance in a `Float32Array`; sprites test against
  it for occlusion.
- Floor/ceiling: flat-shaded color or simple textured floorcasting (start flat-shaded
  for the slice; textured floor is an optional perf-budgeted upgrade).

### 3.5 Sprite billboarding (enemies & pickups)
- Every drawable entity is a **billboard**: a flat sprite always facing the camera.
- Transform entity world position into camera space, project to a screen x and a
  scaled height, draw the sprite column-by-column, **skipping columns occluded by the
  wall z-buffer**.
- Sprites are drawn **back-to-front** (sorted by distance) so nearer sprites overlap
  farther ones correctly.
- Directional sprites (enemy facing 8-way relative to camera) are supported by the
  sprite interface from day one, even though placeholders use a single frame.

### 3.6 Entity & player state
```ts
interface Player {
  x, y, angle: number;
  pitch: number;              // fake vertical look (horizon offset only)
  health: number;
  weapons: WeaponState[];
  currentWeapon: number;
}

type EntityKind = 'clown' | 'pickup' | 'exit';

interface Entity {
  id: number;
  kind: EntityKind;
  x, y: number;
  radius: number;             // collision/hit radius
  spriteId: string;           // -> sprite provider (NOT a file path)
  health?: number;
  ai?: AIState;               // enemies only
  // pickup/exit-specific fields...
}
```
- All mutable game state lives in a single `World` object: `player`, `entities[]`,
  `map`, `time`, `rng`. `step()` is the only thing that mutates it.
- **Deterministic RNG**: a small seeded PRNG (mulberry32, ~5 lines) so AI/spawn behavior
  is reproducible in tests. No `Math.random` in logic.

### 3.7 Enemy AI (state machine)
Enemies are explicit finite state machines. Phase-1 clown:
```
IDLE ──sees player──> CHASE ──in melee range──> ATTACK
  ▲                      │                         │
  └──────lost LoS────────┘                         │
ANY ──health<=0──> DYING ──anim done──> DEAD (removed)
HURT (brief stagger on damage) ──> back to CHASE
```
- Line-of-sight via a ray/grid walk against wall tiles.
- Chase = move toward player with the same **move-and-slide** collision the player uses.
- Each transition is a pure function of (entity, world, dt) → new state, so transitions
  are unit-tested directly.

### 3.8 Combat
- Phase-1 weapon is **hitscan** (instant ray): on fire, cast a ray from the player along
  the aim direction, find the nearest entity whose billboard the ray intersects within
  weapon range **and** before any wall (z-tested), apply damage.
- Ammo is decremented on fire; no fire when empty. Fire rate gated by a per-weapon cooldown.
- Architecture leaves room for **projectile** weapons later (balloon-bomber, etc.) as
  moving entities with their own collision.

---

## 4. Mobile Controls (touch-first)

Touch is the primary input. Keyboard/mouse exists **only as a dev fallback** and is
never assumed.

- **Left thumb — virtual joystick (move/strafe).** Touch-down on the left half plants
  a floating stick origin; drag vector → forward/back (y) and strafe (x). Dead zone +
  radial clamp. Stick re-centers on each touch-down so the thumb's rest position doesn't
  matter.
- **Right side — drag to look.** Dragging anywhere on the right half yaws the camera
  (horizontal) and applies a small pitch (vertical, clamped horizon offset only).
  Sensitivity is a setting.
- **Shoot.** A dedicated fire button (bottom-right, under the look thumb) **and** tap-to-shoot
  on the right look area (configurable), so a player can look-and-fire one-handed.
- **Weapon swap.** A small weapon indicator/button (e.g. bottom-center) cycles weapons;
  long-press or a swipe opens a quick radial later. Phase 1 has one weapon, so the
  control is present but mostly inert.
- Multi-touch: all of the above must work **simultaneously** (move + look + fire). We track
  touches by `identifier`, not by assuming one finger.

Input is sampled into a **plain `InputState` struct** (move vector, look delta, firing bool,
swap request). The simulation only ever sees this struct — it has no idea whether a thumb or
a keyboard produced it, which is exactly what makes it testable.

```ts
interface InputState {
  move: { x: number; y: number };   // -1..1 strafe, forward
  look: { x: number; y: number };   // yaw, pitch delta this sample
  firing: boolean;
  swapWeapon: number;                // 0 none, +/-1 cycle, or index
}
```

---

## 5. Verification Plan (machine-checkable, headless)

Everything in the **Pure** column of §3.1 is tested with Vitest in Node — **no canvas,
no DOM, no rendering**. Tests assert on numbers and state, which is possible precisely
because logic is decoupled from the renderer.

**Raycasting correctness**
- Ray into a known map hits the expected wall tile at the expected face (N/S/E/W) and
  distance, within epsilon, for hand-computed cases (axis-aligned and diagonal rays).
- Perpendicular-distance (fisheye) correction: a wall straight ahead and the same wall
  seen at an angle yield consistent, fisheye-free slice heights.
- A ray that exits the map bounds terminates without hitting (no infinite loop).

**Collision (move-and-slide)**
- Moving into a wall stops at the wall minus radius; player never ends inside a solid tile.
- Sliding along a wall preserves the tangential component.
- Corner cases: diagonal push into a concave corner doesn't tunnel through.

**Hit detection (combat)**
- Hitscan ray hits an entity directly in front within range → entity takes expected damage.
- Wall between player and entity (z-test) → **no** damage.
- Entity out of range / off-axis → miss. Empty ammo → no shot fired, no damage.

**Enemy state transitions**
- IDLE→CHASE on gaining line-of-sight; CHASE→IDLE on losing it (with LoS blocked by a wall).
- CHASE→ATTACK within melee range; damage applied to player on attack tick.
- health→0 triggers DYING then DEAD/removal; HURT stagger fires on damage and returns to CHASE.
- Determinism: same seed + same scripted input → identical entity trajectories (snapshot test).

**Loop / determinism**
- `step()` with a fixed input sequence produces a byte-stable world snapshot across runs.

**Sprite projection (math only, no draw)**
- World→camera→screen projection puts a known entity at the expected screen x and scale;
  entities behind the camera are culled.

**Coverage gate**: CI runs `vitest run`. Engine (`src/engine/**`) targets **≥80% line
coverage**; the math/raycast/collision/combat modules target near-100% since they're pure.

**Performance smoke (optional, headless):** a Node benchmark that calls the column-cast
inner loop N times and asserts it stays under a time budget, catching algorithmic
regressions without a GPU.

---

## 6. Asset Strategy (procedural-first, art-agnostic)

Gameplay must be **provable before any art exists**. So:

- **Walls/floor/ceiling** start as flat colors / generated checker & noise textures
  drawn into offscreen canvases at boot. No image files required to play.
- **Sprites (enemies, pickups, projectiles)** start as **procedural billboards**: e.g. a
  clown is a colored capsule with a white face circle, red nose dot, and a simple
  health-tinted outline — enough to read position, facing, and state at a glance.

**The sprite-swap interface** is the contract that lets real art drop in with zero
gameplay changes. Entities reference a **`spriteId` string**, never a file path. A
`SpriteProvider` resolves that id to drawable frames:

```ts
interface SpriteFrame { /* a source bitmap + dimensions, renderer-agnostic */ }

interface SpriteSet {
  // facing: 0..7 for 8-direction billboards; state e.g. 'idle'|'walk'|'attack'|'die'
  frame(state: string, facing: number, animTime: number): SpriteFrame;
}

interface SpriteProvider {
  get(spriteId: string): SpriteSet;
}
```
- Phase 1 ships a **`ProceduralSpriteProvider`** that synthesizes frames from shapes.
- Later, an **`AtlasSpriteProvider`** loads a texture atlas + JSON frame map and is
  swapped in at composition root. **No entity, AI, or combat code changes** — they only
  ever touch `spriteId` and the `SpriteProvider` interface.
- Same pattern for audio (`sfxId` strings) and walls (`textureId` → texture provider).

Asset id registry (`assets/manifest.ts`) is the single place mapping ids → procedural
generator or future file, so swapping art is a one-file change.

---

## 7. File / Folder Structure

```
doom-like-1st-person/
├─ docs/
│  └─ SPEC.md                  ← this file
├─ public/
│  ├─ manifest.webmanifest     ← PWA manifest (icons, name, display: standalone)
│  └─ icons/                   ← PWA icons (placeholder generated)
├─ src/
│  ├─ engine/                  ← PURE logic, no DOM (unit-tested)
│  │  ├─ math.ts               ← vectors, angle wrap, lerp, clamp
│  │  ├─ rng.ts                ← seeded mulberry32
│  │  ├─ map.ts                ← GameMap type, tile queries
│  │  ├─ raycast.ts            ← DDA column raycaster (returns hit data)
│  │  ├─ collision.ts          ← move-and-slide
│  │  ├─ combat.ts             ← hitscan, damage application
│  │  ├─ entities.ts           ← Entity/Player types, spawn
│  │  ├─ ai.ts                 ← enemy state machines
│  │  ├─ input.ts              ← InputState type
│  │  └─ world.ts              ← World state + step(dt, input)
│  ├─ render/                  ← PLATFORM: canvas backend
│  │  ├─ renderer.ts           ← walls/floor/ceiling from raycast + z-buffer
│  │  ├─ sprites.ts            ← billboard projection & draw (z-tested)
│  │  └─ hud.ts                ← health, ammo, weapon
│  ├─ assets/                  ← sprite/texture/audio providers + manifest
│  │  ├─ spriteProvider.ts     ← SpriteProvider interface
│  │  ├─ procedural.ts         ← ProceduralSpriteProvider + texture gen
│  │  └─ manifest.ts           ← id registry
│  ├─ platform/                ← PLATFORM: input, audio, loop, PWA glue
│  │  ├─ touch.ts              ← virtual joystick + look + fire/swap → InputState
│  │  ├─ keyboard.ts           ← dev fallback → InputState
│  │  ├─ loop.ts               ← fixed-timestep driver (RAF)
│  │  └─ audio.ts              ← sfxId playback (stubbed in slice)
│  ├─ levels/
│  │  └─ level01.ts            ← hand-authored map data
│  ├─ main.ts                  ← composition root: wires platform → engine → render
│  └─ style.css
├─ test/                       ← Vitest specs mirroring src/engine/**
│  ├─ raycast.test.ts
│  ├─ collision.test.ts
│  ├─ combat.test.ts
│  ├─ ai.test.ts
│  └─ world.test.ts
├─ index.html
├─ vite.config.ts              ← Vite + PWA + Vitest config
├─ tsconfig.json
├─ package.json
├─ CLAUDE.md                   ← stack, architecture, build/test/run commands
└─ README.md
```

---

## 8. Performance Budget (holding 30+ fps on mid-tier mobile)

**Frame budget @ 30 fps = 33.3 ms; @ 60 fps = 16.6 ms.** We target a *simulation* that
is cheap and a *render* that scales with internal resolution, aiming comfortably under
33 ms on mid-tier hardware with headroom for 60 fps on better devices.

Tactics:
- **Internal render resolution decoupled from device pixels.** Render to a buffer of e.g.
  **~480–640 px wide** (≈ that many ray columns) and upscale to the screen via CSS/canvas
  scaling. Wall casting cost is ~O(columns × avg DDA steps); fewer columns = the single
  biggest lever. Resolution is a runtime setting with an **adaptive auto-scaler** that
  drops resolution if frame time exceeds budget.
- **One ray per column**, DDA integer-grid stepping (no per-pixel ray marching).
- **Typed-array pixel buffer** (`Uint32Array` view over `ImageData`), single
  `putImageData`/blit per frame. No per-pixel canvas API calls.
- **Distance-banded lighting LUT** instead of per-pixel float math where it matters.
- **Sprite cost bounded**: only entities within view frustum + range are projected;
  occluded columns skipped via z-buffer; back-to-front sort is O(n log n) on a handful
  of enemies.
- **Fixed-timestep sim is tiny** (a few dozen entities, simple AI) — well under 1 ms; the
  budget is dominated by fill, which the resolution lever controls.
- **No per-frame allocations** in the hot path: reuse buffers/arrays, avoid closures and
  object literals inside column/pixel loops (GC pauses are the enemy of steady fps).
- **Avoid layout/composite churn**: one canvas, fixed size, no DOM thrash; HUD drawn on
  the same canvas or a rarely-updated overlay.
- **Measurement, not vibes**: an on-screen dev FPS/frame-time meter plus the headless
  perf-smoke test (§5) so regressions are caught in CI and on-device.

**Acceptance for the Phase-1 slice**: sustained **≥30 fps** on a mid-tier phone at the
default internal resolution, with the adaptive scaler keeping it there if a device
struggles.

---

## 9. Phase Plan (summary — build order is enforced)

**Phase 0 — Spec.** This document. *Stop for approval.* ← we are here.

**Phase 1 — Vertical slice** (only after approval):
- One hand-authored level: walls + textures + lighting falloff.
- Working raycasting render at target framerate (with FPS meter + adaptive scaler).
- Touch movement + look + shoot on mobile (keyboard dev fallback).
- ONE enemy (basic clown): spawn, billboard, chase AI, takes damage, dies.
- ONE weapon (pistol): hitscan hit detection + ammo.
- HUD: health, ammo.
- Tests for raycast/collision/combat/AI as they're built.
- `CLAUDE.md` + exact run instructions.
- *Stop for on-phone playtest.*

**Phase 2+ — Expansion (outline only, not built yet):**
- **Clown variants**, each a distinct AI state machine + sprite set:
  - *Melee jester* — fast, low HP, lunges (the Phase-1 clown generalized).
  - *Ranged balloon-bomber* — lobs slow arcing projectile entities; keeps distance.
  - *Fast acrobat* — high speed, strafes/dodges, low HP, hard to hit.
  - *Tank brute* — high HP, slow, heavy melee; soaks shots.
- **Weapon progression** with world pickups: pistol → shotgun (spread = multi-ray hitscan)
  → nailgun/SMG (high rate-of-fire) → something heavy (rocket/projectile + splash). Ammo
  types per weapon; swap UI becomes meaningful.
- **Level progression**: 3–5 amusement-park maps — *funhouse*, *big top*, *hall of
  mirrors*, *carousel/midway* — with level-exit entities, locked-door/key beats, and a
  tuned difficulty curve (enemy mix & density per map).
- **Audio hooks** (sfxId/musicId providers, already stubbed), **save/checkpoint** (serialize
  World + progress to `localStorage`/IndexedDB), and **pause** (loop already supports halting
  the accumulator cleanly).

---

## 10. Open Questions / Defaults (call out before Phase 1)
- **Aspect/orientation**: default to **landscape**, locked via manifest `orientation`.
  (Portrait is awkward for an FPS; confirm if you disagree.)
- **Default internal resolution**: start at **480 columns** with adaptive scaling; tune on
  your device during the playtest.
- **Look invert / sensitivity**: expose as settings; sensible defaults chosen at slice time.

---

*End of Phase 0 spec. Awaiting approval before any scaffolding or code.*
