# Bomberman 65

Bomberman 64-inspired 3D bomberman game and emulator ML platform with deterministic simulation, remote environment hosting, and browser/Python experiment workflows.

## Overview

Open-source portfolio project featuring:

- Deterministic, tick-authoritative discrete simulation
- Surface-based 3D with elevation (Bomberman 64-style)
- Worker-driven simulation (no game logic on main thread)
- React + React Three Fiber rendering
- Rule-based bot AI (TensorFlow ML planned)
- Web and Electron desktop targets

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the web app
cd apps/web && pnpm dev
# Open http://localhost:3000

# Start Electron desktop (requires web dev server running)
cd apps/desktop && pnpm dev
```

## Controls

| Key             | Action             |
| --------------- | ------------------ |
| W / Arrow Up    | Move up            |
| S / Arrow Down  | Move down          |
| A / Arrow Left  | Move left          |
| D / Arrow Right | Move right         |
| Space           | Place bomb         |
| E               | Pickup / Pump bomb |
| Q               | Throw held entity  |
| F               | Kick bomb          |

## Tech Stack

- **TypeScript** (strict mode) — all packages
- **pnpm** workspaces — monorepo management
- **React 19** — GUI (separate root from renderer)
- **React Three Fiber 9** — 3D rendering
- **Three.js** — 3D engine
- **Zustand 5** — UI/session state (never simulation state)
- **Vite 8** — build tooling
- **Electron 41** — desktop shell
- **Vitest 4** — testing
- **ESLint + Prettier** — linting and formatting

## Project Structure

```
apps/
  web/              Vite + React web app entry point
  desktop/          Electron desktop shell (loads web app)
  env-server/       WebSocket host for remote GameEnvironment instances
  training/         Python training/evaluation sidecar

packages/
  shared/           Shared types, math, serialization, constants
  game-core/        Simulation: world, rules, intents, replay, runner,
                    validation, factories, adapters
  platform-core/    Environment interface, runner/session, remote protocol
  platform-server/  Multi-instance server-side environment host
  env-bomberman26/  GameEnvironment adapter for the custom engine
  env-n64wasm/      GameEnvironment adapter for N64Wasm
  ml-inference/     TF.js inference agent and model manifest support
  app-state/        Zustand stores (session, selection, layout, worker status)
  workers/          Simulation worker and WorkerRunManager
  render-r3f/       React Three Fiber scene, camera, terrain, actors,
                    bombs, items, overlays
  ui-react/         React GUI shell, layout, sidebars, top bar, inspector
```

## Scripts

```bash
pnpm typecheck      # Type-check all packages
pnpm test           # Run all tests (50 tests)
pnpm lint           # Lint all packages
pnpm format         # Format with Prettier
pnpm format:check   # Check formatting
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design decisions.

### Key Principles

1. **Simulation / presentation separation** — Game rules run in workers, never in React components or renderer code
2. **Deterministic tick pipeline** — All actions are discrete, all state changes are reproducible
3. **Worker-first** — Even the active visible simulation runs in a worker; main thread is presentation-only
4. **Separate roots** — GUI (React) and renderer (R3F) consume derived read models, not raw simulation state
5. **Zustand for UI only** — Selection, layout, overlays, playback state. Never authoritative game state.

### Simulation Pipeline (per tick)

1. Collect actor intents
2. Validate preconditions (actor state, upgrade requirements, bomb count)
3. Apply intents (start movement, place bombs, kick/carry/throw)
4. Advance timers (stun, shield, fuse, phase timers)
5. Resolve phase boundaries (leaving → entering, thrown landing, bounce chains)
6. Resolve falling and out-of-bounds
7. Transition expired bomb fuses to explosions
8. Apply blast effects (elimination, breakable destruction, chain detonation)
9. Cleanup (remove expired explosions, finalize eliminated actors)

## Canonical Specs

The authoritative design specs live on Notion:

- [Project Hub](https://www.notion.so/Bomberman-65-b762fa5d21354f6db23decb1ba69a287)
- [Architecture Spec v0](https://www.notion.so/333d1838c6158113bfa5c46840cae29e)
- [Renderer & UI Architecture Spec v0](https://www.notion.so/334d1838c615816e9cd4ef212ac80b1e)
- [Map & Content Schema v0](https://www.notion.so/334d1838c6158185b03bc50a42cc88ec)
- [UI States & Screen Flow Spec v0](https://www.notion.so/334d1838c6158148a2adcf6c85a69065)
- [Implementation Master Prompt v0](https://www.notion.so/334d1838c6158159874dcfa167b9f3f6)

## License

TBD
