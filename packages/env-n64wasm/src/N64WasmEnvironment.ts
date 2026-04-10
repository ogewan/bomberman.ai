/**
 * N64WasmEnvironment — GameEnvironment adapter for the N64Wasm emulator.
 *
 * Wraps an N64Wasm emulator instance behind the platform's GameEnvironment
 * interface. Enables programmatic control of N64 games for ML training and
 * interactive demos.
 *
 * Key integration points (from N64Wasm source):
 * - Input: Module.cwrap('neil_send_mobile_controls') or direct inputController property access
 * - Frame step: Module._runMainLoop() — advances exactly one frame synchronously
 * - Save/load: Module._neil_serialize() / _neil_unserialize() + Emscripten FS
 * - Frame capture: WebGL canvas readPixels
 *
 * This adapter disables the default audio-driven emulation loop and instead
 * steps the emulator programmatically, giving precise frame-by-frame control.
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
  FrameData,
} from '@bomberman65/platform-core';

import type {
  EmscriptenModule,
  N64WasmApp,
  N64WasmEnvConfig,
} from './n64wasm-types.js';
import { N64_BUTTON_NAMES } from './n64wasm-types.js';

export const ENV_TYPE = 'n64wasm';

/**
 * N64 action space: 14 digital buttons + 2 analog axes.
 * Composite action space with a discrete sub-space for buttons
 * and a continuous sub-space for the analog stick.
 */
const N64_ACTION_SPACE: ActionSpaceDescriptor = {
  kind: 'composite',
  spaces: {
    buttons: {
      kind: 'discrete',
      n: 14,
      labels: [...N64_BUTTON_NAMES],
    },
    stick: {
      kind: 'continuous',
      shape: [2],
      low: [-1.0, -1.0],
      high: [1.0, 1.0],
    },
  },
};

export class N64WasmEnvironment implements GameEnvironment {
  private module: EmscriptenModule | null = null;
  private app: N64WasmApp | null = null;
  private sendControls: ((controls: string, axisX: string, axisY: string) => void) | null = null;
  private envConfig: N64WasmEnvConfig | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private frameCount = 0;
  private maxSteps: number | undefined;

  async init(config: EnvironmentConfig): Promise<void> {
    if (config.envType !== ENV_TYPE) {
      throw new Error(`N64WasmEnvironment cannot handle envType '${config.envType}'`);
    }

    this.envConfig = config.envConfig as unknown as N64WasmEnvConfig;
    this.maxSteps = config.maxSteps;

    // Resolve Module and App from the global scope
    // N64Wasm sets these up during its initialization
    this.module = (globalThis as Record<string, unknown>)['Module'] as EmscriptenModule | null;
    this.app = (globalThis as Record<string, unknown>)['myApp'] as N64WasmApp | null;

    if (!this.module) {
      throw new Error(
        'N64Wasm Module not found on globalThis. ' +
        'Ensure N64Wasm is loaded before initializing the environment.',
      );
    }

    // Set up the cwrap'd controller input function
    this.sendControls = this.module.cwrap(
      'neil_send_mobile_controls',
      null,
      ['string', 'string', 'string'],
    );

    // Resolve canvas for frame capture
    this.canvas = this.module.canvas;
    if (this.canvas) {
      this.gl = this.canvas.getContext('webgl2') ?? this.canvas.getContext('webgl');
    }

    // Enable per-frame callback so we can hook into the frame loop
    this.module._neil_set_endframe_callback(1);
  }

  async reset(): Promise<Observation> {
    if (!this.module) throw new Error('Environment not initialized.');

    this.module._neil_reset();
    this.frameCount = 0;

    // Step a few frames to let the emulator settle after reset
    for (let i = 0; i < 10; i++) {
      this.module._runMainLoop();
    }

    return this.getObservation();
  }

  async step(action: ActionInput): Promise<StepResult> {
    if (!this.module) throw new Error('Environment not initialized.');

    // Apply action
    this.applyAction(action);

    // Advance emulation
    const frameSkip = this.envConfig?.frameSkip ?? 1;
    for (let i = 0; i < frameSkip; i++) {
      this.module._runMainLoop();
    }
    this.frameCount += frameSkip;

    const observation = this.getObservation();
    const truncated =
      this.maxSteps !== undefined && this.frameCount >= this.maxSteps;

    return {
      observation,
      reward: 0, // Reward must be defined per-game via a reward shaping function
      done: truncated,
      truncated,
      info: {
        frameCount: this.frameCount,
      },
    };
  }

  async saveState(): Promise<StateSnapshot> {
    if (!this.module) throw new Error('Environment not initialized.');

    this.module._neil_serialize();
    const stateData = this.module.FS.readFile('/savestate.gz');

    return {
      envType: ENV_TYPE,
      step: this.frameCount,
      data: stateData.buffer as ArrayBuffer,
    };
  }

  async loadState(snapshot: StateSnapshot): Promise<void> {
    if (snapshot.envType !== ENV_TYPE) {
      throw new Error(`Cannot load state of type '${snapshot.envType}' into N64WasmEnvironment`);
    }
    if (!this.module) throw new Error('Environment not initialized.');

    const data = new Uint8Array(snapshot.data as ArrayBuffer);
    this.module.FS.writeFile('/savestate.gz', data);
    this.module._neil_unserialize();
    this.frameCount = snapshot.step;
  }

  getObservation(): Observation {
    const obs: Observation = {
      step: this.frameCount,
    };

    if (this.envConfig?.captureFrames !== false) {
      const frame = this.captureFrame();
      if (frame) {
        return { ...obs, frame };
      }
    }

    return obs;
  }

  getActionSpace(): ActionSpaceDescriptor {
    return N64_ACTION_SPACE;
  }

  getInfo(): EnvironmentInfo {
    return {
      name: 'N64 (N64Wasm)',
      envType: ENV_TYPE,
      frameDimensions: this.envConfig?.observationSize ?? { width: 84, height: 84 },
      deterministic: false, // Emulator determinism is unverified
      capabilities: {
        saveLoad: true,
        visualFrames: true,
        structuredState: false,
        variableStepSize: true,
        multiAgent: false,
      },
    };
  }

  /** Expose the N64Wasm app object for environment-specific integrations. */
  getApp(): N64WasmApp | null {
    return this.app;
  }

  dispose(): void {
    this.module = null;
    this.app = null;
    this.sendControls = null;
    this.canvas = null;
    this.gl = null;
  }

  // --- Private helpers ---

  /**
   * Apply an action to the emulator.
   *
   * Accepts:
   * - Composite: { buttons: number[], stick: [x, y] }
   * - Array of 16 numbers: [14 buttons (0/1), stickX, stickY]
   * - Single number: treated as a button index to press (all others released)
   */
  private applyAction(action: ActionInput): void {
    if (!this.sendControls) return;

    let buttonBits = '00000000000000';
    let stickX = '0.0';
    let stickY = '0.0';

    if (typeof action === 'number') {
      // Single button press
      const chars = Array(14).fill('0');
      if (action >= 0 && action < 14) {
        chars[action] = '1';
      }
      buttonBits = chars.join('');
    } else if (Array.isArray(action)) {
      // Flat array: [14 buttons, stickX, stickY]
      const chars = Array(14).fill('0');
      for (let i = 0; i < 14 && i < action.length; i++) {
        chars[i] = action[i]! > 0.5 ? '1' : '0';
      }
      buttonBits = chars.join('');
      if (action.length > 14) stickX = String(action[14] ?? 0);
      if (action.length > 15) stickY = String(action[15] ?? 0);
    } else if (typeof action === 'object') {
      // Composite: { buttons: number[], stick: [x, y] }
      const composite = action as Record<string, number | number[]>;
      const buttons = composite['buttons'];
      const stick = composite['stick'];

      if (Array.isArray(buttons)) {
        const chars = Array(14).fill('0');
        for (let i = 0; i < 14; i++) {
          chars[i] = (buttons[i] ?? 0) > 0.5 ? '1' : '0';
        }
        buttonBits = chars.join('');
      }

      if (Array.isArray(stick)) {
        stickX = String(stick[0] ?? 0);
        stickY = String(stick[1] ?? 0);
      }
    }

    this.sendControls(buttonBits, stickX, stickY);
  }

  /** Capture the current WebGL canvas as a FrameData. */
  private captureFrame(): FrameData | null {
    if (!this.canvas || !this.gl) return null;

    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const pixels = new Uint8Array(width * height * 4);

    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // WebGL readPixels returns bottom-up; flip vertically
    const flipped = new Uint8ClampedArray(width * height * 4);
    const rowSize = width * 4;
    for (let y = 0; y < height; y++) {
      const srcOffset = (height - 1 - y) * rowSize;
      const dstOffset = y * rowSize;
      flipped.set(pixels.subarray(srcOffset, srcOffset + rowSize), dstOffset);
    }

    return {
      data: flipped,
      width,
      height,
    };
  }
}
