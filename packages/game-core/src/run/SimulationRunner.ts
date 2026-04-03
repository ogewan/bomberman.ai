/**
 * SimulationRunner — orchestration service that owns the lifecycle of a SimulationRun.
 *
 * Responsibilities:
 * - Starting a run
 * - Stepping ticks
 * - Pausing/resuming
 * - Single-step tick
 * - Coordinating with intent collectors
 * - Recording replay data (optional)
 * - Producing outputs for adapters
 *
 * SimulationRun = data, SimulationRunner = orchestration behavior.
 */

import type { SimulationRun, ActorState, ActorIntent, WorldSnapshot } from '@bomberman65/shared';
import { deepClone } from '@bomberman65/shared';
import type { IntentCollector } from '../intents/IntentCollector.js';
import { executeTick } from './TickPipeline.js';
import { ReplayRecorder } from '../replay/ReplayRecorder.js';

export type SimulationRunnerOptions = {
  /** Enable replay recording. Default: true if config.allowReplayRecording is not false. */
  recordReplay?: boolean;
  /** Interval in ticks between checkpoint snapshots. Default: 300. */
  checkpointInterval?: number;
};

/** Maximum number of snapshots kept in history for instant step-back. */
const MAX_HISTORY = 300;

export class SimulationRunner {
  private run: SimulationRun;
  private intentCollector: IntentCollector;
  private recorder: ReplayRecorder | null = null;
  private history: WorldSnapshot[] = [];

  constructor(
    run: SimulationRun,
    intentCollector: IntentCollector,
    options?: SimulationRunnerOptions,
  ) {
    this.run = run;
    this.intentCollector = intentCollector;

    const shouldRecord = options?.recordReplay ?? run.config.allowReplayRecording !== false;
    if (shouldRecord) {
      this.recorder = new ReplayRecorder({
        replayId: `replay_${run.runId}`,
        mapId: run.config.mapId,
        config: run.config,
        initialSnapshot: deepClone(run.snapshot),
        checkpointInterval: options?.checkpointInterval,
      });
    }
  }

  /** Get the current run data. */
  getRun(): SimulationRun {
    return this.run;
  }

  /** Get the current world snapshot. */
  getSnapshot() {
    return this.run.snapshot;
  }

  /** Get the replay recorder, if recording is enabled. */
  getRecorder(): ReplayRecorder | null {
    return this.recorder;
  }

  /** Start the simulation. Transitions from idle to running. */
  start(): void {
    if (this.run.status !== 'idle') {
      throw new Error(`Cannot start run in status '${this.run.status}'`);
    }
    this.run.status = 'running';
  }

  /** Pause a running simulation. */
  pause(): void {
    if (this.run.status !== 'running') {
      throw new Error(`Cannot pause run in status '${this.run.status}'`);
    }
    this.run.status = 'paused';
  }

  /** Resume a paused simulation. */
  resume(): void {
    if (this.run.status !== 'paused') {
      throw new Error(`Cannot resume run in status '${this.run.status}'`);
    }
    this.run.status = 'running';
  }

  /** Stop/abort the simulation. */
  stop(): void {
    this.run.status = 'aborted';
  }

  /**
   * Execute a single tick.
   * Collects intents via the intent collector, then runs the tick pipeline.
   */
  stepTick(): void {
    if (this.run.status !== 'running' && this.run.status !== 'paused') {
      throw new Error(`Cannot step run in status '${this.run.status}'`);
    }

    const intents = this.intentCollector.collectIntents(this.run.snapshot);
    this.executeAndRecord(intents);
  }

  /**
   * Execute a single tick with externally provided intents.
   * Used by SimulationBridge when intents come from the worker message.
   */
  stepTickWithIntents(intents: ActorIntent[]): void {
    if (this.run.status !== 'running' && this.run.status !== 'paused') {
      throw new Error(`Cannot step run in status '${this.run.status}'`);
    }
    this.executeAndRecord(intents);
  }

  /**
   * Execute N ticks in sequence.
   * Useful for fast-forwarding or batch processing.
   */
  stepTicks(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.run.status === 'finished' || this.run.status === 'aborted') break;
      this.stepTick();
    }
  }

  /** Replace the intent collector (e.g. switching from player input to replay playback). */
  setIntentCollector(collector: IntentCollector): void {
    this.intentCollector = collector;
  }

  /**
   * Step back by restoring a previous snapshot.
   * Uses the history array for recent ticks (≤300), falls back to
   * recorder-based checkpoint + replay for deeper seeking.
   * Returns true if step-back succeeded.
   */
  stepBack(count: number = 1): boolean {
    if (this.run.status !== 'paused') return false;

    const currentTick = this.run.snapshot.tick;
    const targetTick = Math.max(0, currentTick - count);

    // If within history range, use instant restore
    if (count <= this.history.length) {
      const targetIdx = this.history.length - count;
      const restored = this.history[targetIdx];
      if (!restored) return false;

      // Trim history to the restore point
      this.history.length = targetIdx;
      this.run.snapshot = deepClone(restored);
      return true;
    }

    // Beyond history — fall back to recorder if available
    if (!this.recorder) return false;
    const log = this.recorder.getLog();

    // Find the nearest checkpoint at or before targetTick
    let baseSnapshot = log.initialSnapshot;
    let baseTick = 0;

    for (const cp of log.checkpoints) {
      if (cp.tick <= targetTick && cp.tick > baseTick) {
        baseSnapshot = cp.snapshot;
        baseTick = cp.tick;
      }
    }

    // Restore from checkpoint and replay intents forward to targetTick
    this.run.snapshot = deepClone(baseSnapshot);

    for (const entry of log.entries) {
      if (entry.tick < baseTick) continue;
      if (entry.tick >= targetTick) break;
      executeTick(this.run.snapshot, [...entry.intents], this.run.config);
    }

    // Rebuild history from the restored point (empty — we've jumped)
    this.history.length = 0;
    return true;
  }

  private executeAndRecord(intents: ActorIntent[]): void {
    // Save snapshot for step-back before execution
    this.history.push(deepClone(this.run.snapshot));
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }

    const tick = this.run.snapshot.tick;

    // Record intents before execution
    if (this.recorder) {
      // Capture checkpoint snapshot at interval boundaries (before tick executes)
      const needsCheckpoint =
        tick > 0 && this.recorder.getLog().checkpoints.length === 0
          ? true
          : tick % (this.recorder['checkpointInterval'] ?? 300) === 0;
      const checkpoint = needsCheckpoint ? deepClone(this.run.snapshot) : undefined;
      this.recorder.recordTick(tick, intents, checkpoint);
    }

    executeTick(this.run.snapshot, intents, this.run.config);
    this.checkTermination();
  }

  private checkTermination(): void {
    const { snapshot, config } = this.run;

    // Check max tick limit
    if (config.maxTicks !== undefined && snapshot.tick >= config.maxTicks) {
      this.run.status = 'finished';
      this.run.result = {
        reason: 'timeout',
        totalTicks: snapshot.tick,
        actorOutcomes: this.buildActorOutcomes(),
      };
      this.recorder?.recordResult(this.run.result);
      return;
    }

    // Check if only one actor remains alive
    const actors = Object.values(snapshot.actors) as ActorState[];
    const aliveActors = actors.filter((a) => a.state.kind !== 'eliminated');

    if (aliveActors.length <= 1) {
      this.run.status = 'finished';
      this.run.result = {
        winnerId: aliveActors[0]?.id,
        reason: 'elimination',
        totalTicks: snapshot.tick,
        actorOutcomes: this.buildActorOutcomes(),
      };
      this.recorder?.recordResult(this.run.result);
    }
  }

  private buildActorOutcomes(): Record<string, { alive: boolean }> {
    const outcomes: Record<string, { alive: boolean }> = {};
    for (const actor of Object.values(this.run.snapshot.actors) as ActorState[]) {
      outcomes[actor.id] = {
        alive: actor.state.kind !== 'eliminated',
      };
    }
    return outcomes;
  }
}
