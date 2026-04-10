/**
 * RemoteEnvironmentProtocol — JSON-safe transport contract for multi-instance
 * GameEnvironment hosting over WebSocket or any message-oriented RPC layer.
 *
 * The protocol wraps the existing EnvironmentWorkerProtocol semantics with:
 * - server-managed environment instance IDs
 * - transport-level request/response envelopes
 * - JSON-safe serialization for binary frame/state payloads
 */

import type {
  ActionInput,
  ActionSpaceDescriptor,
  EnvironmentConfig,
  EnvironmentInfo,
  FrameData,
  Observation,
  StateSnapshot,
  StepResult,
} from './types/environment.js';

export type EnvironmentInstanceId = string;

export type TransportEnvironmentCommand =
  | { readonly kind: 'init'; readonly config: EnvironmentConfig }
  | { readonly kind: 'reset' }
  | { readonly kind: 'step'; readonly action: ActionInput }
  | { readonly kind: 'saveState' }
  | { readonly kind: 'loadState'; readonly snapshot: SerializedStateSnapshot }
  | { readonly kind: 'getObservation' }
  | { readonly kind: 'getActionSpace' }
  | { readonly kind: 'getInfo' }
  | { readonly kind: 'dispose' };

export type RemoteEnvironmentRequest =
  | {
      readonly kind: 'createInstance';
      readonly requestId: string;
      readonly instanceId?: EnvironmentInstanceId;
    }
  | {
      readonly kind: 'destroyInstance';
      readonly requestId: string;
      readonly instanceId: EnvironmentInstanceId;
    }
  | {
      readonly kind: 'command';
      readonly requestId: string;
      readonly instanceId: EnvironmentInstanceId;
      readonly command: TransportEnvironmentCommand;
    }
  | {
      readonly kind: 'listInstances';
      readonly requestId: string;
    };

export type RemoteEnvironmentResponse =
  | {
      readonly kind: 'instanceCreated';
      readonly requestId: string;
      readonly instanceId: EnvironmentInstanceId;
    }
  | {
      readonly kind: 'instanceDestroyed';
      readonly requestId: string;
      readonly instanceId: EnvironmentInstanceId;
    }
  | {
      readonly kind: 'instancesListed';
      readonly requestId: string;
      readonly instanceIds: readonly EnvironmentInstanceId[];
    }
  | {
      readonly kind: 'commandResult';
      readonly requestId: string;
      readonly instanceId: EnvironmentInstanceId;
      readonly result: RemoteEnvironmentCommandResult;
    }
  | {
      readonly kind: 'error';
      readonly requestId: string;
      readonly message: string;
      readonly instanceId?: EnvironmentInstanceId;
    };

export type RemoteEnvironmentCommandResult =
  | { readonly kind: 'initialized'; readonly info: EnvironmentInfo }
  | { readonly kind: 'resetComplete'; readonly observation: SerializedObservation }
  | { readonly kind: 'stepComplete'; readonly result: SerializedStepResult }
  | { readonly kind: 'stateSaved'; readonly snapshot: SerializedStateSnapshot }
  | { readonly kind: 'stateLoaded' }
  | { readonly kind: 'observation'; readonly observation: SerializedObservation }
  | { readonly kind: 'actionSpace'; readonly actionSpace: ActionSpaceDescriptor }
  | { readonly kind: 'info'; readonly info: EnvironmentInfo }
  | { readonly kind: 'disposed' };

export type SerializedFrameData = {
  readonly dataBase64: string;
  readonly width: number;
  readonly height: number;
};

export type SerializedObservation = {
  readonly frame?: SerializedFrameData;
  readonly state?: Record<string, unknown>;
  readonly step: number;
};

export type SerializedStateSnapshot = {
  readonly envType: string;
  readonly step: number;
  readonly data: Record<string, unknown> | SerializedBinaryBlob;
};

export type SerializedStepResult = {
  readonly observation: SerializedObservation;
  readonly reward: number;
  readonly done: boolean;
  readonly truncated: boolean;
  readonly info: Record<string, unknown>;
};

export type SerializedBinaryBlob = {
  readonly type: 'base64';
  readonly dataBase64: string;
};

let remoteRequestCounter = 0;

export function nextRemoteRequestId(): string {
  return `remote_req_${++remoteRequestCounter}`;
}

export function resetRemoteRequestCounter(): void {
  remoteRequestCounter = 0;
}

export function serializeObservation(observation: Observation): SerializedObservation {
  return {
    step: observation.step,
    state: observation.state,
    frame: observation.frame ? serializeFrameData(observation.frame) : undefined,
  };
}

export function deserializeObservation(observation: SerializedObservation): Observation {
  return {
    step: observation.step,
    state: observation.state,
    frame: observation.frame ? deserializeFrameData(observation.frame) : undefined,
  };
}

export function serializeStepResult(result: StepResult): SerializedStepResult {
  return {
    observation: serializeObservation(result.observation),
    reward: result.reward,
    done: result.done,
    truncated: result.truncated,
    info: result.info,
  };
}

export function deserializeStepResult(result: SerializedStepResult): StepResult {
  return {
    observation: deserializeObservation(result.observation),
    reward: result.reward,
    done: result.done,
    truncated: result.truncated,
    info: result.info,
  };
}

export function serializeStateSnapshot(snapshot: StateSnapshot): SerializedStateSnapshot {
  return {
    envType: snapshot.envType,
    step: snapshot.step,
    data: snapshot.data instanceof ArrayBuffer
      ? serializeBinaryBlob(snapshot.data)
      : snapshot.data,
  };
}

export function deserializeStateSnapshot(snapshot: SerializedStateSnapshot): StateSnapshot {
  return {
    envType: snapshot.envType,
    step: snapshot.step,
    data: isSerializedBinaryBlob(snapshot.data)
      ? deserializeBinaryBlob(snapshot.data)
      : snapshot.data,
  };
}

export function serializeFrameData(frame: FrameData): SerializedFrameData {
  return {
    dataBase64: bytesToBase64(frame.data),
    width: frame.width,
    height: frame.height,
  };
}

export function deserializeFrameData(frame: SerializedFrameData): FrameData {
  return {
    data: base64ToUint8ClampedArray(frame.dataBase64),
    width: frame.width,
    height: frame.height,
  };
}

export function serializeBinaryBlob(buffer: ArrayBuffer): SerializedBinaryBlob {
  return {
    type: 'base64',
    dataBase64: bytesToBase64(new Uint8Array(buffer)),
  };
}

export function deserializeBinaryBlob(blob: SerializedBinaryBlob): ArrayBuffer {
  const bytes = base64ToUint8Array(blob.dataBase64);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function isSerializedBinaryBlob(value: unknown): value is SerializedBinaryBlob {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'type' in value &&
      'dataBase64' in value &&
      (value as { type?: unknown }).type === 'base64',
  );
}

function bytesToBase64(bytes: Uint8Array | Uint8ClampedArray): string {
  const normalizedBytes = toUint8Array(bytes);
  const runtimeBuffer = getRuntimeBuffer();
  if (runtimeBuffer) {
    return runtimeBuffer.from(normalizedBytes).toString('base64');
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < normalizedBytes.length; i += 3) {
    const byte1 = normalizedBytes[i]!;
    const byte2 = normalizedBytes[i + 1];
    const byte3 = normalizedBytes[i + 2];

    const chunk = (byte1 << 16) | ((byte2 ?? 0) << 8) | (byte3 ?? 0);

    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    output += byte2 === undefined ? '=' : alphabet[(chunk >> 6) & 63];
    output += byte3 === undefined ? '=' : alphabet[chunk & 63];
  }

  return output;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const runtimeBuffer = getRuntimeBuffer();
  if (runtimeBuffer) {
    return new Uint8Array(runtimeBuffer.from(base64, 'base64'));
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleaned = base64.replace(/=+$/, '');
  const outputLength = Math.floor((cleaned.length * 3) / 4);
  const bytes = new Uint8Array(outputLength);
  let byteIndex = 0;

  for (let i = 0; i < cleaned.length; i += 4) {
    const sextet1 = alphabet.indexOf(cleaned[i]!);
    const sextet2 = alphabet.indexOf(cleaned[i + 1]!);
    const sextet3 = cleaned[i + 2] ? alphabet.indexOf(cleaned[i + 2]!) : 0;
    const sextet4 = cleaned[i + 3] ? alphabet.indexOf(cleaned[i + 3]!) : 0;

    const chunk = (sextet1 << 18) | (sextet2 << 12) | (sextet3 << 6) | sextet4;

    if (byteIndex < outputLength) bytes[byteIndex++] = (chunk >> 16) & 255;
    if (byteIndex < outputLength) bytes[byteIndex++] = (chunk >> 8) & 255;
    if (byteIndex < outputLength) bytes[byteIndex++] = chunk & 255;
  }
  return bytes;
}

function base64ToUint8ClampedArray(base64: string): Uint8ClampedArray {
  const bytes = base64ToUint8Array(base64);
  return new Uint8ClampedArray(copyToArrayBuffer(bytes));
}

function toUint8Array(bytes: Uint8Array | Uint8ClampedArray): Uint8Array {
  if (bytes instanceof Uint8Array) {
    return bytes;
  }

  return new Uint8Array(copyToArrayBuffer(bytes));
}

function copyToArrayBuffer(bytes: Uint8Array | Uint8ClampedArray): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return arrayBuffer;
}

function getRuntimeBuffer():
  | { from(data: Uint8Array | string, encoding?: string): Uint8Array & { toString(encoding: string): string } }
  | undefined {
  const runtime = globalThis as typeof globalThis & {
    Buffer?: { from(data: Uint8Array | string, encoding?: string): Uint8Array & { toString(encoding: string): string } };
  };
  return runtime.Buffer;
}
