import { describe, expect, it } from 'vitest';

import {
  deserializeFrameData,
  deserializeStateSnapshot,
  serializeFrameData,
  serializeStateSnapshot,
} from './RemoteEnvironmentProtocol.js';

describe('RemoteEnvironmentProtocol', () => {
  it('round-trips frame data through base64 serialization', () => {
    const original = {
      data: new Uint8ClampedArray([0, 127, 255, 64]),
      width: 1,
      height: 1,
    };

    const serialized = serializeFrameData(original);
    const restored = deserializeFrameData(serialized);

    expect(restored.width).toBe(1);
    expect(restored.height).toBe(1);
    expect([...restored.data]).toEqual([0, 127, 255, 64]);
  });

  it('round-trips binary state snapshots', () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const serialized = serializeStateSnapshot({
      envType: 'n64wasm',
      step: 42,
      data: buffer,
    });
    const restored = deserializeStateSnapshot(serialized);

    expect(restored.envType).toBe('n64wasm');
    expect(restored.step).toBe(42);
    expect([...new Uint8Array(restored.data as ArrayBuffer)]).toEqual([1, 2, 3, 4]);
  });
});
