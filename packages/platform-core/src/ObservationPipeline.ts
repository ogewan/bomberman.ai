/**
 * ObservationPipeline — transforms raw environment observations into model-ready inputs.
 *
 * Primarily useful for emulator-backed environments where observations are pixel
 * frames. Custom engines like B26 produce structured state and typically bypass
 * the pipeline.
 *
 * Pipeline stages:
 * 1. Resize/crop to target dimensions
 * 2. Grayscale conversion (optional)
 * 3. Normalization (0-255 → 0.0-1.0)
 * 4. Frame stacking for temporal context
 */

import type { FrameData, Observation } from './types/environment.js';

/** Configuration for the observation pipeline. */
export type ObservationPipelineConfig = {
  /** Target output dimensions. */
  readonly targetWidth: number;
  readonly targetHeight: number;
  /** Convert to grayscale (1 channel instead of 3). Default: true. */
  readonly grayscale?: boolean;
  /** Normalize pixel values to [0, 1]. Default: true. */
  readonly normalize?: boolean;
  /** Number of frames to stack for temporal context. Default: 1 (no stacking). */
  readonly frameStack?: number;
  /** Crop region before resize (optional). */
  readonly crop?: { x: number; y: number; width: number; height: number };
};

/** Processed observation output — a flat Float32Array ready for model input. */
export type ProcessedObservation = {
  /** Processed pixel data as float array. Shape: [channels * height * width] or [stack * channels * height * width]. */
  readonly data: Float32Array;
  /** Shape of the data: [stack, channels, height, width]. */
  readonly shape: readonly [number, number, number, number];
  /** Original step number from the observation. */
  readonly step: number;
};

export class ObservationPipeline {
  private config: ObservationPipelineConfig;
  private frameBuffer: Float32Array[] = [];
  private channels: number;

  constructor(config: ObservationPipelineConfig) {
    this.config = config;
    this.channels = config.grayscale !== false ? 1 : 3;
  }

  /**
   * Process a raw observation into a model-ready format.
   * Returns null if the observation has no frame data.
   */
  process(observation: Observation): ProcessedObservation | null {
    if (!observation.frame) return null;

    const frame = this.processFrame(observation.frame);

    // Frame stacking
    const stackSize = this.config.frameStack ?? 1;
    this.frameBuffer.push(frame);
    if (this.frameBuffer.length > stackSize) {
      this.frameBuffer.shift();
    }

    // Pad with zeros if we don't have enough frames yet
    while (this.frameBuffer.length < stackSize) {
      this.frameBuffer.unshift(new Float32Array(frame.length));
    }

    // Concatenate stacked frames
    const totalSize = frame.length * stackSize;
    const stacked = new Float32Array(totalSize);
    for (let i = 0; i < stackSize; i++) {
      stacked.set(this.frameBuffer[i]!, i * frame.length);
    }

    return {
      data: stacked,
      shape: [stackSize, this.channels, this.config.targetHeight, this.config.targetWidth],
      step: observation.step,
    };
  }

  /** Reset the frame buffer (call between episodes). */
  reset(): void {
    this.frameBuffer = [];
  }

  /** Get the expected output shape. */
  getOutputShape(): readonly [number, number, number, number] {
    return [
      this.config.frameStack ?? 1,
      this.channels,
      this.config.targetHeight,
      this.config.targetWidth,
    ];
  }

  // --- Private processing stages ---

  private processFrame(frame: FrameData): Float32Array {
    let { data, width, height } = frame;

    // Stage 1: Crop (if configured)
    if (this.config.crop) {
      const cropped = this.cropFrame(data, width, height, this.config.crop);
      data = cropped.data;
      width = cropped.width;
      height = cropped.height;
    }

    // Stage 2: Resize to target dimensions
    const resized = this.resizeFrame(
      data, width, height,
      this.config.targetWidth, this.config.targetHeight,
    );

    // Stage 3: Convert to target channels (grayscale or RGB)
    const channelData = this.config.grayscale !== false
      ? this.toGrayscale(resized, this.config.targetWidth, this.config.targetHeight)
      : this.toRGB(resized, this.config.targetWidth, this.config.targetHeight);

    // Stage 4: Normalize (0-255 → 0.0-1.0)
    if (this.config.normalize !== false) {
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = channelData[i]! / 255.0;
      }
    }

    return channelData;
  }

  private cropFrame(
    data: Uint8ClampedArray,
    width: number,
    _height: number,
    crop: { x: number; y: number; width: number; height: number },
  ): { data: Uint8ClampedArray; width: number; height: number } {
    const result = new Uint8ClampedArray(crop.width * crop.height * 4);
    for (let y = 0; y < crop.height; y++) {
      const srcOffset = ((y + crop.y) * width + crop.x) * 4;
      const dstOffset = y * crop.width * 4;
      result.set(data.subarray(srcOffset, srcOffset + crop.width * 4), dstOffset);
    }
    return { data: result, width: crop.width, height: crop.height };
  }

  /**
   * Nearest-neighbor resize. Fast and sufficient for ML preprocessing.
   * For better quality, bilinear could be added as an option.
   */
  private resizeFrame(
    data: Uint8ClampedArray,
    srcWidth: number,
    srcHeight: number,
    dstWidth: number,
    dstHeight: number,
  ): Uint8ClampedArray {
    if (srcWidth === dstWidth && srcHeight === dstHeight) return data;

    const result = new Uint8ClampedArray(dstWidth * dstHeight * 4);
    const xRatio = srcWidth / dstWidth;
    const yRatio = srcHeight / dstHeight;

    for (let y = 0; y < dstHeight; y++) {
      const srcY = Math.floor(y * yRatio);
      for (let x = 0; x < dstWidth; x++) {
        const srcX = Math.floor(x * xRatio);
        const srcIdx = (srcY * srcWidth + srcX) * 4;
        const dstIdx = (y * dstWidth + x) * 4;
        result[dstIdx] = data[srcIdx]!;
        result[dstIdx + 1] = data[srcIdx + 1]!;
        result[dstIdx + 2] = data[srcIdx + 2]!;
        result[dstIdx + 3] = data[srcIdx + 3]!;
      }
    }

    return result;
  }

  /** Convert RGBA to single-channel grayscale using luminance formula. */
  private toGrayscale(
    data: Uint8ClampedArray,
    width: number,
    height: number,
  ): Float32Array {
    const result = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4]!;
      const g = data[i * 4 + 1]!;
      const b = data[i * 4 + 2]!;
      // ITU-R BT.601 luminance
      result[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    return result;
  }

  /** Convert RGBA to RGB (drop alpha), channel-first layout (CHW). */
  private toRGB(
    data: Uint8ClampedArray,
    width: number,
    height: number,
  ): Float32Array {
    const pixels = width * height;
    const result = new Float32Array(3 * pixels);
    for (let i = 0; i < pixels; i++) {
      result[i] = data[i * 4]!;                 // R channel
      result[pixels + i] = data[i * 4 + 1]!;    // G channel
      result[2 * pixels + i] = data[i * 4 + 2]!; // B channel
    }
    return result;
  }
}
