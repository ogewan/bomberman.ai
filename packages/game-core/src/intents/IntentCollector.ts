/**
 * IntentCollector — interface for gathering actor intents each tick.
 * Implementations will come from player input, bot AI, or replay playback.
 */

import type { ActorIntent, WorldSnapshot } from '@bomberman65/shared';

/** Provides intents for actors on a given tick. */
export interface IntentCollector {
  /**
   * Collect intents for all actors that should act this tick.
   * Implementations may be async (e.g. waiting for player input) or sync (bots, replay).
   */
  collectIntents(snapshot: WorldSnapshot): ActorIntent[];
}

/** No-op intent collector that returns idle intents for all actors. */
export class IdleIntentCollector implements IntentCollector {
  collectIntents(snapshot: WorldSnapshot): ActorIntent[] {
    return Object.keys(snapshot.actors).map((actorId) => ({
      kind: 'idle' as const,
      actorId,
    }));
  }
}
