/**
 * KeyboardIntentCollector — maps keyboard input to actor intents.
 * Keybinds are configurable via KeybindConfig.
 */

import type { ActorIntent, ActorState, WorldSnapshot, Direction2D } from '@bomberman65/shared';
import { DEFAULT_KEYBINDS, type KeybindConfig } from '@bomberman65/shared';
import type { IntentCollector } from './IntentCollector.js';

/** Minimal event target interface — avoids DOM dependency. */
interface KeyEventTarget {
  addEventListener(type: string, listener: (e: { key: string }) => void): void;
  removeEventListener(type: string, listener: (e: { key: string }) => void): void;
}

export class KeyboardIntentCollector implements IntentCollector {
  private actorId: string;
  private keybinds: KeybindConfig;
  private pressedKeys = new Set<string>();
  private justPressedKeys = new Set<string>();
  private boundKeyDown = (e: { key: string }) => {
    this.pressedKeys.add(e.key);
    this.justPressedKeys.add(e.key);
  };
  private boundKeyUp = (e: { key: string }) => this.pressedKeys.delete(e.key);
  private target: KeyEventTarget | null = null;

  constructor(actorId: string, keybinds?: KeybindConfig) {
    this.actorId = actorId;
    this.keybinds = keybinds ?? DEFAULT_KEYBINDS;
  }

  /** Update keybinds at runtime. */
  setKeybinds(keybinds: KeybindConfig): void {
    this.keybinds = keybinds;
  }

  attach(target?: KeyEventTarget): void {
    this.target = target ?? (globalThis as unknown as KeyEventTarget);
    this.target.addEventListener('keydown', this.boundKeyDown);
    this.target.addEventListener('keyup', this.boundKeyUp);
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.boundKeyDown);
    this.target.removeEventListener('keyup', this.boundKeyUp);
    this.target = null;
    this.pressedKeys.clear();
    this.justPressedKeys.clear();
  }

  collectIntents(snapshot: WorldSnapshot): ActorIntent[] {
    const intents: ActorIntent[] = [];
    const kb = this.keybinds;

    // Movement
    const dir = this.getPressedDirection(kb);
    if (dir) {
      intents.push({ kind: 'move', actorId: this.actorId, direction: dir });
    }

    // Bomb
    if (this.anyPressed(kb.placeBomb)) {
      intents.push({ kind: 'placeBomb', actorId: this.actorId });
    }

    // Pickup / pump — edge-triggered: only fires on fresh key press, not while held
    if (this.anyJustPressed(kb.pickupPump)) {
      const isHolding = Object.values(snapshot.bombs).some(
        (b) =>
          (b as { state: { kind: string; holderActorId?: string } }).state.kind === 'held' &&
          (b as { state: { holderActorId?: string } }).state.holderActorId === this.actorId,
      );
      if (isHolding) {
        intents.push({ kind: 'pump', actorId: this.actorId });
      } else {
        intents.push({ kind: 'pickup', actorId: this.actorId });
      }
    }

    // Throw
    if (this.anyPressed(kb.throw)) {
      intents.push({ kind: 'throw', actorId: this.actorId, direction: this.getFacing(snapshot) });
    }

    // Kick
    if (this.anyPressed(kb.kick)) {
      intents.push({ kind: 'kick', actorId: this.actorId, direction: this.getFacing(snapshot) });
    }

    if (intents.length === 0) {
      intents.push({ kind: 'idle', actorId: this.actorId });
    }

    // Clear edge-triggered keys after consumption
    this.justPressedKeys.clear();

    return intents;
  }

  private getPressedDirection(kb: KeybindConfig): Direction2D | null {
    // Camera convention: W/Up = south (screen up = +y), S/Down = north
    if (this.anyPressed(kb.moveUp)) return 'south';
    if (this.anyPressed(kb.moveDown)) return 'north';
    if (this.anyPressed(kb.moveLeft)) return 'west';
    if (this.anyPressed(kb.moveRight)) return 'east';
    return null;
  }

  private anyPressed(keys: string[]): boolean {
    for (const key of keys) {
      if (this.pressedKeys.has(key)) return true;
    }
    return false;
  }

  private anyJustPressed(keys: string[]): boolean {
    for (const key of keys) {
      if (this.justPressedKeys.has(key)) return true;
    }
    return false;
  }

  private getFacing(snapshot: WorldSnapshot): Direction2D {
    const actor = snapshot.actors[this.actorId] as ActorState | undefined;
    return actor?.facing ?? 'south';
  }
}
