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

import type { ActorState, BombState, WorldSnapshot, Vec3i } from '@bomberman65/shared';
import { BOUNCE_CHAIN_EXTRA, DIRECTION_TO_VECTOR, OPPOSITE_DIRECTION } from '@bomberman65/shared';
import type { Direction2D } from '@bomberman65/shared';
import { getCell, isInBounds, isBlockingTerrain, setOccupant } from '../world/gridHelpers.js';

/** Resolve thrown travel for all actors and bombs. */
export function resolveThrownTravel(snapshot: WorldSnapshot): void {
  resolveActorThrownTravel(snapshot);
  resolveBombThrownTravel(snapshot);
}

function resolveActorThrownTravel(snapshot: WorldSnapshot): void {
  for (const actor of Object.values(snapshot.actors) as ActorState[]) {
    if (actor.state.kind !== 'thrownTravel') continue;
    if (actor.state.phaseTicksElapsed < actor.state.phaseTicksTotal) continue;

    resolveThrownLanding(snapshot, actor);
  }
}

function resolveBombThrownTravel(snapshot: WorldSnapshot): void {
  for (const bomb of Object.values(snapshot.bombs) as BombState[]) {
    if (bomb.state.kind !== 'thrownTravel') continue;
    if (bomb.state.phaseTicksElapsed < bomb.state.phaseTicksTotal) continue;

    resolveThrownBombLanding(snapshot, bomb);
  }
}

function resolveThrownLanding(snapshot: WorldSnapshot, actor: ActorState): void {
  if (actor.state.kind !== 'thrownTravel') return;

  const bounceLimit = Math.max(snapshot.size.x, snapshot.size.y) + BOUNCE_CHAIN_EXTRA;

  let dest = actor.state.to;
  let direction = actor.state.direction;
  let remaining = actor.state.remainingDistance;
  let bounces = 0;

  while (bounces < bounceLimit) {
    const destCell = getCell(snapshot, dest);

    if (!destCell || !isInBounds(snapshot, dest) || isBlockingTerrain(destCell)) {
      // Bounce — reverse direction
      direction = OPPOSITE_DIRECTION[direction];
      dest = applyDirection(actor.state.from, direction);
      remaining--;
      bounces++;
      continue;
    }

    if (destCell.occupant) {
      // Occupied — bounce
      direction = OPPOSITE_DIRECTION[direction];
      dest = applyDirection(dest, direction);
      remaining--;
      bounces++;
      continue;
    }

    // Valid landing — place entity
    actor.cell = { ...dest };
    setOccupant(snapshot, dest, { kind: 'actor', id: actor.id });
    actor.state = { kind: 'idle' };

    // Check support — if unsupported, will be handled by falling logic
    return;
  }

  // Exceeded bounce cap — entity is out of bounds, eliminate
  actor.state = { kind: 'eliminated' };
}

function resolveThrownBombLanding(snapshot: WorldSnapshot, bomb: BombState): void {
  if (bomb.state.kind !== 'thrownTravel') return;

  const bounceLimit = Math.max(snapshot.size.x, snapshot.size.y) + BOUNCE_CHAIN_EXTRA;

  let dest = bomb.state.to;
  let direction = bomb.state.direction;
  let bounces = 0;

  while (bounces < bounceLimit) {
    const destCell = getCell(snapshot, dest);

    if (!destCell || !isInBounds(snapshot, dest) || isBlockingTerrain(destCell)) {
      direction = OPPOSITE_DIRECTION[direction];
      dest = applyDirection(bomb.state.from, direction);
      bounces++;
      continue;
    }

    if (destCell.occupant) {
      direction = OPPOSITE_DIRECTION[direction];
      dest = applyDirection(dest, direction);
      bounces++;
      continue;
    }

    // Valid landing
    bomb.cell = { ...dest };
    setOccupant(snapshot, dest, { kind: 'bomb', id: bomb.id });
    bomb.state = { kind: 'idle' };
    return;
  }

  // Exceeded bounce cap — remove bomb
  bomb.state = { kind: 'removed' };
}

function applyDirection(pos: Vec3i, direction: Direction2D): Vec3i {
  const vec = DIRECTION_TO_VECTOR[direction];
  return { x: pos.x + vec.dx, y: pos.y + vec.dy, z: pos.z };
}
