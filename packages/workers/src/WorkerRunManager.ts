/**
 * WorkerRunManager — main-thread service that manages simulation worker lifecycle.
 *
 * Responsibilities:
 * - Spawn and manage the simulation worker
 * - Send commands to the worker
 * - Receive and dispatch events from the worker
 * - Provide the latest snapshot to consumers (adapters, UI)
 *
 * This is the main-thread counterpart to SimulationBridge in the worker.
 */

import type {
  WorkerCommand,
  WorkerEvent,
  WorldSnapshot,
  SimulationRun,
  MapDefinition,
  MatchConfig,
  SpawnAssignment,
  ScenarioDefinition,
  ActorIntent,
} from '@bomberman65/shared';

/** Callback for receiving worker events on the main thread. */
export type WorkerEventListener = (event: WorkerEvent) => void;

export class WorkerRunManager {
  private worker: Worker | null = null;
  private listeners: Set<WorkerEventListener> = new Set();
  private latestSnapshot: WorldSnapshot | null = null;
  private latestRun: SimulationRun | null = null;
  private workerFactory: () => Worker;

  /**
   * @param workerFactory A factory that creates the simulation worker.
   *   Example: () => new Worker(new URL('./simulation-worker.ts', import.meta.url), { type: 'module' })
   */
  constructor(workerFactory: () => Worker) {
    this.workerFactory = workerFactory;
  }

  /** Add a listener for worker events. */
  addEventListener(listener: WorkerEventListener): void {
    this.listeners.add(listener);
  }

  /** Remove a listener. */
  removeEventListener(listener: WorkerEventListener): void {
    this.listeners.delete(listener);
  }

  /** Get the latest snapshot received from the worker. */
  getLatestSnapshot(): WorldSnapshot | null {
    return this.latestSnapshot;
  }

  /** Get the latest run data. */
  getLatestRun(): SimulationRun | null {
    return this.latestRun;
  }

  /** Start a new simulation run in the worker. */
  startRun(params: {
    map: MapDefinition;
    config: MatchConfig;
    spawnAssignments: SpawnAssignment[];
    scenario?: ScenarioDefinition;
  }): void {
    this.ensureWorker();
    this.sendCommand({
      kind: 'start',
      map: params.map,
      config: params.config,
      spawnAssignments: params.spawnAssignments,
      scenario: params.scenario,
    });
  }

  /** Send a step command with intents. */
  step(intents: ActorIntent[]): void {
    this.sendCommand({ kind: 'step', intents });
  }

  /** Pause the simulation. */
  pause(): void {
    this.sendCommand({ kind: 'pause' });
  }

  /** Resume the simulation. */
  resume(): void {
    this.sendCommand({ kind: 'resume' });
  }

  /** Stop/abort the simulation. */
  stop(): void {
    this.sendCommand({ kind: 'stop' });
  }

  /** Seek to a specific tick (replay mode). */
  seek(targetTick: number): void {
    this.sendCommand({ kind: 'seek', targetTick });
  }

  /** Set playback speed. */
  setSpeed(speed: number): void {
    this.sendCommand({ kind: 'setSpeed', speed });
  }

  /** Terminate the worker entirely. */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private ensureWorker(): void {
    if (this.worker) return;

    this.worker = this.workerFactory();
    this.worker.onmessage = (e: MessageEvent<WorkerEvent>) => {
      this.handleEvent(e.data);
    };
    this.worker.onerror = (e) => {
      this.dispatchEvent({ kind: 'error', message: e.message });
    };
  }

  private sendCommand(command: WorkerCommand): void {
    if (!this.worker) {
      this.dispatchEvent({ kind: 'error', message: 'Worker not initialized' });
      return;
    }
    this.worker.postMessage(command);
  }

  private handleEvent(event: WorkerEvent): void {
    switch (event.kind) {
      case 'started':
        this.latestRun = event.run;
        this.latestSnapshot = event.run.snapshot;
        break;
      case 'tick':
        this.latestSnapshot = event.snapshot;
        break;
      case 'finished':
        this.latestRun = event.run;
        this.latestSnapshot = event.run.snapshot;
        break;
    }
    this.dispatchEvent(event);
  }

  private dispatchEvent(event: WorkerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
