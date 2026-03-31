/**
 * ReplayIntentCollector — provides intents from a replay log for playback.
 * Used when the SimulationRunner is in replay mode.
 */

import type { ActorIntent, WorldSnapshot } from '@bomberman65/shared';
import type { IntentCollector } from '../intents/IntentCollector.js';
import type { ReplayLog } from './ReplayRecorder.js';

export class ReplayIntentCollector implements IntentCollector {
  private log: ReplayLog;

  constructor(log: ReplayLog) {
    this.log = log;
  }

  collectIntents(snapshot: WorldSnapshot): ActorIntent[] {
    const entry = this.log.entries[snapshot.tick];
    if (!entry) return [];
    return entry.intents as ActorIntent[];
  }
}
