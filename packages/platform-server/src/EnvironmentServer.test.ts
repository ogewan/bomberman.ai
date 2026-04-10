import { describe, expect, it } from 'vitest';

import type {
  ActionInput,
  ActionSpaceDescriptor,
  EnvironmentConfig,
  EnvironmentInfo,
  GameEnvironment,
  Observation,
  StateSnapshot,
  StepResult,
} from '@bomberman65/platform-core';
import { EnvironmentServer } from './EnvironmentServer.js';

class FakeEnvironment implements GameEnvironment {
  private stepCount = 0;

  async init(_config: EnvironmentConfig): Promise<void> {}

  async reset(): Promise<Observation> {
    this.stepCount = 0;
    return { step: 0, state: { tick: 0 } };
  }

  async step(action: ActionInput): Promise<StepResult> {
    this.stepCount += 1;
    return {
      observation: { step: this.stepCount, state: { action } },
      reward: 1,
      done: this.stepCount >= 2,
      truncated: false,
      info: { action },
    };
  }

  async saveState(): Promise<StateSnapshot> {
    return { envType: 'fake', step: this.stepCount, data: { stepCount: this.stepCount } };
  }

  async loadState(snapshot: StateSnapshot): Promise<void> {
    this.stepCount = Number((snapshot.data as Record<string, unknown>)['stepCount'] ?? 0);
  }

  getObservation(): Observation {
    return { step: this.stepCount, state: { tick: this.stepCount } };
  }

  getActionSpace(): ActionSpaceDescriptor {
    return { kind: 'discrete', n: 3, labels: ['idle', 'go', 'bomb'] };
  }

  getInfo(): EnvironmentInfo {
    return {
      name: 'Fake',
      envType: 'fake',
      deterministic: true,
      capabilities: {
        saveLoad: true,
        visualFrames: false,
        structuredState: true,
        variableStepSize: false,
        multiAgent: false,
      },
    };
  }

  dispose(): void {}
}

describe('EnvironmentServer', () => {
  it('creates, initializes, steps, and destroys instances', async () => {
    const server = new EnvironmentServer({
      createEnvironment: () => new FakeEnvironment(),
      generateInstanceId: () => 'env_test',
    });

    const created = await server.handleRequest({
      kind: 'createInstance',
      requestId: 'req_1',
    });
    expect(created).toEqual({
      kind: 'instanceCreated',
      requestId: 'req_1',
      instanceId: 'env_test',
    });

    const initialized = await server.handleRequest({
      kind: 'command',
      requestId: 'req_2',
      instanceId: 'env_test',
      command: {
        kind: 'init',
        config: {
          envType: 'fake',
          envConfig: {},
        },
      },
    });
    expect(initialized.kind).toBe('commandResult');
    if (initialized.kind === 'commandResult') {
      expect(initialized.result.kind).toBe('initialized');
    }

    const stepResult = await server.handleRequest({
      kind: 'command',
      requestId: 'req_3',
      instanceId: 'env_test',
      command: {
        kind: 'step',
        action: 1,
      },
    });
    expect(stepResult.kind).toBe('commandResult');
    if (stepResult.kind === 'commandResult' && stepResult.result.kind === 'stepComplete') {
      expect(stepResult.result.result.reward).toBe(1);
      expect(stepResult.result.result.observation.step).toBe(1);
    }

    const destroyed = await server.handleRequest({
      kind: 'destroyInstance',
      requestId: 'req_4',
      instanceId: 'env_test',
    });
    expect(destroyed).toEqual({
      kind: 'instanceDestroyed',
      requestId: 'req_4',
      instanceId: 'env_test',
    });
  });
});
