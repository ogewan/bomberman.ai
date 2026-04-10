/**
 * EnvironmentWorkerProtocol — message types for running GameEnvironments across worker boundaries.
 *
 * This protocol generalizes the B26 WorkerCommand/WorkerEvent pattern to work
 * with any GameEnvironment. Messages are serializable and can be used across:
 * - Web Workers (postMessage)
 * - WebSocket connections (server-client)
 * - Electron IPC
 * - Direct in-process calls (testing)
 */

import type {
  EnvironmentConfig,
  ActionInput,
  Observation,
  StepResult,
  StateSnapshot,
  ActionSpaceDescriptor,
  EnvironmentInfo,
} from './types/environment.js';

// --- Commands (client → environment host) ---

export type EnvironmentCommand =
  | { readonly kind: 'init'; readonly config: EnvironmentConfig; readonly requestId: string }
  | { readonly kind: 'reset'; readonly requestId: string }
  | { readonly kind: 'step'; readonly action: ActionInput; readonly requestId: string }
  | { readonly kind: 'saveState'; readonly requestId: string }
  | { readonly kind: 'loadState'; readonly snapshot: StateSnapshot; readonly requestId: string }
  | { readonly kind: 'getObservation'; readonly requestId: string }
  | { readonly kind: 'getActionSpace'; readonly requestId: string }
  | { readonly kind: 'getInfo'; readonly requestId: string }
  | { readonly kind: 'dispose'; readonly requestId: string };

// --- Events (environment host → client) ---

export type EnvironmentEvent =
  | { readonly kind: 'initialized'; readonly info: EnvironmentInfo; readonly requestId: string }
  | { readonly kind: 'resetComplete'; readonly observation: Observation; readonly requestId: string }
  | { readonly kind: 'stepComplete'; readonly result: StepResult; readonly requestId: string }
  | { readonly kind: 'stateSaved'; readonly snapshot: StateSnapshot; readonly requestId: string }
  | { readonly kind: 'stateLoaded'; readonly requestId: string }
  | { readonly kind: 'observation'; readonly observation: Observation; readonly requestId: string }
  | { readonly kind: 'actionSpace'; readonly actionSpace: ActionSpaceDescriptor; readonly requestId: string }
  | { readonly kind: 'info'; readonly info: EnvironmentInfo; readonly requestId: string }
  | { readonly kind: 'disposed'; readonly requestId: string }
  | { readonly kind: 'error'; readonly message: string; readonly requestId: string };

// --- Utility types ---

/** Generate a unique request ID. */
let requestCounter = 0;
export function nextRequestId(): string {
  return `req_${++requestCounter}`;
}

/** Reset the request counter (for testing). */
export function resetRequestCounter(): void {
  requestCounter = 0;
}
