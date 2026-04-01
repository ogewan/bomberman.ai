/** @module @bomberman65/shared — Shared types, math utilities, serialization, and constants. */

// Direction model
export {
  type Direction2D,
  type CardinalDirection,
  CARDINAL_DIRECTIONS,
  ALL_DIRECTIONS,
  DIRECTION_TO_VECTOR,
  OPPOSITE_DIRECTION,
} from './types/direction.js';

// Primitive types
export {
  type Vec3i,
  type EntityRef,
  type TerrainType,
  type ItemType,
  type Upgrade,
  type BombType,
} from './types/primitives.js';

// World / cell schemas
export { type Cell, type RampData, type WorldSnapshot } from './types/world.js';

// Actor state
export { type ActorState, type ActorMotionState } from './types/actor.js';

// Bomb state
export { type BombState, type BombMotionState } from './types/bomb.js';

// Config / run / result
export {
  type RunMode,
  type RunStatus,
  type MatchConfig,
  type MatchRuleOverrides,
  type MatchResult,
  type ActorOutcome,
} from './types/config.js';

export { type SimulationRun, type ReplaySessionState } from './types/run.js';

// Map and scenario definitions
export {
  type RampDefinition,
  type ItemPlacement,
  type MapCell,
  type SpawnPoint,
  type MapDefinition,
  type ScenarioActor,
  type ScenarioBomb,
  type ScenarioDefinition,
} from './types/map.js';

// Validation
export {
  type ValidationSeverity,
  type ValidationIssue,
  type ValidationResult,
  type ValidationMode,
} from './types/validation.js';

// Selection
export { type Selection } from './types/selection.js';

// Intents
export { type ActorIntent } from './types/intents.js';

// Worker messages
export {
  type WorkerCommand,
  type SpawnAssignment,
  type WorkerEvent,
} from './types/worker-messages.js';

// Math utilities
export { vec3i, vec3iEqual, vec3iAdd, vec3iInBounds } from './math/vec3i.js';
export { SeededRng } from './math/seededRng.js';
export { deepClone } from './math/deepClone.js';

// Constants
export {
  DEFAULT_MATCH_CONFIG,
  MAX_HEIGHT_LEVELS,
  BOUNCE_CHAIN_EXTRA,
} from './constants/defaults.js';

// Keybinds
export { type KeybindConfig, DEFAULT_KEYBINDS } from './types/keybinds.js';
