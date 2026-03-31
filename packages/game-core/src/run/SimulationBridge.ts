/**
 * SimulationBridge — worker-compatible boundary for the simulation.
 *
 * This provides a command-based interface that can be driven by:
 * - A Web Worker message handler
 * - Direct in-process calls for testing
 * - An Electron worker thread
 *
 * It translates WorkerCommands into SimulationRunner operations
 * and emits WorkerEvents back to the caller.
 */

import type { WorkerCommand, WorkerEvent } from '@bomberman65/shared';
import { SimulationRunner } from './SimulationRunner.js';
import { createSimulationRun } from '../factories/SimulationRunFactory.js';
import { IdleIntentCollector } from '../intents/IntentCollector.js';

/** Callback type for emitting events from the simulation to the host. */
export type SimulationEventHandler = (event: WorkerEvent) => void;

export class SimulationBridge {
  private runner: SimulationRunner | null = null;
  private onEvent: SimulationEventHandler;

  constructor(onEvent: SimulationEventHandler) {
    this.onEvent = onEvent;
  }

  /** Handle a command from the host (main thread or test harness). */
  handleCommand(command: WorkerCommand): void {
    switch (command.kind) {
      case 'start':
        this.handleStart(command);
        break;
      case 'step':
        this.handleStep(command);
        break;
      case 'pause':
        this.handlePause();
        break;
      case 'resume':
        this.handleResume();
        break;
      case 'stop':
        this.handleStop();
        break;
      case 'seek':
        this.handleSeek(command);
        break;
      case 'setSpeed':
        // Speed control is a presentation concern handled by the worker host.
        break;
    }
  }

  /** Get the current runner, if any. */
  getRunner(): SimulationRunner | null {
    return this.runner;
  }

  private handleStart(command: Extract<WorkerCommand, { kind: 'start' }>) {
    try {
      const { run } = createSimulationRun({
        map: command.map,
        config: command.config,
        spawnAssignments: command.spawnAssignments,
        scenario: command.scenario,
      });

      this.runner = new SimulationRunner(run, new IdleIntentCollector());
      this.runner.start();

      this.onEvent({ kind: 'started', run: this.runner.getRun() });
    } catch (e) {
      this.onEvent({ kind: 'error', message: String(e) });
    }
  }

  private handleStep(command: Extract<WorkerCommand, { kind: 'step' }>) {
    if (!this.runner) {
      this.onEvent({ kind: 'error', message: 'No active run' });
      return;
    }

    try {
      // Use provided intents via a one-shot collector
      const intents = command.intents;
      this.runner.setIntentCollector({
        collectIntents: () => intents,
      });

      this.runner.stepTick();

      const run = this.runner.getRun();
      if (run.status === 'finished') {
        this.onEvent({ kind: 'finished', run });
      } else {
        this.onEvent({ kind: 'tick', snapshot: run.snapshot });
      }
    } catch (e) {
      this.onEvent({ kind: 'error', message: String(e) });
    }
  }

  private handlePause() {
    if (!this.runner) {
      this.onEvent({ kind: 'error', message: 'No active run' });
      return;
    }
    try {
      this.runner.pause();
      this.onEvent({ kind: 'paused', tick: this.runner.getSnapshot().tick });
    } catch (e) {
      this.onEvent({ kind: 'error', message: String(e) });
    }
  }

  private handleResume() {
    if (!this.runner) {
      this.onEvent({ kind: 'error', message: 'No active run' });
      return;
    }
    try {
      this.runner.resume();
      this.onEvent({ kind: 'resumed', tick: this.runner.getSnapshot().tick });
    } catch (e) {
      this.onEvent({ kind: 'error', message: String(e) });
    }
  }

  private handleStop() {
    if (!this.runner) return;
    this.runner.stop();
    this.onEvent({ kind: 'finished', run: this.runner.getRun() });
    this.runner = null;
  }

  private handleSeek(_command: Extract<WorkerCommand, { kind: 'seek' }>) {
    // Replay seeking requires checkpoint reconstruction — implemented in Phase 6.
    this.onEvent({ kind: 'error', message: 'Seek not yet implemented' });
  }
}
