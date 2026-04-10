/** @module @bomberman65/env-n64wasm — GameEnvironment adapter for N64 emulation via N64Wasm. */

export { N64WasmEnvironment, ENV_TYPE } from './N64WasmEnvironment.js';
export type {
  N64WasmEnvConfig,
  N64ButtonState,
  EmscriptenModule,
  N64WasmApp,
} from './n64wasm-types.js';
export { N64_BUTTON_NAMES } from './n64wasm-types.js';
