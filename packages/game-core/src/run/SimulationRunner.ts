/**
 * SimulationRunner — orchestration service that owns the lifecycle of a SimulationRun.
 *
 * Responsibilities:
 * - Starting a run
 * - Stepping ticks
 * - Pausing/resuming
 * - Single-step tick
 * - Coordinating with intent collectors
 * - Producing outputs for adapters
 *
 * SimulationRun = data, SimulationRunner = orchestration behavior.
 */

import type { SimulationRun, ActorState } from '@bomberman65/shared';
import type { IntentCollector } from '../intents/IntentCollector.js';
import { executeTick } from './TickPipeline.js';

export class SimulationRunner {
  private run: SimulationRun;
  private intentCollector: IntentCollector;

  constructor(run: SimulationRun, intentCollector: IntentCollector) {
    this.run = run;
    this.intentCollector = intentCollector;
  }

  /** Get the current run data. */
  getRun(): SimulationRun {
    return this.run;
  }

  /** Get the current world snapshot. */
  getSnapshot() {
    return this.run.snapshot;
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
   * Returns the updated snapshot.
   */
  stepTick(): void {
    if (this.run.status !== 'running' && this.run.status !== 'paused') {
      throw new Error(`Cannot step run in status '${this.run.status}'`);
    }

    const intents = this.intentCollector.collectIntents(this.run.snapshot);
    executeTick(this.run.snapshot, intents);

    // Check win/loss conditions
    this.checkTermination();
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
