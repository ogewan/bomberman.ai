/**
 * thrownTravelResolution — resolves thrown entity travel phases.
 *
 * Thrown travel rules:
 * - Thrown entities occupy no cell while traveling
 * - Collision tested when leaving phase expires
 * - Bounce chaining resolves in same simulation step
 * - Bounce cap = at least mapSize + 10
 * - Fall after throw only after entity enters a cell lacking support below
 * - Thrown bomb fuse is independent of travel duration
 * - z only changes after higher-z collision step resolves
 */

import type { ActorState, BombState, MatchConfig, WorldSnapshot, Vec3i } from '@bomberman65/shared';
import { BOUNCE_CHAIN_EXTRA, DIRECTION_TO_VECTOR } from '@bomberman65/shared';
// OPPOSITE_DIRECTION removed — bounces continue forward, not reverse
import type { Direction2D } from '@bomberman65/shared';
import { getCell, isInBounds, isBlockingTerrain, setOccupant } from '../world/gridHelpers.js';

/** Resolve thrown travel for all actors and bombs. */
export function resolveThrownTravel(snapshot: WorldSnapshot, config: MatchConfig): void {
  resolveActorThrownTravel(snapshot, config);
  resolveBombThrownTravel(snapshot, config);
}

function resolveActorThrownTravel(snapshot: WorldSnapshot, config: MatchConfig): void {
  for (const actor of Object.values(snapshot.actors) as ActorState[]) {
    if (actor.state.kind !== 'thrownTravel') continue;
    if (actor.state.phaseTicksElapsed < actor.state.phaseTicksTotal) continue;

    resolveThrownLanding(snapshot, actor, config);
  }
}

function resolveBombThrownTravel(snapshot: WorldSnapshot, config: MatchConfig): void {
  for (const bomb of Object.values(snapshot.bombs) as BombState[]) {
    if (bomb.state.kind !== 'thrownTravel') continue;
    if (bomb.state.phaseTicksElapsed < bomb.state.phaseTicksTotal) continue;

    resolveThrownBombLanding(snapshot, bomb, config);
  }
}

function resolveThrownLanding(snapshot: WorldSnapshot, actor: ActorState, config: MatchConfig): void {
  if (actor.state.kind !== 'thrownTravel') return;

  const bounceLimit = Math.max(snapshot.size.x, snapshot.size.y) + BOUNCE_CHAIN_EXTRA;

  let pos = actor.state.from;
  let direction = actor.state.direction;
  let remaining = actor.state.remainingDistance;
  let bounces = 0;

  while (remaining > 0 && bounces < bounceLimit) {
    const next = applyDirection(pos, direction);
    const nextCell = getCell(snapshot, next);

    if (!nextCell || !isInBounds(snapshot, next) || isBlockingTerrain(nextCell)) {
      // Check z+1 landing on top of blocking terrain
      const above = { x: next.x, y: next.y, z: next.z + 1 };
      const aboveCell = getCell(snapshot, above);
      if (
        aboveCell &&
        !isBlockingTerrain(aboveCell) &&
        !aboveCell.occupant &&
        isInBounds(snapshot, above)
      ) {
        actor.cell = { ...above };
        setOccupant(snapshot, above, { kind: 'actor', id: actor.id });
        actor.lastMoveDirection = direction;
        actor.state = { kind: 'idle' };
        return;
      }

      // Skip over blocking terrain — continue forward
      remaining--;
      bounces++;
      continue;
    }

    if (nextCell.occupant) {
      // Stun actor occupants
      if (nextCell.occupant.kind === 'actor') {
        const hitActor = snapshot.actors[nextCell.occupant.id] as ActorState | undefined;
        if (hitActor && hitActor.state.kind !== 'eliminated' && hitActor.shieldTicksRemaining <= 0) {
          hitActor.stunTicksRemaining = config.stunTicks;
        }
      }
      // Skip over occupant — continue forward
      remaining--;
      bounces++;
      continue;
    }

    // Empty cell — advance through it
    pos = next;
    remaining--;
  }

  // Land at final position
  const landCell = getCell(snapshot, pos);
  if (landCell && !landCell.occupant && isInBounds(snapshot, pos)) {
    actor.cell = { ...pos };
    setOccupant(snapshot, pos, { kind: 'actor', id: actor.id });
    actor.lastMoveDirection = direction;
    actor.state = { kind: 'idle' };
  } else {
    // Can't land — eliminate
    actor.state = { kind: 'eliminated' };
  }
}

function resolveThrownBombLanding(snapshot: WorldSnapshot, bomb: BombState, config: MatchConfig): void {
  if (bomb.state.kind !== 'thrownTravel') return;

  const bounceLimit = Math.max(snapshot.size.x, snapshot.size.y) + BOUNCE_CHAIN_EXTRA;

  let pos = bomb.state.from;
  let direction = bomb.state.direction;
  let remaining = bomb.state.remainingDistance;
  let bounces = 0;

  while (remaining > 0 && bounces < bounceLimit) {
    const next = applyDirection(pos, direction);
    const nextCell = getCell(snapshot, next);

    if (!nextCell || !isInBounds(snapshot, next) || isBlockingTerrain(nextCell)) {
      // Check z+1 landing on top of blocking terrain
      const above = { x: next.x, y: next.y, z: next.z + 1 };
      const aboveCell = getCell(snapshot, above);
      if (
        aboveCell &&
        !isBlockingTerrain(aboveCell) &&
        !aboveCell.occupant &&
        isInBounds(snapshot, above)
      ) {
        bomb.cell = { ...above };
        setOccupant(snapshot, above, { kind: 'bomb', id: bomb.id });
        bomb.lastMoveDirection = direction;
        bomb.state = { kind: 'idle' };
        return;
      }

      // Skip over blocking terrain — continue forward
      remaining--;
      bounces++;
      continue;
    }

    if (nextCell.occupant) {
      // Stun actor occupants
      if (nextCell.occupant.kind === 'actor') {
        const hitActor = snapshot.actors[nextCell.occupant.id] as ActorState | undefined;
        if (hitActor && hitActor.state.kind !== 'eliminated' && hitActor.shieldTicksRemaining <= 0) {
          hitActor.stunTicksRemaining = config.stunTicks;
        }
      }
      // Skip over occupant — continue forward
      remaining--;
      bounces++;
      continue;
    }

    // Empty cell — advance through it
    pos = next;
    remaining--;
  }

  // Land at final position
  const landCell = getCell(snapshot, pos);
  if (landCell && !landCell.occupant && isInBounds(snapshot, pos)) {
    bomb.cell = { ...pos };
    setOccupant(snapshot, pos, { kind: 'bomb', id: bomb.id });
    bomb.lastMoveDirection = direction;
    bomb.state = { kind: 'idle' };
  } else {
    bomb.state = { kind: 'removed' };
  }
}

function applyDirection(pos: Vec3i, direction: Direction2D): Vec3i {
  const vec = DIRECTION_TO_VECTOR[direction];
  return { x: pos.x + vec.dx, y: pos.y + vec.dy, z: pos.z };
}
