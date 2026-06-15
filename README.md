# Carnival of Fear 🤡

A mobile-first, **Doom-style first-person shooter** — 2.5D raycasting renderer
(not real 3D) — set in an abandoned amusement park overrun by creepy clowns.
Zero runtime dependencies, installable as a PWA.

> **Status:** Phase 1 vertical slice. One level, one enemy (clown), one weapon
> (pistol). See [`docs/SPEC.md`](docs/SPEC.md) for the full design and
> [`CLAUDE.md`](CLAUDE.md) for architecture.

## Run it

```bash
npm install
npm run dev
```

Then open the printed URL (e.g. `http://localhost:5173`).

### Playtest on your phone

Both devices on the same Wi‑Fi:

```bash
npm run dev -- --host
```

Vite prints a `Network:` URL (e.g. `http://192.168.1.42:5173`). Open that on
your phone. Rotate to **landscape**. For an installable PWA / offline test, use
the production build instead:

```bash
npm run build
npm run preview -- --host
```

On iOS Safari / Android Chrome use *Add to Home Screen* to install it.

## Controls

**Touch (primary):**
- **Left thumb** — drag anywhere on the left half: floating joystick to move/strafe.
- **Right side** — drag to look (yaw + a little pitch).
- **Red button** (bottom-right) — fire. Hold for repeat.
- **Blue button** (bottom-center) — swap weapon (one weapon for now).
- Tap to start audio; tap after death/level-clear to restart.

**Keyboard/mouse (dev fallback):**
- `WASD` move, `←/→` turn, `PageUp/PageDown` look up/down, click to capture mouse
  for look, `Space`/`Ctrl` fire, `Q`/`E` swap.

## Goal

Survive the midway, clear the clowns, and reach the glowing green **EXIT**.

## Develop

```bash
npm test          # 34 headless tests (raycast, collision, combat, AI, determinism, render)
npm run typecheck
npm run build
```
