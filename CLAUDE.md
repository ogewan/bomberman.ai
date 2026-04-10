# Emulator ML Platform (Bomberman 65)

## Project Overview

Emulator ML Platform — a TypeScript-first experiment platform for training ML agents to play games. Wraps game environments (custom engines and emulators) behind a unified `GameEnvironment` interface. Portfolio project targeting **web** and **desktop (Electron)**.

**Game targets:**
- **Bomberman 26** — custom deterministic tick-based simulation engine (v0 complete)
- **Bomberman 64** — N64 via N64Wasm emulator (Phase A: feasibility spike)
- **TensorKart** — Mario Kart 64 via emulator (baseline reference)

**Key principle:** Optimize for a TypeScript product that depends on an emulator, not an emulator project that happens to have a UI.

### Bomberman 26 Engine
Bomberman 64-inspired 3D bomberman game. Uses a deterministic, tick-authoritative discrete simulation with surface-based 3D elevation (not free-volumetric). Currently uses rule-based bot AI; ML/neural net agents planned via the platform.

## Source of Truth

The canonical specs live on Notion. **For game/design rules, follow the Notion specs. For implementation strictness, coding style, and workflow rules, follow this config file.**

- [Project Hub](https://www.notion.so/Bomberman-65-b762fa5d21354f6db23decb1ba69a287)
- [Emulator ML Platform Spec v0](https://www.notion.so/33cd1838c6158190bf8bd7d5f6e316d3)
- [Architecture Spec v0](https://www.notion.so/333d1838c6158113bfa5c46840cae29e)
- [Renderer & UI Architecture Spec v0](https://www.notion.so/334d1838c615816e9cd4ef212ac80b1e)
- [Map & Content Schema v0](https://www.notion.so/334d1838c6158185b03bc50a42cc88ec)
- [UI States & Screen Flow Spec v0](https://www.notion.so/334d1838c6158148a2adcf6c85a69065)
- [Implementation Master Prompt v0](https://www.notion.so/334d1838c6158159874dcfa167b9f3f6)

If any future implementation detail conflicts with the Notion specs, prefer the specs unless the user explicitly approves a change.

## Tech Stack

- **Language:** TypeScript (strict mode) — dominant authored code
- **Monorepo:** pnpm workspaces
- **Rendering:** React Three Fiber (R3F) with Three.js (B26 environment)
- **UI:** React (separate root from R3F)
- **State management:** Zustand (UI/session state ONLY — never authoritative simulation/environment state)
- **Desktop:** Electron
- **ML inference:** TensorFlow.js (browser/Node)
- **ML training:** Python (heavy offline training)
- **Emulator:** N64Wasm (web-first), Mupen64Plus (fallback for training throughput)
- **Server:** Node + headless Chromium (Puppeteer) for server-side emulator instances
- **Build:** Vite
- **Testing:** Vitest
- **Linting:** ESLint
- **Formatting:** Prettier

## Architecture — Non-Negotiable Rules

### Platform-Level Rules

1. **All game backends implement `GameEnvironment`.** Platform UI, agents, and experiment sessions interact only through the GameEnvironment interface. Never import game-core or emulator internals directly from platform-level code.
2. **Environment logic must NEVER live in React components or renderer code.** Environments run independently in tests, workers, headless Chromium, and server contexts.
3. **Renderer must NEVER mutate authoritative environment state.** Presentation consumes derived read models / immutable snapshots.
4. **Zustand is UI/session state only.** Allowed: layout state, selection state, session/app state, overlay toggles, worker status summaries, environment status. Do NOT store authoritative environment state in Zustand.
5. **Server-client model for training.** WASM emulators run in headless Chromium (Puppeteer) server-side. Clients connect via WebSocket using `RemoteGameEnvironment`.

### B26 Engine Rules (within game-core / env-bomberman26)

6. **3D renderer and GUI have separate React roots.** One React root for GUI/app shell, one R3F root for 3D rendering.
7. **All B26 simulation runs in workers.** Main thread is presentation-only.
8. **Upgrades are exclusive:** kick, carry/pump, or shield — never multiple.

## Canonical Gameplay Rules

### World Model

- Authoritative world grid indexed as `[z][y][x]`
- Cells store: terrain, optional ramp metadata, optional blocking occupant, optional item
- Actors and bombs also in entity state tables
- Only one blocking actor/bomb occupant per cell; items are non-blocking
- Explosion state belongs to the bomb entity, not a separate layer
- `SimulationRun` = data, `SimulationRunner` = orchestration behavior

### Direction Model

Use semantic `Direction2D` values with a vector lookup table for math operations:

```typescript
type Direction2D =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'northEast'
  | 'northWest'
  | 'southEast'
  | 'southWest';

const DIRECTION_TO_VECTOR: Record<Direction2D, { dx: number; dy: number }>;
```

### Movement Model

- All actions are discrete; movement is duration-based and tile-based
- Surface travel has two phases: **leaving** (entity at source) and **entering** (entity at destination)
- Collision is tested at the leaving → entering boundary
- Thrown travel is distinct: entity occupies no cell while traveling
- Thrown entities do not interact until the thrown-speed leaving phase expires and collision is tested
- Bounce chaining resolves in the same simulation step; cap = at least mapSize + 10
- Do not invent new bounce direction rules
- Fall after throw occurs only after entity enters a cell lacking support below

### Height / Support / Fall Rules

- v0 max height = 3 levels
- Elevated empty cells require support below
- Actors fall immediately when unsupported
- Kicked bombs preserve horizontal momentum after falling
- Items fall by downward transfer, not as moving entities
  - If lower cell has no item, transfer down
  - If lower cell already has an item, upper item stays
- Actors out of bounds die immediately
- Bombs fully resolving out of bounds are removed
- Thrown bombs are NOT out of bounds due only to arc height before resolution
- Thrown bomb fuse timer is independent of travel duration
- Thrown bomb explodes at current z-level when fuse expires; z changes only after higher-z collision step resolves

### Bomb Rules

- Bombs have `power`
- Regular bomb propagation = square with cardinal radius from origin
- Pumped bomb propagation = cube version of regular propagation
- Pumped bombs are not blocked by walls; walls not destroyed unless already breakable by normal rules
- Breakable terrain breaks if inside any explosion
- Chain detonation for bombs in affected cells
- Explosion state belongs to the bomb

### Actor Rules

- Actors have: `count`, `power`, `upgrade`
- Upgrades are exclusive: kick, carryPump, shield
- Actor eliminated on: explosion contact, out of bounds
- Actor stunned on: contact with falling entity, contact with kicked bomb
- If actor recovers from stun while held, actor transitions to falling and bounces on enemy
- Shield grants full invulnerability for duration: cannot be stunned, cannot be eliminated

### Map / Content Rules

- Maps define: dimensions, terrain, ramps, spawns, embedded items, optional rule overrides
- Scenarios define: custom starting bombs, custom actor states, test/debug setups
- Items stay embedded in cells for v0; may have `dropChance` in `0..1`
- Seeded RNG must be used for probabilistic item drops
- Validation: hard fail by default for illegal content; overridable in tooling/debug mode; illegal content may be removed in override mode with warnings emitted

## Package Structure

Do not create empty directories for the sake of following a template. Create subdirectories as needed during their respective implementation phases.

```
apps/
  web/                    # Vite + React platform entry
  desktop/                # Electron shell
  training/               # Python training scripts (separate, not TS)

packages/
  platform-core/          # GameEnvironment interface, AgentRuntime, ExperimentSession, ObservationPipeline
  env-bomberman26/        # B26 adapter: wraps game-core behind GameEnvironment
  env-n64wasm/            # N64Wasm adapter: wraps emulator behind GameEnvironment (Phase A)
  game-core/              # B26 simulation: world, rules, intents, replay, runner, validation, factories, adapters
  render-r3f/             # B26 rendering: scene, camera, terrain, actors, bombs, items, effects, overlays
  ui-react/               # Platform UI shell — experiment dashboards, controls, inspector
  app-state/              # Zustand stores — experiment state, environment status, UI layout
  workers/                # Generalized worker orchestration for any GameEnvironment
  shared/                 # Types, math, serialization, constants
  ml-inference/           # TF.js model loading and inference runtime (Phase C)
```

**Adapter placement:**

- `game-core/adapters/` — generic state-to-view-model transforms (RenderModelAdapter, UiModelAdapter)
- `render-r3f/adapters/` — rendering-specific transforms
- `env-*/` — environment-specific adapters implementing GameEnvironment

## UI Layout

Desktop-first, stable across all game states (Setup, Playing, Paused, Inspection, Replay, Batch, Results):

- **Top bar:** run/mode controls, overlay toggles
- **Left sidebar:** navigation, tools, browsers (tabbed when dense)
- **Right sidebar:** inspector, details, validation (tabbed when dense)
- **Bottom bar:** statistics, session info, timeline
- **Center:** render canvas (priority area, >=50% width)

Camera: static forward-view semi-isometric, Bomberman 64 multiplayer-style readability. Layout should feel like a clean, minimal Unity-like application layout.

## v0 Visual Language

Primitives only:

- Terrain: cubes (yellow = breakable, neutral = wall)
- Items: billboard 2D sprites, RGB-coded
- Bombs: spheres (regular: blue→red timer shift, pumped: green→red timer shift)
- Actors: pills/pyramids, color-coded

Interpolation is visual only, relative to authoritative simulation state. Must never affect rules.

## Required Tool Choices

- **Package manager:** pnpm
- **Monorepo:** pnpm workspaces only
- **Build orchestration:** no Turborepo in v0 unless explicitly requested
- **Linting:** ESLint
- **Formatting:** Prettier
- **Testing:** Vitest for unit tests; no Cypress/Playwright unless requested
- **TypeScript:** strict mode

## Coding Style Rules

### Module Rules

- One module = one clear responsibility
- Avoid giant multi-purpose files
- Prefer explicit named exports
- Avoid barrel files unless they improve clarity

### Class vs Type Rules

Use **classes/services** for orchestration and behavior:

- SimulationRunner, ReplayController, WorkerRunManager
- MapContentLoader, ScenarioLoader, WorldFactory, SimulationRunFactory
- RenderModelAdapter, UiModelAdapter, InputController, SelectionController

Use **plain types/interfaces** for structured data:

- Snapshots, entities, config, selection, worker messages, validation issues

### Documentation Rules

- Every public class/interface must have documentation comments
- Every important invariant should be documented near enforcement code
- Every major module should begin with a short purpose comment

### Naming Rules

Use names that describe rule intent. Prefer:

- `resolveSurfaceBoundaryCollision`
- `buildRenderModelFromSnapshot`
- `reconstructReplayFrameAtTick`
- `validateScenarioDefinition`

Avoid vague names like: `handleStuff`, `processData`, `updateThing`

## Implementation Phases

### B26 Engine Phases (v0 Complete)

Phases 0–10 are complete. The B26 engine is archived at tag `v0-bomberman65-complete`.

### Platform Phases (Active)

Work phase by phase. Complete one phase, summarize, stop, ask for confirmation before continuing. Never continue automatically.

### Phase 0 — Archive & Restructure (COMPLETE)

Tag B26 v0 state. Define GameEnvironment interface in platform-core. Create env-bomberman26 adapter wrapping game-core. Verify existing tests pass.

### Phase A — N64Wasm Feasibility Spike

Embed N64Wasm in Electron/browser. Embed in headless Chromium via Puppeteer. Test: programmatic input injection, frame capture, save/load state, frame stepping. Create env-n64wasm adapter. Measure performance. Go/no-go decision.

### Phase B — Platform Architecture

AgentRuntime (human, scripted, inference modes). ExperimentSession (config, checkpoints, metrics, logs). ObservationPipeline (frame processing). Worker orchestration generalized for any GameEnvironment. Experiment dashboard UI.

### Phase C — ML Demo Slice

One game, one observation format, one simple model. TF.js inference in browser. Replay/metrics view. Browser-visible demo.

### Phase D — Training & Scaling

Python training sidecar. Multi-instance evaluation. N64Wasm vs Mupen64Plus decision. TensorKart baseline comparison.

## Per-Phase Output Format

For every phase, output in exactly this structure:

1. **Phase Goal** — brief explanation of the current phase
2. **Deliverables** — concrete checklist of files/modules/types/services to create or update
3. **Implementation** — code, file tree, or plan for this phase only
4. **Phase Summary** — completed work, assumptions made, deferred items
5. **Confirmation** — end with: "Ready to continue to Phase X?"

Never continue automatically.

## Anti-Deviation Rules

Do NOT do any of the following unless the user explicitly asks:

- Swap frameworks (React, R3F, Zustand, Vite, Electron, Vitest)
- Move environment execution to main thread
- Replace workers with direct in-app stepping
- Store authoritative environment state in Zustand
- Replace phase sequencing with ad hoc implementation
- Introduce Redux or Turborepo
- Import game-core or emulator internals directly from platform-level code (use GameEnvironment)
- Let the project become primarily a C/C++ emulator-hacking project
- Skip ahead to later phases

If a deviation seems necessary, explicitly label it as:

> **Proposed deviation:** what it changes, why it is needed, why the current design is insufficient.
> Then stop and ask for approval.

## Anti-Drift Reminder

If drift occurs, follow this reminder:

> Follow the Emulator ML Platform and Bomberman AI specs and this config file exactly. Do not redesign architecture. Implement only the current phase. End with a phase summary and ask for confirmation before continuing.
