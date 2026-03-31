import type { MatchConfig, MatchResult, RunStatus } from './config.js';
import type { WorldSnapshot } from './world.js';

/** Replay session state for reconstructing historical playback. */
export type ReplaySessionState = {
  readonly replayId: string;
  readonly currentTick: number;
  readonly totalTicks: number;
};

/**
 * Data structure representing one active or replayed match instance.
 * SimulationRun is data only — SimulationRunner owns orchestration behavior.
 */
export type SimulationRun = {
  readonly runId: string;
  readonly seed: number;
  status: RunStatus;
  readonly config: MatchConfig;
  snapshot: WorldSnapshot;
  replay?: ReplaySessionState;
  result?: MatchResult;
};
