/**
 * RemoteGameEnvironment — client-side proxy that implements GameEnvironment
 * over the EnvironmentWorkerProtocol.
 *
 * This allows the platform UI, agents, and experiments to drive environments
 * running in Web Workers, server-side headless Chromium, or any other host
 * that speaks the protocol — all through the standard GameEnvironment interface.
 *
 * The transport layer is abstracted: provide a send function and call
 * handleEvent when responses arrive.
 */

import type {
  GameEnvironment,
  EnvironmentConfig,
  Observation,
  StepResult,
  StateSnapshot,
  ActionSpaceDescriptor,
  ActionInput,
  EnvironmentInfo,
} from './types/environment.js';
import type { EnvironmentCommand, EnvironmentEvent } from './EnvironmentWorkerProtocol.js';
import { nextRequestId } from './EnvironmentWorkerProtocol.js';

/** Function to send commands to the remote environment host. */
export type CommandSender = (command: EnvironmentCommand) => void;

export class RemoteGameEnvironment implements GameEnvironment {
  private sender: CommandSender;
  private pending = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();
  private cachedInfo: EnvironmentInfo | null = null;
  private cachedActionSpace: ActionSpaceDescriptor | null = null;
  private lastObservation: Observation | null = null;

  /**
   * @param sender Function to send commands to the remote host.
   *   For Web Workers: (cmd) => worker.postMessage(cmd)
   *   For WebSocket: (cmd) => ws.send(JSON.stringify(cmd))
   */
  constructor(sender: CommandSender) {
    this.sender = sender;
  }

  /**
   * Handle an event from the remote host. Call this when you receive
   * a message from the worker/WebSocket/IPC channel.
   */
  handleEvent(event: EnvironmentEvent): void {
    const pending = this.pending.get(event.requestId);
    if (!pending) return;

    this.pending.delete(event.requestId);

    if (event.kind === 'error') {
      pending.reject(new Error(event.message));
      return;
    }

    switch (event.kind) {
      case 'initialized':
        this.cachedInfo = event.info;
        pending.resolve(undefined);
        break;
      case 'resetComplete':
        this.lastObservation = event.observation;
        pending.resolve(event.observation);
        break;
      case 'stepComplete':
        this.lastObservation = event.result.observation;
        pending.resolve(event.result);
        break;
      case 'stateSaved':
        pending.resolve(event.snapshot);
        break;
      case 'stateLoaded':
        pending.resolve(undefined);
        break;
      case 'observation':
        this.lastObservation = event.observation;
        pending.resolve(event.observation);
        break;
      case 'actionSpace':
        this.cachedActionSpace = event.actionSpace;
        pending.resolve(event.actionSpace);
        break;
      case 'info':
        this.cachedInfo = event.info;
        pending.resolve(event.info);
        break;
      case 'disposed':
        pending.resolve(undefined);
        break;
    }
  }

  async init(config: EnvironmentConfig): Promise<void> {
    await this.request({ kind: 'init', config, requestId: '' });

    // Fetch action space and info upfront
    this.cachedActionSpace = await this.request({ kind: 'getActionSpace', requestId: '' }) as ActionSpaceDescriptor;
  }

  async reset(): Promise<Observation> {
    return await this.request({ kind: 'reset', requestId: '' }) as Observation;
  }

  async step(action: ActionInput): Promise<StepResult> {
    return await this.request({ kind: 'step', action, requestId: '' }) as StepResult;
  }

  async saveState(): Promise<StateSnapshot> {
    return await this.request({ kind: 'saveState', requestId: '' }) as StateSnapshot;
  }

  async loadState(snapshot: StateSnapshot): Promise<void> {
    await this.request({ kind: 'loadState', snapshot, requestId: '' });
  }

  getObservation(): Observation {
    if (!this.lastObservation) {
      throw new Error('No observation available. Call reset() or step() first.');
    }
    return this.lastObservation;
  }

  getActionSpace(): ActionSpaceDescriptor {
    if (!this.cachedActionSpace) {
      throw new Error('Action space not available. Call init() first.');
    }
    return this.cachedActionSpace;
  }

  getInfo(): EnvironmentInfo {
    if (!this.cachedInfo) {
      throw new Error('Environment info not available. Call init() first.');
    }
    return this.cachedInfo;
  }

  async dispose(): Promise<void> {
    await this.request({ kind: 'dispose', requestId: '' });
    this.pending.clear();
  }

  // --- Private ---

  private request(command: EnvironmentCommand): Promise<unknown> {
    const requestId = nextRequestId();
    const commandWithId = { ...command, requestId };

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.sender(commandWithId);
    });
  }
}
