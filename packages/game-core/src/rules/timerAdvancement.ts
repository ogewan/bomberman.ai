/**
 * timerAdvancement — advances all entity timers by 1 tick.
 *
 * Timers advanced:
 * - Actor stun timer
 * - Actor shield timer
 * - Bomb fuse timer
 * - Surface travel phase timer
 * - Thrown travel phase timer
 * - Explosion duration timer
 */

import type { ActorState, BombState, WorldSnapshot } from '@bomberman65/shared';

export function advanceTimers(snapshot: WorldSnapshot): void {
  advanceActorTimers(snapshot);
  advanceBombTimers(snapshot);
}

function advanceActorTimers(snapshot: WorldSnapshot): void {
  for (const actor of Object.values(snapshot.actors) as ActorState[]) {
    if (actor.state.kind === 'eliminated') continue;

    // Stun countdown
    if (actor.stunTicksRemaining > 0) {
      actor.stunTicksRemaining--;
    }

    // Shield countdown
    if (actor.shieldTicksRemaining > 0) {
      actor.shieldTicksRemaining--;
    }

    // Phase timer for surface travel
    if (actor.state.kind === 'surfaceTravel') {
      actor.state.phaseTicksElapsed++;
    }

    // Phase timer for thrown travel
    if (actor.state.kind === 'thrownTravel') {
      actor.state.phaseTicksElapsed++;
    }
  }
}

function advanceBombTimers(snapshot: WorldSnapshot): void {
  for (const bomb of Object.values(snapshot.bombs) as BombState[]) {
    if (bomb.state.kind === 'removed') continue;

    // Fuse countdown (ticks down even while held or thrown)
    if (bomb.state.kind !== 'exploding' && bomb.fuseTicksRemaining > 0) {
      bomb.fuseTicksRemaining--;
    }

    // Phase timer for surface travel (kicked)
    if (bomb.state.kind === 'surfaceTravel') {
      bomb.state.phaseTicksElapsed++;
    }

    // Phase timer for thrown travel
    if (bomb.state.kind === 'thrownTravel') {
      bomb.state.phaseTicksElapsed++;
    }

    // Explosion duration countdown
    if (bomb.state.kind === 'exploding') {
      bomb.state.ticksRemaining--;
    }
  }
}
