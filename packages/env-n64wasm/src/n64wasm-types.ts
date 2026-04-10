/**
 * Type declarations for N64Wasm's JavaScript API surface.
 *
 * N64Wasm exposes its emulator through a global Emscripten Module object
 * and an application-level myApp object. These types describe the subset
 * of the API relevant for programmatic automation.
 *
 * Source: https://github.com/nbarkhina/N64Wasm
 */

/** N64 controller button state — maps to NeilButtons struct in neil_controller.h. */
export type N64ButtonState = {
  /** D-pad and face buttons. */
  Key_Up: boolean;
  Key_Down: boolean;
  Key_Left: boolean;
  Key_Right: boolean;
  Key_Action_A: boolean;
  Key_Action_B: boolean;
  Key_Action_Z: boolean;
  Key_Action_Start: boolean;
  Key_Action_L: boolean;
  Key_Action_R: boolean;

  /** C-buttons. */
  Key_C_Up: boolean;
  Key_C_Down: boolean;
  Key_C_Left: boolean;
  Key_C_Right: boolean;

  /** Analog stick (-1.0 to 1.0). */
  VectorX: number;
  VectorY: number;
};

/** All N64 button names for building control strings. */
export const N64_BUTTON_NAMES = [
  'Key_Up',
  'Key_Down',
  'Key_Left',
  'Key_Right',
  'Key_Action_A',
  'Key_Action_B',
  'Key_Action_Z',
  'Key_Action_Start',
  'Key_Action_L',
  'Key_Action_R',
  'Key_C_Up',
  'Key_C_Down',
  'Key_C_Left',
  'Key_C_Right',
] as const;

/** Emscripten Module interface — subset relevant for automation. */
export interface EmscriptenModule {
  /** Advance emulation by one frame (or two if doubleSpeed is on). */
  _runMainLoop(): void;

  /** Serialize emulator state to /savestate.gz in virtual FS. */
  _neil_serialize(): void;

  /** Unserialize emulator state from /savestate.gz in virtual FS. */
  _neil_unserialize(): void;

  /** Reset the emulator. */
  _neil_reset(): void;

  /** Toggle FPS display. */
  _toggleFPS(): void;

  /** Set double speed mode. */
  _neil_set_double_speed(enabled: number): void;

  /** Set end-of-frame callback flag. */
  _neil_set_endframe_callback(enabled: number): void;

  /**
   * Send controller input via the mobile controls interface.
   * @param controls 14-character binary string (one per button in N64_BUTTON_NAMES order)
   * @param axisX Analog stick X as string ("-1.0" to "1.0")
   * @param axisY Analog stick Y as string ("-1.0" to "1.0")
   */
  cwrap(
    name: 'neil_send_mobile_controls',
    returnType: null,
    argTypes: ['string', 'string', 'string'],
  ): (controls: string, axisX: string, axisY: string) => void;

  /** Emscripten virtual filesystem. */
  FS: EmscriptenFS;

  /** WebGL canvas element. */
  canvas: HTMLCanvasElement;

  /** Call the main function. */
  callMain(args?: string[]): void;
}

/** Subset of Emscripten FS API for save state management. */
export interface EmscriptenFS {
  readFile(path: string): Uint8Array;
  writeFile(path: string, data: Uint8Array): void;
}

/** N64Wasm application-level API. */
export interface N64WasmApp {
  rivetsData: {
    inputController: N64ButtonState;
  };
  /** Wrapped version of neil_send_mobile_controls. */
  sendMobileControls?(controls: string, axisX: string, axisY: string): void;
  /** Per-frame callback hook (set via neil_set_endframe_callback). */
  localCallback?(): void;
}

/**
 * Configuration for the N64Wasm environment.
 * Passed inside EnvironmentConfig.envConfig.
 */
export type N64WasmEnvConfig = {
  /** Path or URL to the ROM file. */
  readonly romPath: string;
  /** Canvas element or selector for rendering. */
  readonly canvas?: HTMLCanvasElement | string;
  /** Number of emulator frames per environment step (frame skip). Default: 1. */
  readonly frameSkip?: number;
  /** Observation frame dimensions (downscaled from native). Default: 84x84. */
  readonly observationSize?: { width: number; height: number };
  /** Whether to capture frames as observations. Default: true. */
  readonly captureFrames?: boolean;
};
