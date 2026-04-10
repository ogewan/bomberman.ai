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

// Agent runtime
export {
  type Agent,
  type AgentInfo,
  type AgentKind,
  type AgentRuntimeConfig,
  type AgentRuntimeCallbacks,
  RandomAgent,
  NoOpAgent,
  ScriptedAgent,
} from './AgentRuntime.js';

// Experiment session
export {
  ExperimentSession,
  resetSessionCounter,
  type SessionId,
  type SessionStatus,
  type StepRecord,
  type SessionCheckpoint,
  type EpisodeMetrics,
  type SessionConfig,
  type SessionData,
} from './ExperimentSession.js';

// Experiment runner
export {
  ExperimentRunner,
  type ExperimentRunnerConfig,
} from './ExperimentRunner.js';

// Observation pipeline
export {
  ObservationPipeline,
  type ObservationPipelineConfig,
  type ProcessedObservation,
} from './ObservationPipeline.js';

// Worker protocol
export {
  type EnvironmentCommand,
  type EnvironmentEvent,
  nextRequestId,
  resetRequestCounter,
} from './EnvironmentWorkerProtocol.js';

// Worker bridge (host-side)
export {
  EnvironmentWorkerBridge,
  type EnvironmentFactory,
  type EnvironmentEventHandler,
} from './EnvironmentWorkerBridge.js';

// Remote environment (client-side proxy)
export {
  RemoteGameEnvironment,
  type CommandSender,
} from './RemoteGameEnvironment.js';
