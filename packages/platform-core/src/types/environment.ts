/**
 * GameEnvironment — unified interface for all game backends.
 *
 * Both custom engines (Bomberman 26) and emulator-backed targets (N64Wasm)
 * implement this interface so that platform UI, agent runtime, and experiment
 * sessions work identically regardless of backend.
 *
 * Design principles:
 * - Async throughout: emulator operations may involve WASM calls or WebSocket round-trips.
 * - Observation is opaque: structured state for custom engines, pixel frames for emulators.
 * - Actions are generic: B26 uses named intents, emulators use button/axis vectors.
 * - State snapshots are serializable for checkpointing and replay.
 */

/**
 * Platform-portable frame data.
 * Compatible with ImageData in browser environments, but usable in Node/workers too.
 */
export type FrameData = {
  /** Raw RGBA pixel data. */
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
};

/**
 * Result of a single environment step.
 * The platform uses this to drive agent loops, recording, and termination.
 */
export type StepResult = {
  /** The observation after the step. */
  readonly observation: Observation;
  /** Scalar reward signal (0 if the environment doesn't define rewards). */
  readonly reward: number;
  /** Whether the episode has ended (game over, timeout, etc.). */
  readonly done: boolean;
  /** Whether the episode was truncated by a time/step limit rather than a terminal state. */
  readonly truncated: boolean;
  /** Environment-specific metadata (scores, per-actor outcomes, debug info). */
  readonly info: Record<string, unknown>;
};

/**
 * Observation from the environment.
 * Environments produce one or both of structured data and visual frames.
 */
export type Observation = {
  /** Visual frame as raw pixel data. Emulators always provide this. Custom engines may optionally. */
  readonly frame?: FrameData;
  /** Structured state data. Custom engines provide this; emulators generally don't. */
  readonly state?: Record<string, unknown>;
  /** Step/tick counter at the time of this observation. */
  readonly step: number;
};

/**
 * Opaque serializable snapshot of environment state.
 * Used for checkpointing, save/load, and replay seeking.
 */
export type StateSnapshot = {
  /** Environment type identifier for deserialization routing. */
  readonly envType: string;
  /** The step/tick at which this snapshot was captured. */
  readonly step: number;
  /** Serialized environment state (format is environment-specific). */
  readonly data: ArrayBuffer | Record<string, unknown>;
};

/**
 * Describes the action space of an environment.
 * Agents use this to know what actions are valid.
 */
export type ActionSpaceDescriptor =
  | DiscreteActionSpace
  | ContinuousActionSpace
  | CompositeActionSpace;

export type DiscreteActionSpace = {
  readonly kind: 'discrete';
  /** Number of possible actions. */
  readonly n: number;
  /** Human-readable labels for each action index. */
  readonly labels?: readonly string[];
};

export type ContinuousActionSpace = {
  readonly kind: 'continuous';
  /** Shape of the continuous action vector. */
  readonly shape: readonly number[];
  /** Per-dimension lower bounds. */
  readonly low: readonly number[];
  /** Per-dimension upper bounds. */
  readonly high: readonly number[];
};

export type CompositeActionSpace = {
  readonly kind: 'composite';
  /** Named sub-spaces (e.g. 'buttons' + 'joystick' for N64). */
  readonly spaces: Record<string, ActionSpaceDescriptor>;
};

/**
 * Action input to the environment.
 * Format depends on the action space:
 * - Discrete: a single number (action index)
 * - Continuous: number array matching the shape
 * - Composite: record mapping sub-space names to their actions
 */
export type ActionInput = number | number[] | Record<string, number | number[]>;

/**
 * Static metadata about an environment instance.
 */
export type EnvironmentInfo = {
  /** Human-readable environment name (e.g. "Bomberman 26", "N64 - Bomberman 64"). */
  readonly name: string;
  /** Environment type identifier. */
  readonly envType: string;
  /** Observation frame dimensions, if visual frames are produced. */
  readonly frameDimensions?: { width: number; height: number };
  /** Whether the environment supports deterministic replay. */
  readonly deterministic: boolean;
  /** Environment-specific capabilities. */
  readonly capabilities: EnvironmentCapabilities;
};

export type EnvironmentCapabilities = {
  /** Whether saveState/loadState are supported. */
  readonly saveLoad: boolean;
  /** Whether the environment can produce visual frames. */
  readonly visualFrames: boolean;
  /** Whether the environment can produce structured state observations. */
  readonly structuredState: boolean;
  /** Whether the environment supports variable step sizes. */
  readonly variableStepSize: boolean;
  /** Whether the environment supports multiple concurrent agents. */
  readonly multiAgent: boolean;
};

/**
 * Configuration for initializing a game environment.
 * Environment-specific config is passed in the `envConfig` field.
 */
export type EnvironmentConfig = {
  /** Environment type to instantiate. */
  readonly envType: string;
  /** Environment-specific configuration (map ID, ROM path, match config, etc.). */
  readonly envConfig: Record<string, unknown>;
  /** Optional seed for deterministic behavior. */
  readonly seed?: number;
  /** Maximum steps before automatic truncation. */
  readonly maxSteps?: number;
};

/**
 * The core environment interface that all game backends implement.
 *
 * Follows the Gymnasium (OpenAI Gym successor) step/reset/observe pattern,
 * extended with save/load state for checkpointing and replay workflows.
 */
export interface GameEnvironment {
  /** Initialize the environment with the given configuration. */
  init(config: EnvironmentConfig): Promise<void>;

  /**
   * Reset the environment to an initial state.
   * Returns the initial observation.
   */
  reset(): Promise<Observation>;

  /**
   * Advance the environment by one step with the given action(s).
   * Returns the step result including observation, reward, and done flag.
   */
  step(action: ActionInput): Promise<StepResult>;

  /**
   * Capture a serializable snapshot of the current environment state.
   * Used for checkpointing, save/load workflows, and replay seeking.
   */
  saveState(): Promise<StateSnapshot>;

  /**
   * Restore environment state from a previously captured snapshot.
   */
  loadState(snapshot: StateSnapshot): Promise<void>;

  /** Get the current observation without advancing. */
  getObservation(): Observation;

  /** Get the action space descriptor. */
  getActionSpace(): ActionSpaceDescriptor;

  /** Get static environment metadata. */
  getInfo(): EnvironmentInfo;

  /** Release resources held by the environment. */
  dispose(): void;
}
