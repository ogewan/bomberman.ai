/**
 * AgentRuntime — unified interface for different control sources.
 *
 * An AgentRuntime produces actions for a GameEnvironment at each step.
 * The platform runs the agent loop: observe → decide → act → record.
 *
 * Modes:
 * - HumanAgent: actions come from user input (keyboard, gamepad)
 * - ScriptedAgent: actions follow a predefined script or heuristic
 * - InferenceAgent: actions come from a TF.js model
 * - RemoteAgent: actions come from an external process (Python training sidecar)
 */

import type { Observation, ActionInput, ActionSpaceDescriptor } from './types/environment.js';

/** Agent metadata for tracking and display. */
export type AgentInfo = {
  readonly id: string;
  readonly name: string;
  readonly kind: AgentKind;
};

export type AgentKind = 'human' | 'scripted' | 'inference' | 'remote';

/**
 * Core agent interface. All control sources implement this.
 */
export interface Agent {
  /** Agent metadata. */
  readonly info: AgentInfo;

  /**
   * Initialize the agent with the environment's action space.
   * Called once before the first step.
   */
  init(actionSpace: ActionSpaceDescriptor): Promise<void>;

  /**
   * Select an action given the current observation.
   * Must return an action compatible with the environment's action space.
   */
  selectAction(observation: Observation, step: number): Promise<ActionInput>;

  /**
   * Notify the agent of a step result (for learning or logging).
   * Called after the environment processes the action.
   */
  onStepResult?(reward: number, done: boolean, info: Record<string, unknown>): void;

  /**
   * Called when an episode ends (environment reset or done=true).
   */
  onEpisodeEnd?(): void;

  /** Release resources. */
  dispose?(): void;
}

/**
 * AgentRuntime orchestrates the agent-environment interaction loop.
 *
 * It connects an Agent to a GameEnvironment and manages the step loop,
 * including observation passing, action selection, and callback dispatch.
 */
export type AgentRuntimeConfig = {
  /** Maximum steps per episode before truncation. */
  readonly maxStepsPerEpisode?: number;
  /** Number of episodes to run. 0 = infinite until stopped. */
  readonly episodes?: number;
  /** Delay between steps in ms (for human-visible playback). 0 = as fast as possible. */
  readonly stepDelayMs?: number;
  /** Whether to auto-reset the environment on episode end. Default: true. */
  readonly autoReset?: boolean;
};

/**
 * Callbacks for monitoring the agent loop from outside (UI, metrics, etc.).
 */
export interface AgentRuntimeCallbacks {
  /** Called after each step with the latest observation and step info. */
  onStep?(step: number, observation: Observation, reward: number, done: boolean): void;
  /** Called when an episode starts. */
  onEpisodeStart?(episode: number): void;
  /** Called when an episode ends. */
  onEpisodeEnd?(episode: number, totalSteps: number, totalReward: number): void;
  /** Called when the entire run completes. */
  onRunComplete?(totalEpisodes: number): void;
  /** Called on error. */
  onError?(error: Error): void;
}

// --- Built-in agent implementations ---

/**
 * RandomAgent — selects uniformly random actions. Useful for baseline testing.
 */
export class RandomAgent implements Agent {
  readonly info: AgentInfo;
  private actionSpace: ActionSpaceDescriptor | null = null;

  constructor(id = 'random', name = 'Random Agent') {
    this.info = { id, name, kind: 'scripted' };
  }

  async init(actionSpace: ActionSpaceDescriptor): Promise<void> {
    this.actionSpace = actionSpace;
  }

  async selectAction(): Promise<ActionInput> {
    if (!this.actionSpace) throw new Error('Agent not initialized');
    return this.randomAction(this.actionSpace);
  }

  private randomAction(space: ActionSpaceDescriptor): ActionInput {
    switch (space.kind) {
      case 'discrete':
        return Math.floor(Math.random() * space.n);
      case 'continuous':
        return space.low.map((lo, i) => lo + Math.random() * (space.high[i]! - lo));
      case 'composite': {
        const result: Record<string, number | number[]> = {};
        for (const [key, subSpace] of Object.entries(space.spaces)) {
          result[key] = this.randomAction(subSpace) as number | number[];
        }
        return result;
      }
    }
  }
}

/**
 * NoOpAgent — always returns action 0 (typically idle/no-op). Useful for testing.
 */
export class NoOpAgent implements Agent {
  readonly info: AgentInfo;

  constructor(id = 'noop', name = 'No-Op Agent') {
    this.info = { id, name, kind: 'scripted' };
  }

  async init(): Promise<void> {
    // No setup needed
  }

  async selectAction(): Promise<ActionInput> {
    return 0;
  }
}

/**
 * ScriptedAgent — replays a predefined sequence of actions.
 * Wraps around if the sequence is shorter than the episode.
 */
export class ScriptedAgent implements Agent {
  readonly info: AgentInfo;
  private actions: ActionInput[];
  private index = 0;

  constructor(actions: ActionInput[], id = 'scripted', name = 'Scripted Agent') {
    this.info = { id, name, kind: 'scripted' };
    this.actions = actions;
  }

  async init(): Promise<void> {
    this.index = 0;
  }

  async selectAction(): Promise<ActionInput> {
    const action = this.actions[this.index % this.actions.length]!;
    this.index++;
    return action;
  }

  onEpisodeEnd(): void {
    this.index = 0;
  }
}
