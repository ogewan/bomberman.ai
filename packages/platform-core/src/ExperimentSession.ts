/**
 * ExperimentSession — owns a run and its metadata.
 *
 * Tracks the lifecycle of an agent-environment interaction session:
 * configuration snapshot, step-by-step action logs, periodic state
 * checkpoints, scalar metrics, and episode boundaries.
 *
 * Sessions are the primary artifact for experiment tracking, comparison,
 * and replay. They are serializable for storage and export.
 */

import type {
  EnvironmentConfig,
  StateSnapshot,
  ActionInput,
  EnvironmentInfo,
} from './types/environment.js';
import type { AgentInfo } from './AgentRuntime.js';

// --- Session types ---

/** Unique session identifier. */
export type SessionId = string;

/** Session lifecycle status. */
export type SessionStatus = 'created' | 'running' | 'paused' | 'completed' | 'aborted';

/** A single step record in the action log. */
export type StepRecord = {
  readonly step: number;
  readonly action: ActionInput;
  readonly reward: number;
  readonly done: boolean;
  readonly truncated: boolean;
  readonly timestamp: number;
};

/** A state checkpoint captured during the session. */
export type SessionCheckpoint = {
  readonly step: number;
  readonly snapshot: StateSnapshot;
  readonly timestamp: number;
};

/** Aggregated metrics for one episode. */
export type EpisodeMetrics = {
  readonly episode: number;
  readonly totalSteps: number;
  readonly totalReward: number;
  readonly startStep: number;
  readonly endStep: number;
  readonly startTimestamp: number;
  readonly endTimestamp: number;
};

/** Session configuration snapshot — everything needed to reproduce the session. */
export type SessionConfig = {
  readonly envConfig: EnvironmentConfig;
  readonly envInfo: EnvironmentInfo;
  readonly agentInfo: AgentInfo;
  readonly seed?: number;
  readonly maxStepsPerEpisode?: number;
  readonly checkpointInterval: number;
};

/** Complete session data for export/serialization. */
export type SessionData = {
  readonly id: SessionId;
  readonly config: SessionConfig;
  readonly status: SessionStatus;
  readonly steps: StepRecord[];
  readonly checkpoints: SessionCheckpoint[];
  readonly episodes: EpisodeMetrics[];
  readonly metrics: Record<string, number[]>;
  readonly createdAt: number;
  readonly updatedAt: number;
};

// --- Session implementation ---

let sessionCounter = 0;

/** Default checkpoint interval: every 300 steps. */
const DEFAULT_CHECKPOINT_INTERVAL = 300;

export class ExperimentSession {
  readonly id: SessionId;
  readonly config: SessionConfig;

  private _status: SessionStatus = 'created';
  private steps: StepRecord[] = [];
  private checkpoints: SessionCheckpoint[] = [];
  private episodes: EpisodeMetrics[] = [];
  private metrics: Record<string, number[]> = {};
  private createdAt: number;
  private updatedAt: number;

  // Current episode tracking
  private currentEpisode = 0;
  private episodeStartStep = 0;
  private episodeReward = 0;
  private episodeStartTime = 0;

  constructor(config: SessionConfig) {
    this.id = `session_${++sessionCounter}`;
    this.config = config;
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
  }

  /** Current session status. */
  get status(): SessionStatus {
    return this._status;
  }

  /** Total steps recorded so far. */
  get totalSteps(): number {
    return this.steps.length;
  }

  /** Current episode number. */
  get episode(): number {
    return this.currentEpisode;
  }

  // --- Lifecycle ---

  /** Mark session as running. Call when the agent loop starts. */
  start(): void {
    if (this._status !== 'created' && this._status !== 'paused') {
      throw new Error(`Cannot start session in status '${this._status}'`);
    }
    this._status = 'running';
    this.updatedAt = Date.now();

    if (this.episodeStartTime === 0) {
      this.episodeStartTime = Date.now();
    }
  }

  /** Pause the session. */
  pause(): void {
    if (this._status !== 'running') {
      throw new Error(`Cannot pause session in status '${this._status}'`);
    }
    this._status = 'paused';
    this.updatedAt = Date.now();
  }

  /** Mark session as completed normally. */
  complete(): void {
    this.finalizeCurrentEpisode();
    this._status = 'completed';
    this.updatedAt = Date.now();
  }

  /** Abort the session. */
  abort(): void {
    this.finalizeCurrentEpisode();
    this._status = 'aborted';
    this.updatedAt = Date.now();
  }

  // --- Recording ---

  /** Record a single step. Called by the agent loop after each environment step. */
  recordStep(record: StepRecord): void {
    this.steps.push(record);
    this.episodeReward += record.reward;
    this.updatedAt = Date.now();
  }

  /** Record a state checkpoint. */
  recordCheckpoint(checkpoint: SessionCheckpoint): void {
    this.checkpoints.push(checkpoint);
    this.updatedAt = Date.now();
  }

  /**
   * Check if a checkpoint should be captured at this step.
   * Based on the configured checkpoint interval.
   */
  shouldCheckpoint(step: number): boolean {
    const interval = this.config.checkpointInterval || DEFAULT_CHECKPOINT_INTERVAL;
    return step > 0 && step % interval === 0;
  }

  /** Record the end of an episode. */
  recordEpisodeEnd(endStep: number): void {
    this.finalizeCurrentEpisode(endStep);
    this.currentEpisode++;
    this.episodeStartStep = endStep;
    this.episodeReward = 0;
    this.episodeStartTime = Date.now();
  }

  /**
   * Record a named scalar metric value.
   * Metrics are stored as time series (one value per recording).
   */
  recordMetric(name: string, value: number): void {
    if (!this.metrics[name]) {
      this.metrics[name] = [];
    }
    this.metrics[name].push(value);
    this.updatedAt = Date.now();
  }

  // --- Queries ---

  /** Get all step records. */
  getSteps(): readonly StepRecord[] {
    return this.steps;
  }

  /** Get all checkpoints. */
  getCheckpoints(): readonly SessionCheckpoint[] {
    return this.checkpoints;
  }

  /** Get all episode metrics. */
  getEpisodes(): readonly EpisodeMetrics[] {
    return this.episodes;
  }

  /** Get a named metric time series. */
  getMetric(name: string): readonly number[] {
    return this.metrics[name] ?? [];
  }

  /** Get all metric names. */
  getMetricNames(): string[] {
    return Object.keys(this.metrics);
  }

  /** Get the nearest checkpoint at or before the given step. */
  getCheckpointAtOrBefore(step: number): SessionCheckpoint | null {
    let best: SessionCheckpoint | null = null;
    for (const cp of this.checkpoints) {
      if (cp.step <= step && (!best || cp.step > best.step)) {
        best = cp;
      }
    }
    return best;
  }

  /** Export session data for serialization/storage. */
  toData(): SessionData {
    return {
      id: this.id,
      config: this.config,
      status: this._status,
      steps: [...this.steps],
      checkpoints: [...this.checkpoints],
      episodes: [...this.episodes],
      metrics: Object.fromEntries(
        Object.entries(this.metrics).map(([k, v]) => [k, [...v]]),
      ),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // --- Private ---

  private finalizeCurrentEpisode(endStep?: number): void {
    const end = endStep ?? this.steps.length;
    if (end > this.episodeStartStep) {
      this.episodes.push({
        episode: this.currentEpisode,
        totalSteps: end - this.episodeStartStep,
        totalReward: this.episodeReward,
        startStep: this.episodeStartStep,
        endStep: end,
        startTimestamp: this.episodeStartTime,
        endTimestamp: Date.now(),
      });
    }
  }
}

/** Reset the session counter (for testing). */
export function resetSessionCounter(): void {
  sessionCounter = 0;
}
