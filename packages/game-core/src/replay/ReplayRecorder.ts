/**
 * ReplayRecorder — records intent logs and periodic checkpoints during a simulation run.
 *
 * Replay format supports:
 * - Initial state snapshot
 * - Per-tick intent log
 * - Periodic checkpoints for fast seeking
 * - Result summary
 *
 * Full implementation in Phase 6. This is the scaffolding with types and interface.
 */

import type { ActorIntent, MatchConfig, MatchResult, WorldSnapshot } from '@bomberman65/shared';

/** A single entry in the replay intent log. */
export type ReplayTickEntry = {
  readonly tick: number;
  readonly intents: readonly ActorIntent[];
};

/** A checkpoint snapshot for fast seeking during replay. */
export type ReplayCheckpoint = {
  readonly tick: number;
  readonly snapshot: WorldSnapshot;
};

/** Complete replay log for a finished or in-progress run. */
export type ReplayLog = {
  readonly replayId: string;
  readonly mapId: string;
  readonly config: MatchConfig;
  readonly initialSnapshot: WorldSnapshot;
  readonly entries: ReplayTickEntry[];
  readonly checkpoints: ReplayCheckpoint[];
  result?: MatchResult;
};

/** Records simulation events into a ReplayLog. */
export class ReplayRecorder {
  private log: ReplayLog;
  private checkpointInterval: number;

  constructor(params: {
    replayId: string;
    mapId: string;
    config: MatchConfig;
    initialSnapshot: WorldSnapshot;
    checkpointInterval?: number;
  }) {
    this.checkpointInterval = params.checkpointInterval ?? 300;
    this.log = {
      replayId: params.replayId,
      mapId: params.mapId,
      config: params.config,
      initialSnapshot: params.initialSnapshot,
      entries: [],
      checkpoints: [],
    };
  }

  /** Record intents for a tick. Optionally captures a checkpoint. */
  recordTick(tick: number, intents: readonly ActorIntent[], snapshot?: WorldSnapshot): void {
    this.log.entries.push({ tick, intents });

    if (snapshot && tick > 0 && tick % this.checkpointInterval === 0) {
      this.log.checkpoints.push({ tick, snapshot });
    }
  }

  /** Record the final match result. */
  recordResult(result: MatchResult): void {
    this.log.result = result;
  }

  /** Get the current replay log. */
  getLog(): ReplayLog {
    return this.log;
  }
}
