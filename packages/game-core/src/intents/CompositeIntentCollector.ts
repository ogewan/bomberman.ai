/**
 * CompositeIntentCollector — combines multiple intent collectors.
 * Each collector is responsible for its own set of actor IDs.
 * Merges all collected intents into a single list per tick.
 */

import type { ActorIntent, WorldSnapshot } from '@bomberman65/shared';
import type { IntentCollector } from './IntentCollector.js';

export class CompositeIntentCollector implements IntentCollector {
  private collectors: IntentCollector[];

  constructor(collectors: IntentCollector[]) {
    this.collectors = collectors;
  }

  collectIntents(snapshot: WorldSnapshot): ActorIntent[] {
    const allIntents: ActorIntent[] = [];
    for (const collector of this.collectors) {
      allIntents.push(...collector.collectIntents(snapshot));
    }
    return allIntents;
  }

  /** Add a collector to the composite. */
  addCollector(collector: IntentCollector): void {
    this.collectors.push(collector);
  }
}
