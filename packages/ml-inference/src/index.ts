/** @module @bomberman65/ml-inference — TF.js model loading and inference runtime. */

export {
  InferenceAgent,
  type InferenceAgentConfig,
  type OutputMode,
  type ActionSelectionMode,
} from './InferenceAgent.js';

export {
  type BuiltinModelId,
  type StateProjectionConfig,
  type ModelManifest,
} from './modelManifest.js';
