# Bomberman 65

Bomberman 64-inspired 3D bomberman game with deterministic simulation and AI.

## Overview

Open-source portfolio project featuring:

- Deterministic, tick-authoritative discrete simulation
- Surface-based 3D with elevation (Bomberman 64-style)
- Worker-driven simulation (no game logic on main thread)
- React + React Three Fiber rendering
- TensorFlow.js neural net AI (planned)
- Web and Electron desktop targets

## Tech Stack

- **TypeScript** (strict mode)
- **pnpm** workspaces monorepo
- **React** — GUI (separate root)
- **React Three Fiber** — 3D rendering (separate root)
- **Zustand** — UI/session state
- **Vite** — build tooling
- **Electron** — desktop shell
- **Vitest** — testing

## Project Structure

```
apps/
  web/              Vite + React web app
  desktop/          Electron desktop shell

packages/
  shared/           Shared types, math, serialization, constants
  game-core/        Simulation world, rules, intents, replay, runner
  app-state/        Zustand UI/session stores
  workers/          Simulation worker and message contracts
  render-r3f/       React Three Fiber scene and rendering
  ui-react/         React GUI shell and panels
```

## Setup

```bash
pnpm install
```

## Scripts

```bash
pnpm typecheck      # Type-check all packages
pnpm test           # Run all tests
pnpm lint           # Lint all packages
pnpm format:check   # Check formatting
```

## Architecture

See [CLAUDE.md](./CLAUDE.md) for full architecture rules and implementation guidelines.

Canonical specs live on [Notion](https://www.notion.so/Bomberman-65-b762fa5d21354f6db23decb1ba69a287).

## License

TBD
