/** @module @bomberman65/platform-core — GameEnvironment interface, agent runtime, experiment session, and observation pipeline. */

// Environment interface and types
export {
  type GameEnvironment,
  type FrameData,
  type StepResult,
  type Observation,
  type StateSnapshot,
  type ActionSpaceDescriptor,
  type DiscreteActionSpace,
  type ContinuousActionSpace,
  type CompositeActionSpace,
  type ActionInput,
  type EnvironmentInfo,
  type EnvironmentCapabilities,
  type EnvironmentConfig,
} from './types/environment.js';
