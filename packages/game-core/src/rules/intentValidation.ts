/**
 * intentValidation — validates actor intents against simulation preconditions.
 *
 * Preconditions checked:
 * - Actor must exist and not be eliminated
 * - Actor must be able to act (not stunned, not held)
 * - Move direction must lead to a valid destination
 * - Bomb placement requires count not exceeded
 * - Kick/pickup/pump/throw require correct upgrade
 */

import type { ActorIntent, ActorState, WorldSnapshot } from '@bomberman65/shared';

/** Filter intents to only those that pass precondition checks. */
export function validateIntents(snapshot: WorldSnapshot, intents: ActorIntent[]): ActorIntent[] {
  const valid: ActorIntent[] = [];

  for (const intent of intents) {
    const actor = snapshot.actors[intent.actorId] as ActorState | undefined;
    if (!actor) continue;
    if (!canAct(actor)) continue;

    if (isIntentValid(intent, actor, snapshot)) {
      valid.push(intent);
    }
  }

  return valid;
}

function canAct(actor: ActorState): boolean {
  if (actor.state.kind === 'eliminated') return false;
  if (actor.state.kind === 'held') return false;
  if (actor.stunTicksRemaining > 0) return false;
  // Actors in motion cannot initiate new actions
  if (actor.state.kind === 'surfaceTravel') return false;
  if (actor.state.kind === 'thrownTravel') return false;
  return true;
}

function isIntentValid(intent: ActorIntent, actor: ActorState, snapshot: WorldSnapshot): boolean {
  switch (intent.kind) {
    case 'idle':
      return true;

    case 'move':
      return true; // Direction validity checked during resolution

    case 'placeBomb': {
      // Count check: active bombs owned by this actor must be < actor.count
      const activeBombs = Object.values(snapshot.bombs).filter(
        (b) =>
          (b as { ownerActorId: string }).ownerActorId === actor.id &&
          (b as { state: { kind: string } }).state.kind !== 'removed' &&
          (b as { state: { kind: string } }).state.kind !== 'exploding',
      ).length;
      return activeBombs < actor.count;
    }

    case 'kick':
      return actor.upgrade === 'kick';

    case 'pickup':
      return actor.upgrade === 'carryPump';

    case 'pump':
      return actor.upgrade === 'carryPump';

    case 'throw':
      return actor.upgrade === 'carryPump' || actor.upgrade === 'kick';

    default:
      return false;
  }
}
