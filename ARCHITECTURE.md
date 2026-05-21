# Architecture — Design Decisions

This document explains the major design choices in the project and their rationale. It is written for portfolio reviewers, contributors, and future AI collaborators.

**Scope note:** The project began as the Bomberman 65 game and has since become the **Emulator ML Platform** — a TypeScript-first platform for training ML agents to play games, with Bomberman 26 as one environment alongside emulator-backed targets. Sections 1–10 below describe the **B26 simulation engine** (v0 complete). Section 11 describes the **platform layer** built in Phases A–D. See `CLAUDE.md` for the current project framing.

## Why This Architecture?

The B26 engine demonstrates that a game with complex simulation rules can be built with clean separation of concerns, deterministic behavior, and modern web technologies. Every architectural choice optimizes for **readability, testability, and portability** over premature performance optimization.

---

## 1. Deterministic Tick-Authoritative Simulation

**Decision:** All game state changes happen through a discrete tick pipeline. No floating-point time deltas, no frame-rate-dependent logic.

**Why:**

- Determinism enables replay: record intents, reconstruct any state by replaying from a checkpoint
- Simplifies testing: same inputs always produce same outputs
- Eliminates an entire class of bugs (frame-rate sensitivity, floating-point drift)
- Enables future multiplayer: tick-based lockstep is well-understood

**How it works:**

- `executeTick(snapshot, intents)` mutates the world snapshot in place
- The 8-step pipeline runs in guaranteed order (intents → timers → movement → explosions → cleanup)
- Movement uses integer tick durations split into leaving/entering phases

---

## 2. Worker-First Architecture

**Decision:** All simulation runs in Web Workers, including the active visible game. The main thread only handles presentation.

**Why:**

- Keeps the renderer at 60fps even during complex chain reactions
- Enables headless batch runs for AI training without blocking UI
- Same code path for active play, headless evaluation, and replay — one worker implementation
- Forces clean separation: you literally cannot import React from the simulation

**Trade-off:** Adds message-passing overhead. Acceptable for a turn-based discrete simulation where ticks are cheap.

**Implementation:**

- `SimulationBridge` translates `WorkerCommand` → `SimulationRunner` operations → `WorkerEvent`
- `WorkerRunManager` on the main thread manages worker lifecycle
- `simulation-worker.ts` is the entry point, shared for all modes

---

## 3. Separate GUI and Renderer Roots

**Decision:** The React GUI and the React Three Fiber renderer are conceptually separate. Neither owns simulation state.

**Why:**

- GUI panels (sidebars, inspector, controls) change independently from 3D rendering
- Prevents gameplay rules from leaking into visual code
- The `RenderModel` adapter creates a clear data boundary — the renderer only sees positions, colors, and progress values

**In practice:** Both share the same React tree (R3F Canvas is a child of the GUI layout), but they communicate only through Zustand stores (UI state) and the `RenderModel` (derived from simulation snapshots).

---

## 4. Surface-Based 3D with Elevation

**Decision:** The world is a 3D grid indexed `[z][y][x]` with max 3 elevation levels. Movement is surface-based (tiles + ramps), not free 3D.

**Why:**

- Matches Bomberman 64's gameplay feel — 3D presentation, 2D-like rules
- Simpler collision and movement rules than volumetric 3D
- Elevation adds tactical depth (throwing bombs up/down, falling) without physics simulation
- Grid-based rules are easier to reason about and test

---

## 5. Two-Phase Movement Model

**Decision:** Surface travel has two phases: **leaving** (entity logically at source) and **entering** (entity logically at destination). Collision is checked at the boundary.

**Why:**

- Solves the "two entities swap tiles" problem — they can't both be in the leaving phase targeting each other's cell simultaneously
- Clear ownership: at any tick, every entity is in exactly one cell
- Enables visual interpolation: leaving phase = 0→50% of travel, entering phase = 50→100%
- Duration split (`floor(N/2)` + `ceil(N/2)`) gives natural halfway-point collision testing

---

## 6. Explosion State Belongs to the Bomb

**Decision:** There is no separate "explosion entity" or "explosion layer." An exploding bomb transitions to the `exploding` state and owns its `affectedCells` array.

**Why:**

- Fewer entity types to manage
- Chain detonation is natural: when a bomb's affected cells overlap another bomb, that bomb detonates
- Cleanup is simple: when the explosion timer expires, the bomb transitions to `removed`
- The affected cells array is computed once at detonation time, not recalculated per tick

---

## 7. Intent-Based Input System

**Decision:** All actor actions flow through an `ActorIntent` type. Intent collectors produce intents; the simulation validates and applies them.

**Why:**

- Same pipeline for player input, bot AI, and replay playback
- Validation happens in one place (can the actor act? does it have the right upgrade? is the bomb count exceeded?)
- Easy to add new input sources (network multiplayer, ML model) without changing simulation code
- Replay is just an `IntentCollector` that reads from a log

**Collectors implemented:**

- `KeyboardIntentCollector` — WASD + action keys
- `BotIntentCollector` — rule-based AI with danger zone awareness
- `ReplayIntentCollector` — feeds from recorded replay log
- `CompositeIntentCollector` — merges multiple collectors

---

## 8. Zustand for UI State Only

**Decision:** Zustand stores hold layout state, selection state, overlay toggles, and playback controls. Never simulation state.

**Why:**

- Simulation state lives in the worker — putting it in Zustand would mean duplicating it on the main thread
- Clear ownership: Zustand = presentation concerns, Worker = game truth
- Prevents accidental coupling between UI reactivity and game rules
- Stores are small and focused (session, selection, layout, worker status)

---

## 9. Validation Pipeline with Strict/Lenient Modes

**Decision:** Content validation (maps, scenarios) runs through a pipeline that can either throw on errors (strict) or collect warnings (lenient).

**Why:**

- Strict mode for production: invalid maps cannot start a game
- Lenient mode for tooling: the map editor can load broken maps and show what's wrong
- Structured `ValidationIssue` objects with codes, messages, and locations enable both GUI display and log output
- Validation is a separate concern from loading — loaders call validators, not the other way around

---

## 10. Replay Architecture

**Decision:** Replays store the initial snapshot, per-tick intent log, and periodic checkpoint snapshots. Seeking reconstructs state from the nearest checkpoint.

**Why:**

- Intent logs are tiny compared to full state snapshots
- Checkpoints (default every 300 ticks) bound the cost of seeking
- Embedding the initial snapshot makes replays portable (no external map file dependency)
- The same `executeTick` function replays deterministically — no separate replay engine

---

## 11. Platform Layer (Phases A–D)

**Decision:** Phases A–D added a platform layer on top of the B26 engine. Every game backend — the B26 engine and emulator-backed games — implements one `GameEnvironment` interface. Agents, experiment sessions, and the platform UI interact only through that interface, never with engine or emulator internals.

**Why:**

- One interface lets agents and training code be written once and run against any game (B26, N64 emulator, future targets)
- Forces the same separation the B26 engine already enforces internally — environment logic stays out of UI and renderer code
- Makes the project a reusable ML experiment platform, not a single-game codebase

**Package structure (Phases 0, A–D):**

- `packages/platform-core/` — the core. `GameEnvironment` interface (`types/environment.ts`: `FrameData`, `Observation`, `StepResult`, `StateSnapshot`, discrete/continuous/composite `ActionSpaceDescriptor`). `AgentRuntime` (`Agent` interface; `RandomAgent`, `NoOpAgent`, `ScriptedAgent`). `ExperimentSession` + `ExperimentRunner` (episode orchestration, checkpoints, `EpisodeMetrics`). `ObservationPipeline` (frame → `ProcessedObservation`).
- `packages/env-bomberman26/` — `Bomberman26Environment`, the B26 engine wrapped behind `GameEnvironment` (Phase 0). Includes a throughput `benchmark.ts`.
- `packages/env-n64wasm/` — `N64WasmEnvironment`, the N64Wasm emulator behind `GameEnvironment` (Phase A feasibility spike; see `spike/FEASIBILITY.md`).
- `packages/ml-inference/` — `InferenceAgent`, a TensorFlow.js-backed agent, with `builtinModels` and a `modelManifest` loader (Phase C).
- `packages/platform-server/` — `EnvironmentServer`, hosts environment instances and serves them over a transport.
- `apps/env-server/` — runnable WebSocket server exposing hosted environments.
- `apps/training/` — Python training sidecar: a REINFORCE training loop (`train.py`), rollout collection, and a protocol/client that talks to the env-server.
- `apps/web/` — platform demo (`platform-demo`) with live inference metrics.

**Worker and remote execution:**

- `EnvironmentWorkerProtocol` + `EnvironmentWorkerBridge` run an environment in a worker, mirroring the B26 engine's worker-first rule (decision 2) at the platform level.
- `RemoteGameEnvironment` is a client-side proxy implementing `GameEnvironment`; `RemoteEnvironmentProtocol` handles serialization (including binary blobs) for transport. This is how training clients connect to server-hosted emulator instances over WebSocket.

**Trade-off:** The interface boundary adds indirection and a serialization layer for remote environments. Accepted because it is what makes cross-game agents and server-side training throughput possible.

---

## What's Not Here Yet

- **Multiplayer networking** — The tick-based architecture supports it; implementation is future work
- **Map editor** — Maps are hand-authored JSON for v0
- **Asset pipeline** — v0 uses primitives (cubes, spheres, capsules); real models come later
- **Production Electron build** — Dev mode works (loads Vite dev server); packaged distribution needs electron-builder config
- **N64Wasm vs Mupen64Plus decision** — Phase D scope; N64Wasm is the web-first path, Mupen64Plus the throughput fallback
- **TensorKart baseline comparison** — Mario Kart 64 reference target, not yet integrated
