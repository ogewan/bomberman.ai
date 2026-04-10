/**
 * EnvironmentWorkerBridge — worker-side handler that translates protocol
 * commands into GameEnvironment method calls.
 *
 * This is the generalized equivalent of SimulationBridge. It runs inside
 * a worker (or any host context) and drives a GameEnvironment instance
 * based on incoming commands, emitting events back to the client.
 *
 * Usage in a Web Worker:
 * ```ts
 * const bridge = new EnvironmentWorkerBridge(
 *   (event) => self.postMessage(event),
 *   (config) => createEnvironmentForType(config.envType),
 * );
 * self.onmessage = (e) => bridge.handleCommand(e.data);
 * ```
 */

import type { GameEnvironment, EnvironmentConfig } from './types/environment.js';
import type { EnvironmentCommand, EnvironmentEvent } from './EnvironmentWorkerProtocol.js';

/** Factory function that creates a GameEnvironment given a config. */
export type EnvironmentFactory = (config: EnvironmentConfig) => GameEnvironment;

/** Callback type for emitting events from the bridge to the host. */
export type EnvironmentEventHandler = (event: EnvironmentEvent) => void;

export class EnvironmentWorkerBridge {
  private env: GameEnvironment | null = null;
  private onEvent: EnvironmentEventHandler;
  private envFactory: EnvironmentFactory;

  constructor(onEvent: EnvironmentEventHandler, envFactory: EnvironmentFactory) {
    this.onEvent = onEvent;
    this.envFactory = envFactory;
  }

  /** Handle a command from the client. */
  async handleCommand(command: EnvironmentCommand): Promise<void> {
    try {
      switch (command.kind) {
        case 'init':
          await this.handleInit(command);
          break;
        case 'reset':
          await this.handleReset(command);
          break;
        case 'step':
          await this.handleStep(command);
          break;
        case 'saveState':
          await this.handleSaveState(command);
          break;
        case 'loadState':
          await this.handleLoadState(command);
          break;
        case 'getObservation':
          this.handleGetObservation(command);
          break;
        case 'getActionSpace':
          this.handleGetActionSpace(command);
          break;
        case 'getInfo':
          this.handleGetInfo(command);
          break;
        case 'dispose':
          this.handleDispose(command);
          break;
      }
    } catch (e) {
      this.onEvent({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
        requestId: command.requestId,
      });
    }
  }

  /** Get the current environment instance. */
  getEnvironment(): GameEnvironment | null {
    return this.env;
  }

  private async handleInit(command: Extract<EnvironmentCommand, { kind: 'init' }>): Promise<void> {
    // Dispose previous environment if any
    if (this.env) {
      this.env.dispose();
    }

    this.env = this.envFactory(command.config);
    await this.env.init(command.config);

    this.onEvent({
      kind: 'initialized',
      info: this.env.getInfo(),
      requestId: command.requestId,
    });
  }

  private async handleReset(command: Extract<EnvironmentCommand, { kind: 'reset' }>): Promise<void> {
    this.requireEnv(command.requestId);
    const observation = await this.env!.reset();
    this.onEvent({
      kind: 'resetComplete',
      observation,
      requestId: command.requestId,
    });
  }

  private async handleStep(command: Extract<EnvironmentCommand, { kind: 'step' }>): Promise<void> {
    this.requireEnv(command.requestId);
    const result = await this.env!.step(command.action);
    this.onEvent({
      kind: 'stepComplete',
      result,
      requestId: command.requestId,
    });
  }

  private async handleSaveState(command: Extract<EnvironmentCommand, { kind: 'saveState' }>): Promise<void> {
    this.requireEnv(command.requestId);
    const snapshot = await this.env!.saveState();
    this.onEvent({
      kind: 'stateSaved',
      snapshot,
      requestId: command.requestId,
    });
  }

  private async handleLoadState(command: Extract<EnvironmentCommand, { kind: 'loadState' }>): Promise<void> {
    this.requireEnv(command.requestId);
    await this.env!.loadState(command.snapshot);
    this.onEvent({
      kind: 'stateLoaded',
      requestId: command.requestId,
    });
  }

  private handleGetObservation(command: Extract<EnvironmentCommand, { kind: 'getObservation' }>): void {
    this.requireEnv(command.requestId);
    this.onEvent({
      kind: 'observation',
      observation: this.env!.getObservation(),
      requestId: command.requestId,
    });
  }

  private handleGetActionSpace(command: Extract<EnvironmentCommand, { kind: 'getActionSpace' }>): void {
    this.requireEnv(command.requestId);
    this.onEvent({
      kind: 'actionSpace',
      actionSpace: this.env!.getActionSpace(),
      requestId: command.requestId,
    });
  }

  private handleGetInfo(command: Extract<EnvironmentCommand, { kind: 'getInfo' }>): void {
    this.requireEnv(command.requestId);
    this.onEvent({
      kind: 'info',
      info: this.env!.getInfo(),
      requestId: command.requestId,
    });
  }

  private handleDispose(command: Extract<EnvironmentCommand, { kind: 'dispose' }>): void {
    if (this.env) {
      this.env.dispose();
      this.env = null;
    }
    this.onEvent({
      kind: 'disposed',
      requestId: command.requestId,
    });
  }

  private requireEnv(_requestId: string): void {
    if (!this.env) {
      throw new Error('Environment not initialized. Send an init command first.');
    }
  }
}
