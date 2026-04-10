import { describe, expect, it } from 'vitest';

import type { Observation } from '@bomberman65/platform-core';
import { InferenceAgent } from './InferenceAgent.js';

describe('InferenceAgent', () => {
  it('supports builtin pass-through models with state projection', async () => {
    const agent = new InferenceAgent({
      builtinModelId: 'b26-demo-pass-through-v1',
      stateProjection: {
        kind: 'path',
        path: 'agentFeatures.actionLogits',
        expectedLength: 13,
      },
    });

    await agent.init({
      kind: 'discrete',
      n: 13,
      labels: Array.from({ length: 13 }, (_, index) => `a${index}`),
    });

    const observation: Observation = {
      step: 0,
      state: {
        agentFeatures: {
          actionLogits: [0, 0.25, 0.5, 0.75, 3, 0, 0, 0, 0, 0, 0, 0, 0],
        },
      },
    };

    const action = await agent.selectAction(observation, 0);
    expect(action).toBe(4);
    agent.dispose();
  });
});
