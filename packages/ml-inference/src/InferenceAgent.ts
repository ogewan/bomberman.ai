/**
 * InferenceAgent — Agent that selects actions using a TensorFlow.js model.
 *
 * Loads a pre-trained model (from URL, IndexedDB, or file system) and runs
 * forward passes to select actions. Supports both policy networks (output is
 * action probabilities) and Q-networks (output is Q-values per action).
 *
 * Model input: the observation pipeline's processed output (Float32Array).
 * Model output: depends on outputMode:
 *   - 'policy': softmax probabilities, action sampled or argmax
 *   - 'qvalue': Q-values per action, action is argmax
 */

import * as tf from '@tensorflow/tfjs';
import type {
  Agent,
  AgentInfo,
  ActionInput,
  Observation,
  ActionSpaceDescriptor,
  ObservationPipelineConfig,
} from '@bomberman65/platform-core';
import { ObservationPipeline } from '@bomberman65/platform-core';

/** How to interpret the model's output tensor. */
export type OutputMode = 'policy' | 'qvalue';

/** How to select actions from model output. */
export type ActionSelectionMode = 'greedy' | 'sample' | 'epsilon_greedy';

/** Configuration for the InferenceAgent. */
export type InferenceAgentConfig = {
  /** Path/URL to the TF.js model (model.json). */
  readonly modelPath: string;
  /** How to interpret model output. Default: 'qvalue'. */
  readonly outputMode?: OutputMode;
  /** Action selection strategy. Default: 'greedy'. */
  readonly actionSelection?: ActionSelectionMode;
  /** Epsilon for epsilon-greedy selection. Default: 0.05. */
  readonly epsilon?: number;
  /** Observation pipeline config for frame preprocessing. */
  readonly observationPipeline?: ObservationPipelineConfig;
  /** Agent display name. */
  readonly name?: string;
};

export class InferenceAgent implements Agent {
  readonly info: AgentInfo;

  private model: tf.LayersModel | tf.GraphModel | null = null;
  private config: InferenceAgentConfig;
  private pipeline: ObservationPipeline | null = null;
  private numActions = 0;

  constructor(config: InferenceAgentConfig) {
    this.config = config;
    this.info = {
      id: `inference_${config.modelPath.split('/').pop() ?? 'model'}`,
      name: config.name ?? 'TF.js Inference Agent',
      kind: 'inference',
    };
  }

  async init(actionSpace: ActionSpaceDescriptor): Promise<void> {
    // Determine number of discrete actions
    if (actionSpace.kind === 'discrete') {
      this.numActions = actionSpace.n;
    } else {
      throw new Error(
        `InferenceAgent currently only supports discrete action spaces, got '${actionSpace.kind}'`,
      );
    }

    // Set up observation pipeline if configured
    if (this.config.observationPipeline) {
      this.pipeline = new ObservationPipeline(this.config.observationPipeline);
    }

    // Load model
    try {
      this.model = await tf.loadLayersModel(this.config.modelPath);
    } catch {
      // Fall back to GraphModel (for SavedModel/TFHub format)
      this.model = await tf.loadGraphModel(this.config.modelPath);
    }
  }

  async selectAction(observation: Observation): Promise<ActionInput> {
    if (!this.model) throw new Error('Model not loaded. Call init() first.');

    // Preprocess observation through pipeline
    const inputTensor = this.observationToTensor(observation);

    try {
      // Forward pass
      const output = this.model.predict(inputTensor) as tf.Tensor;
      const values = await output.data();
      output.dispose();

      // Select action based on output mode and selection strategy
      return this.selectFromOutput(values as Float32Array);
    } finally {
      inputTensor.dispose();
    }
  }

  onEpisodeEnd(): void {
    // Reset observation pipeline frame buffer between episodes
    this.pipeline?.reset();
  }

  dispose(): void {
    this.model?.dispose();
    this.model = null;
    this.pipeline = null;
  }

  /** Whether a model is currently loaded. */
  isModelLoaded(): boolean {
    return this.model !== null;
  }

  // --- Private ---

  private observationToTensor(observation: Observation): tf.Tensor {
    if (this.pipeline && observation.frame) {
      const processed = this.pipeline.process(observation);
      if (processed) {
        // Shape: [1, stack, channels, height, width] — batch dim added
        return tf.tensor(processed.data, [1, ...processed.shape]);
      }
    }

    // Fallback: if observation has structured state, flatten it
    if (observation.state) {
      const flat = this.flattenState(observation.state);
      return tf.tensor2d([flat]);
    }

    throw new Error('Observation has neither frame nor state data');
  }

  private flattenState(state: Record<string, unknown>): number[] {
    const values: number[] = [];
    const flatten = (obj: unknown): void => {
      if (typeof obj === 'number') {
        values.push(obj);
      } else if (typeof obj === 'boolean') {
        values.push(obj ? 1 : 0);
      } else if (Array.isArray(obj)) {
        obj.forEach(flatten);
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(flatten);
      }
    };
    flatten(state);
    return values;
  }

  private selectFromOutput(values: Float32Array): number {
    const mode = this.config.actionSelection ?? 'greedy';
    const outputMode = this.config.outputMode ?? 'qvalue';

    switch (mode) {
      case 'greedy':
        return this.argmax(values);

      case 'sample': {
        if (outputMode === 'policy') {
          return this.sampleFromProbabilities(values);
        }
        // For Q-values, convert to probabilities via softmax then sample
        return this.sampleFromProbabilities(this.softmax(values));
      }

      case 'epsilon_greedy': {
        const epsilon = this.config.epsilon ?? 0.05;
        if (Math.random() < epsilon) {
          return Math.floor(Math.random() * this.numActions);
        }
        return this.argmax(values);
      }
    }
  }

  private argmax(values: Float32Array): number {
    let bestIdx = 0;
    let bestVal = values[0]!;
    for (let i = 1; i < values.length; i++) {
      if (values[i]! > bestVal) {
        bestVal = values[i]!;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private sampleFromProbabilities(probs: Float32Array): number {
    let r = Math.random();
    for (let i = 0; i < probs.length; i++) {
      r -= probs[i]!;
      if (r <= 0) return i;
    }
    return probs.length - 1;
  }

  private softmax(values: Float32Array): Float32Array {
    const max = Math.max(...values);
    const exps = new Float32Array(values.length);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      exps[i] = Math.exp(values[i]! - max);
      sum += exps[i]!;
    }
    for (let i = 0; i < exps.length; i++) {
      exps[i] = exps[i]! / sum;
    }
    return exps;
  }
}
