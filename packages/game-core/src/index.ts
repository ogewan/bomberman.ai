/** @module @bomberman65/game-core — Simulation world, rules, intents, replay, runner, validation, factories, and adapters. */

// World
export { buildWorldSnapshot, type WorldConstructionParams } from './world/WorldFactory.js';

// Run
export { createSimulationRun } from './run/SimulationRunFactory.js';
export { SimulationRunner } from './run/SimulationRunner.js';
export { SimulationBridge, type SimulationEventHandler } from './run/SimulationBridge.js';
export { executeTick } from './run/TickPipeline.js';

// Intents
export { type IntentCollector, IdleIntentCollector } from './intents/IntentCollector.js';

// Replay
export {
  ReplayRecorder,
  type ReplayLog,
  type ReplayTickEntry,
  type ReplayCheckpoint,
} from './replay/ReplayRecorder.js';
