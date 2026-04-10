/**
 * EnvironmentServer — in-process multi-instance host for GameEnvironment
 * lifecycles and command execution.
 *
 * Transport adapters (WebSocket, IPC, tests) feed RemoteEnvironmentRequest
 * values into this class and return the produced response.
 */

import type { GameEnvironment } from '@bomberman65/platform-core';
import {
  deserializeStateSnapshot,
  nextRemoteRequestId,
  serializeObservation,
  serializeStateSnapshot,
  serializeStepResult,
  type EnvironmentInstanceId,
  type RemoteEnvironmentCommandResult,
  type RemoteEnvironmentRequest,
  type RemoteEnvironmentResponse,
  type TransportEnvironmentCommand,
} from '@bomberman65/platform-core';

export type EnvironmentServerFactory = (envType: string) => GameEnvironment;

export type EnvironmentServerOptions = {
  readonly createEnvironment: EnvironmentServerFactory;
  readonly generateInstanceId?: () => EnvironmentInstanceId;
};

export class EnvironmentServer {
  private readonly createEnvironment: EnvironmentServerFactory;
  private readonly generateInstanceId: () => EnvironmentInstanceId;
  private readonly instances = new Map<EnvironmentInstanceId, GameEnvironment>();

  constructor(options: EnvironmentServerOptions) {
    this.createEnvironment = options.createEnvironment;
    this.generateInstanceId = options.generateInstanceId ?? (() => `env_${nextRemoteRequestId()}`);
  }

  async handleRequest(request: RemoteEnvironmentRequest): Promise<RemoteEnvironmentResponse> {
    try {
      switch (request.kind) {
        case 'createInstance':
          return this.handleCreateInstance(request);
        case 'destroyInstance':
          return this.handleDestroyInstance(request);
        case 'listInstances':
          return {
            kind: 'instancesListed',
            requestId: request.requestId,
            instanceIds: [...this.instances.keys()],
          };
        case 'command':
          return await this.handleCommand(request);
      }
    } catch (error) {
      return {
        kind: 'error',
        requestId: request.requestId,
        instanceId: 'instanceId' in request ? request.instanceId : undefined,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  listInstanceIds(): readonly EnvironmentInstanceId[] {
    return [...this.instances.keys()];
  }

  async dispose(): Promise<void> {
    for (const env of this.instances.values()) {
      env.dispose();
    }
    this.instances.clear();
  }

  private handleCreateInstance(
    request: Extract<RemoteEnvironmentRequest, { kind: 'createInstance' }>,
  ): RemoteEnvironmentResponse {
    const instanceId = request.instanceId ?? this.generateInstanceId();
    if (this.instances.has(instanceId)) {
      throw new Error(`Environment instance '${instanceId}' already exists.`);
    }

    // Instance is reserved now; actual environment object is created on init.
    this.instances.set(instanceId, new DeferredEnvironment());

    return {
      kind: 'instanceCreated',
      requestId: request.requestId,
      instanceId,
    };
  }

  private handleDestroyInstance(
    request: Extract<RemoteEnvironmentRequest, { kind: 'destroyInstance' }>,
  ): RemoteEnvironmentResponse {
    const env = this.instances.get(request.instanceId);
    if (!env) {
      throw new Error(`Unknown environment instance '${request.instanceId}'.`);
    }

    env.dispose();
    this.instances.delete(request.instanceId);

    return {
      kind: 'instanceDestroyed',
      requestId: request.requestId,
      instanceId: request.instanceId,
    };
  }

  private async handleCommand(
    request: Extract<RemoteEnvironmentRequest, { kind: 'command' }>,
  ): Promise<RemoteEnvironmentResponse> {
    const env = this.instances.get(request.instanceId);
    if (!env) {
      throw new Error(`Unknown environment instance '${request.instanceId}'.`);
    }

    const result = await this.executeCommand(request.instanceId, request.command, env);
    return {
      kind: 'commandResult',
      requestId: request.requestId,
      instanceId: request.instanceId,
      result,
    };
  }

  private async executeCommand(
    instanceId: EnvironmentInstanceId,
    command: TransportEnvironmentCommand,
    env: GameEnvironment,
  ): Promise<RemoteEnvironmentCommandResult> {
    switch (command.kind) {
      case 'init': {
        const nextEnv = this.createEnvironment(command.config.envType);
        await nextEnv.init(command.config);

        env.dispose();
        this.instances.set(instanceId, nextEnv);

        return {
          kind: 'initialized',
          info: nextEnv.getInfo(),
        };
      }

      case 'reset':
        return {
          kind: 'resetComplete',
          observation: serializeObservation(await env.reset()),
        };

      case 'step':
        return {
          kind: 'stepComplete',
          result: serializeStepResult(await env.step(command.action)),
        };

      case 'saveState':
        return {
          kind: 'stateSaved',
          snapshot: serializeStateSnapshot(await env.saveState()),
        };

      case 'loadState':
        await env.loadState(deserializeStateSnapshot(command.snapshot));
        return { kind: 'stateLoaded' };

      case 'getObservation':
        return {
          kind: 'observation',
          observation: serializeObservation(env.getObservation()),
        };

      case 'getActionSpace':
        return {
          kind: 'actionSpace',
          actionSpace: env.getActionSpace(),
        };

      case 'getInfo':
        return {
          kind: 'info',
          info: env.getInfo(),
        };

      case 'dispose':
        env.dispose();
        this.instances.set(instanceId, new DeferredEnvironment());
        return { kind: 'disposed' };
    }
  }
}

/**
 * Placeholder environment used for reserved-yet-uninitialized instances.
 * It gives cleaner error messages than null checks throughout the server.
 */
class DeferredEnvironment implements GameEnvironment {
  async init(_config: unknown): Promise<void> {
    throw new Error('DeferredEnvironment cannot be initialized directly.');
  }

  async reset(): Promise<never> {
    throw new Error('Environment instance has not been initialized yet.');
  }

  async step(_action: unknown): Promise<never> {
    throw new Error('Environment instance has not been initialized yet.');
  }

  async saveState(): Promise<never> {
    throw new Error('Environment instance has not been initialized yet.');
  }

  async loadState(_snapshot: unknown): Promise<never> {
    throw new Error('Environment instance has not been initialized yet.');
  }

  getObservation(): never {
    throw new Error('Environment instance has not been initialized yet.');
  }

  getActionSpace(): never {
    throw new Error('Environment instance has not been initialized yet.');
  }

  getInfo(): never {
    throw new Error('Environment instance has not been initialized yet.');
  }

  dispose(): void {
    // No-op.
  }
}
