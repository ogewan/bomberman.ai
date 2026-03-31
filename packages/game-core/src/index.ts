/** @module @bomberman65/game-core — Simulation world, rules, intents, replay, runner, validation, factories, and adapters. */

// World
export { buildWorldSnapshot, type WorldConstructionParams } from './world/WorldFactory.js';

// Run
export { SimulationRunner } from './run/SimulationRunner.js';
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

// Intents
export { type IntentCollector, IdleIntentCollector } from './intents/IntentCollector.js';

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
