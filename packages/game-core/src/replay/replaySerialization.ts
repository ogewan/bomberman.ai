/**
 * replaySerialization — import/export replay logs as JSON.
 *
 * For v0, portability is prioritized over minimal file size.
 * The initial snapshot is embedded for portability.
 */

import type { ReplayLog } from './ReplayRecorder.js';

/** Serialize a ReplayLog to a JSON string. */
export function serializeReplayLog(log: ReplayLog): string {
  return JSON.stringify(log, null, 2);
}

/** Deserialize a ReplayLog from a JSON string. Throws on invalid data. */
export function deserializeReplayLog(json: string): ReplayLog {
  const parsed = JSON.parse(json) as ReplayLog;

  // Basic structural validation
  if (!parsed.replayId || typeof parsed.replayId !== 'string') {
    throw new Error('Invalid replay: missing replayId');
  }
  if (!parsed.mapId || typeof parsed.mapId !== 'string') {
    throw new Error('Invalid replay: missing mapId');
  }
  if (!parsed.config) {
    throw new Error('Invalid replay: missing config');
  }
  if (!parsed.initialSnapshot) {
    throw new Error('Invalid replay: missing initialSnapshot');
  }
  if (!Array.isArray(parsed.entries)) {
    throw new Error('Invalid replay: missing entries array');
  }
  if (!Array.isArray(parsed.checkpoints)) {
    throw new Error('Invalid replay: missing checkpoints array');
  }

  return parsed;
}
