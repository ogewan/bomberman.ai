# Bomberman 65

## Project Overview

Bomberman 64-inspired 3D bomberman game. Open-source portfolio project targeting **web** and **desktop (Electron)**. Uses a deterministic, tick-authoritative discrete simulation with surface-based 3D elevation (not free-volumetric). AI opponents will use TensorFlow/neural nets (not LLMs).

## Source of Truth

The canonical specs live on Notion. **For game/design rules, follow the Notion specs. For implementation strictness, coding style, and workflow rules, follow this config file.**

- [Project Hub](https://www.notion.so/Bomberman-65-b762fa5d21354f6db23decb1ba69a287)
- [Architecture Spec v0](https://www.notion.so/333d1838c6158113bfa5c46840cae29e)
- [Renderer & UI Architecture Spec v0](https://www.notion.so/334d1838c615816e9cd4ef212ac80b1e)
- [Map & Content Schema v0](https://www.notion.so/334d1838c6158185b03bc50a42cc88ec)
- [UI States & Screen Flow Spec v0](https://www.notion.so/334d1838c6158148a2adcf6c85a69065)
- [Implementation Master Prompt v0](https://www.notion.so/334d1838c6158159874dcfa167b9f3f6)

If any future implementation detail conflicts with the Notion specs, prefer the specs unless the user explicitly approves a change.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Monorepo:** pnpm workspaces
- **Rendering:** React Three Fiber (R3F) with Three.js
- **UI:** React (separate root from R3F)
- **State management:** Zustand (UI/session state ONLY — never authoritative simulation state)
- **Desktop:** Electron
- **ML (future):** TensorFlow.js
- **Build:** Vite
- **Testing:** Vitest
- **Linting:** ESLint
- **Formatting:** Prettier

## Shell Preference

- Use `bash` for command execution by default.
- Fall back to PowerShell only if `bash` is unavailable, blocked by the environment, or clearly incompatible with the task.

## Architecture — Non-Negotiable Rules

1. **Simulation logic must NEVER live in React components or renderer code.** The simulation core must run independently in tests, Web Workers, Electron workers, and future CLI/server environments. No simulation logic may depend on browser-only DOM APIs.
2. **Renderer must NEVER mutate authoritative world state.** Presentation consumes derived read models / immutable view-model snapshots.
3. **3D renderer and GUI have separate React roots.** One React root for GUI/app shell, one R3F root for 3D rendering.
4. **All simulation runs in workers.** The active visible run also runs in a worker. Main thread is presentation-only: React UI, R3F rendering, input capture, selection presentation, worker orchestration.
5. **One worker implementation path for v0.** Active simulation, headless simulation, and replay all use the same worker path. Do not create a specialized replay worker in v0.
6. **Zustand is UI/session state only.** Allowed: layout state, selection state, session/app state, overlay toggles, worker status summaries, viewed replay tick, playback UI state. Do NOT store authoritative WorldSnapshot in Zustand.
7. **Upgrades are exclusive:** kick, carry/pump, or shield — never multiple.

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
  web/                    # Vite + React entry
  desktop/                # Electron shell

packages/
  game-core/              # world, rules, intents, replay, runner, validation, factories, adapters
  render-r3f/             # scene, camera, terrain, actors, bombs, items, effects, overlays, adapters
  ui-react/               # app-shell, layout, sidebars, controls, inspector, replay, validation, states
  app-state/              # stores, selection, layout, session, worker-status
  workers/                # simulation-worker, messages, runner
  shared/                 # types, math, serialization, constants
```

**Adapter placement:**

- `game-core/adapters/` — generic state-to-view-model transforms (RenderModelAdapter, UiModelAdapter)
- `render-r3f/adapters/` — rendering-specific transforms

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

Work phase by phase. Complete one phase, summarize, stop, ask for confirmation before continuing. Never continue automatically.

### Phase 0 — Repo and workspace setup

Root workspace config, pnpm workspace, tsconfig strategy, package scaffolding, lint/format/test configs, README skeleton.

### Phase 1 — Core shared types and domain model

Direction type + vector lookup, shared types, world/cell/entity schemas, actor/bomb state types, run/config/result types, validation issue types, selection types, serialization-safe types.

### Phase 2 — Simulation core skeleton

SimulationRun, SimulationRunner, tick loop skeleton, no-op runner stepping, intent interfaces, worker-compatible simulation boundary, replay/session scaffolding.

### Phase 3 — Map/scenario loading and validation

MapContentLoader, ScenarioLoader, WorldFactory, SimulationRunFactory, validation pipeline, hard-fail/override paths, structured validation output.

### Phase 4 — Movement and occupancy rules

Surface travel, leaving/entering phase resolution, support checks, falling, out-of-bounds, occupancy updates, throw travel skeleton, bounce cap.

### Phase 5 — Bomb, explosion, and collision rules

Bomb placement, kick/carry/pump, fuse ticking, regular + pumped propagation, breakable destruction, stun/elimination, shield, thrown collision, same-step bounce/momentum chaining.

### Phase 6 — Replay and worker orchestration

Worker message contract, one worker path for active/headless/replay, intent log + checkpoints, replay controller, worker run manager, import/export basics.

### Phase 7 — Render model adapters and R3F scene

Render model adapter, primitive terrain, actor/bomb/item rendering, fixed semi-isometric camera, interpolation, debug overlay support.

### Phase 8 — GUI shell and application state flow

Separate GUI root, Zustand stores (UI/session only), layout panels, contextual sidebar tabs, game states, bidirectional selection sync.

### Phase 9 — Import/export flows and usability pass

Map/scenario/session/replay import/export, model import/export hooks, validation surfacing in GUI/logs, usability polish.

### Phase 10 — Testing, docs, portfolio readiness

Targeted unit tests, determinism checks, replay reconstruction checks, architecture docs, usage docs, portfolio-ready explanation of design choices.

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
- Move simulation to main thread
- Replace workers with direct in-app stepping
- Collapse GUI and renderer into one root
- Store authoritative simulation state in Zustand
- Replace phase sequencing with ad hoc implementation
- Introduce Redux or Turborepo
- Redesign game rules or invent new gameplay mechanics
- Change repo layout substantially
- Skip ahead to later phases

If a deviation seems necessary, explicitly label it as:

> **Proposed deviation:** what it changes, why it is needed, why the current design is insufficient.
> Then stop and ask for approval.

## Anti-Drift Reminder

If drift occurs, follow this reminder:

> Follow the Bomberman AI specs and this config file exactly. Do not redesign architecture. Implement only the current phase. End with a phase summary and ask for confirmation before continuing.
