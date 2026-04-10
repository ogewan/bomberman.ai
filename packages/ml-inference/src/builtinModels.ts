import * as tf from '@tensorflow/tfjs';

import type { BuiltinModelId } from './modelManifest.js';

/**
 * Built-in models keep the demo path self-contained when a real trained model
 * artifact is not yet checked in. They still execute through TF.js and the
 * regular InferenceAgent path.
 */
export function createBuiltinModel(
  builtinModelId: BuiltinModelId,
  inputSize: number,
  outputSize: number,
): tf.LayersModel {
  switch (builtinModelId) {
    case 'b26-demo-pass-through-v1':
      return createPassThroughModel(inputSize, outputSize);
  }
}

function createPassThroughModel(inputSize: number, outputSize: number): tf.LayersModel {
  if (inputSize !== outputSize) {
    throw new Error(
      `b26-demo-pass-through-v1 requires inputSize (${inputSize}) to equal outputSize (${outputSize}).`,
    );
  }

  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [inputSize],
        units: outputSize,
        activation: 'linear',
        useBias: true,
        name: 'policy_head',
      }),
    ],
  });

  const kernel = tf.eye(inputSize);
  const bias = tf.zeros([outputSize]);
  model.setWeights([kernel, bias]);
  kernel.dispose();
  bias.dispose();

  return model;
}
