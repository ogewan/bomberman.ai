/**
 * KeyboardIntentCollector — maps keyboard input to actor intents for a single player.
 *
 * Key bindings:
 *   WASD / Arrow keys — move in cardinal directions
 *   Space — place bomb
 *   E — pickup / pump (context-dependent)
 *   Q — throw held entity in facing direction
 *   F — kick bomb in facing direction
 *
 * Note: This collector uses string-based key tracking to avoid DOM type
 * dependencies in game-core. The attach/detach methods accept any object
 * with addEventListener/removeEventListener.
 */

import type { ActorIntent, ActorState, WorldSnapshot, Direction2D } from '@bomberman65/shared';
import type { IntentCollector } from './IntentCollector.js';

// Grid convention: y increases downward, so visual "up" on screen = north (dy=-1).
// Camera looks from negative-y toward positive-y, so screen-up = grid-north.
// W/ArrowUp = north (toward y=0), S/ArrowDown = south (toward y=max).
const KEY_TO_DIRECTION: Record<string, Direction2D> = {
  w: 'south',
  a: 'west',
  s: 'north',
  d: 'east',
  ArrowUp: 'south',
  ArrowDown: 'north',
  ArrowLeft: 'west',
  ArrowRight: 'east',
};

const BOMB_KEYS = new Set([' ', 'Space']);
const PICKUP_PUMP_KEYS = new Set(['e', 'E']);
const THROW_KEYS = new Set(['q', 'Q']);
const KICK_KEYS = new Set(['f', 'F']);

/** Minimal event target interface — avoids DOM dependency. */
interface KeyEventTarget {
  addEventListener(type: string, listener: (e: { key: string }) => void): void;
  removeEventListener(type: string, listener: (e: { key: string }) => void): void;
}

export class KeyboardIntentCollector implements IntentCollector {
  private actorId: string;
  private pressedKeys = new Set<string>();
  private boundKeyDown = (e: { key: string }) => this.pressedKeys.add(e.key);
  private boundKeyUp = (e: { key: string }) => this.pressedKeys.delete(e.key);
  private target: KeyEventTarget | null = null;

  constructor(actorId: string) {
    this.actorId = actorId;
  }

  /** Start listening for keyboard events. */
  attach(target?: KeyEventTarget): void {
    this.target = target ?? (globalThis as unknown as KeyEventTarget);
    this.target.addEventListener('keydown', this.boundKeyDown);
    this.target.addEventListener('keyup', this.boundKeyUp);
  }

  /** Stop listening for keyboard events. */
  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.boundKeyDown);
    this.target.removeEventListener('keyup', this.boundKeyUp);
    this.target = null;
    this.pressedKeys.clear();
  }

  collectIntents(snapshot: WorldSnapshot): ActorIntent[] {
    const intents: ActorIntent[] = [];

    // Movement — first pressed direction key wins
    for (const key of this.pressedKeys) {
      const dir = KEY_TO_DIRECTION[key];
      if (dir) {
        intents.push({ kind: 'move', actorId: this.actorId, direction: dir });
        break;
      }
    }

    // Bomb placement
    for (const key of this.pressedKeys) {
      if (BOMB_KEYS.has(key)) {
        intents.push({ kind: 'placeBomb', actorId: this.actorId });
        break;
      }
    }

    // Pickup / pump
    for (const key of this.pressedKeys) {
      if (PICKUP_PUMP_KEYS.has(key)) {
        intents.push({ kind: 'pickup', actorId: this.actorId });
        intents.push({ kind: 'pump', actorId: this.actorId });
        break;
      }
    }

    // Throw
    for (const key of this.pressedKeys) {
      if (THROW_KEYS.has(key)) {
        intents.push({ kind: 'throw', actorId: this.actorId, direction: this.getFacing(snapshot) });
        break;
      }
    }

    // Kick
    for (const key of this.pressedKeys) {
      if (KICK_KEYS.has(key)) {
        intents.push({ kind: 'kick', actorId: this.actorId, direction: this.getFacing(snapshot) });
        break;
      }
    }

    if (intents.length === 0) {
      intents.push({ kind: 'idle', actorId: this.actorId });
    }

    return intents;
  }

  private getFacing(snapshot: WorldSnapshot): Direction2D {
    const actor = snapshot.actors[this.actorId] as ActorState | undefined;
    return actor?.facing ?? 'south';
  }
}
