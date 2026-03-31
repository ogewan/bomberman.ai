/** @module @bomberman65/game-core — Simulation world, rules, intents, replay, runner, validation, factories, and adapters. */

// World
export { buildWorldSnapshot, type WorldConstructionParams } from './world/WorldFactory.js';
export {
  getCell,
  isInBounds,
  hasSupportBelow,
  isWalkable,
  isBlockingTerrain,
  setOccupant,
  clearOccupant,
  getNeighbor,
} from './world/gridHelpers.js';

// Run
export { SimulationRunner, type SimulationRunnerOptions } from './run/SimulationRunner.js';
export { SimulationBridge, type SimulationEventHandler } from './run/SimulationBridge.js';
export { executeTick } from './run/TickPipeline.js';

// Factories
export {
  createSimulationRun,
  type CreateRunParams,
  type CreateRunResult,
} from './factories/SimulationRunFactory.js';
export { MapContentLoader } from './factories/MapContentLoader.js';
export { ScenarioLoader } from './factories/ScenarioLoader.js';

// Rules
export { validateIntents } from './rules/intentValidation.js';
export { advanceTimers } from './rules/timerAdvancement.js';
export { applyMoveIntents, resolveSurfaceTravelPhases } from './rules/movementResolution.js';
export { resolveThrownTravel } from './rules/thrownTravelResolution.js';
export { resolveFallingAndBounds } from './rules/fallingAndBounds.js';
export { applyBombIntents } from './rules/bombActions.js';
export { transitionExpiredBombs, detonateBomb } from './rules/explosionPropagation.js';
export { applyBlastEffects, cleanup } from './rules/blastEffects.js';

// Intents
export { type IntentCollector, IdleIntentCollector } from './intents/IntentCollector.js';
export { KeyboardIntentCollector } from './intents/KeyboardIntentCollector.js';
export { BotIntentCollector } from './intents/BotIntentCollector.js';
export { CompositeIntentCollector } from './intents/CompositeIntentCollector.js';

// Validation
export { ValidationPipeline, ValidationError } from './validation/ValidationPipeline.js';
export { validateMap } from './validation/validateMap.js';
export { validateScenario } from './validation/validateScenario.js';

// Replay
export {
  ReplayRecorder,
  type ReplayLog,
  type ReplayTickEntry,
  type ReplayCheckpoint,
} from './replay/ReplayRecorder.js';
export { ReplayController } from './replay/ReplayController.js';
export { ReplayIntentCollector } from './replay/ReplayIntentCollector.js';
export { serializeReplayLog, deserializeReplayLog } from './replay/replaySerialization.js';

// Content IO
export {
  serializeMap,
  deserializeMap,
  serializeScenario,
  deserializeScenario,
} from './factories/contentIO.js';

// Adapters
export {
  buildRenderModel,
  type RenderModel,
  type TerrainInstance,
  type ActorVisual,
  type BombVisual,
  type ItemVisual,
} from './adapters/RenderModelAdapter.js';
