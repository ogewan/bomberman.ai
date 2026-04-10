/** Model manifest types for browser-visible inference demos and remote evaluation. */

import type { ObservationPipelineConfig } from '@bomberman65/platform-core';

export type BuiltinModelId = 'b26-demo-pass-through-v1';

export type StateProjectionConfig = {
  readonly kind: 'path';
  readonly path: string;
  readonly expectedLength?: number;
};

export type ModelManifest = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly envType: string;
  readonly actionSpace: {
    readonly kind: 'discrete';
    readonly n: number;
  };
  readonly observationMode: 'frame' | 'structuredState';
  readonly modelPath?: string;
  readonly builtinModelId?: BuiltinModelId;
  readonly observationPipeline?: ObservationPipelineConfig;
  readonly stateProjection?: StateProjectionConfig;
  readonly outputMode?: 'policy' | 'qvalue';
  readonly actionSelection?: 'greedy' | 'sample' | 'epsilon_greedy';
  readonly epsilon?: number;
};
