/**
 * movementResolution — applies validated move intents and resolves surface travel phases.
 *
 * Movement model:
 * - Surface travel has two phases: leaving (entity at source) and entering (entity at destination)
 * - Duration split: leaving = floor(duration/2), entering = ceil(duration/2)
 * - Collision is checked at the leaving→entering boundary
 * - During leaving, entity is considered at source cell
 * - During entering, entity is considered at destination cell
 */

import type {
  ActorIntent,
  ActorState,
  BombState,
  Cell,
  MatchConfig,
  Vec3i,
  WorldSnapshot,
} from '@bomberman65/shared';
import { OPPOSITE_DIRECTION, type Direction2D } from '@bomberman65/shared';
import {
  getCell,
  getNeighbor,
  isInBounds,
  isBlockingTerrain,
  clearOccupant,
  setOccupant,
} from '../world/gridHelpers.js';

/** Apply validated move intents — start surface travel for idle actors. */
export function applyMoveIntents(
  snapshot: WorldSnapshot,
  intents: ActorIntent[],
  config: MatchConfig,
): void {
  for (const intent of intents) {
    if (intent.kind !== 'move') continue;
    const actor = snapshot.actors[intent.actorId] as ActorState | undefined;
    if (!actor || actor.state.kind !== 'idle') continue;

    // Always update facing direction, even if movement is blocked
    actor.facing = intent.direction;

    // Resolve destination with ramp traversal rules (entry/exit validity, z adjustment)
    const dest = resolveMovementDestination(snapshot, actor.cell, intent.direction);
    if (!dest) continue;

    // Start surface travel
    const totalTicks = config.actorMoveTicks;
    const leavingTicks = Math.floor(totalTicks / 2);

    actor.state = {
      kind: 'surfaceTravel',
      mode: 'walk',
      from: { ...actor.cell },
      to: { ...dest },
      phase: 'leaving',
      phaseTicksElapsed: 0,
      phaseTicksTotal: leavingTicks,
    };
  }
}

/** Resolve completed phase boundaries for actors and bombs in surface travel. */
export function resolveSurfaceTravelPhases(snapshot: WorldSnapshot, config: MatchConfig): void {
  resolveActorSurfaceTravel(snapshot, config);
  resolveBombSurfaceTravel(snapshot, config);
}

function resolveActorSurfaceTravel(snapshot: WorldSnapshot, config: MatchConfig): void {
  for (const actor of Object.values(snapshot.actors) as ActorState[]) {
    if (actor.state.kind !== 'surfaceTravel') continue;

    const { phase, phaseTicksElapsed, phaseTicksTotal } = actor.state;

    if (phaseTicksElapsed < phaseTicksTotal) continue;

    if (phase === 'leaving') {
      // Transition leaving → entering: check destination collision
      const destCell = getCell(snapshot, actor.state.to);
      if (!destCell || destCell.occupant || isBlockingTerrain(destCell)) {
        // Blocked — return to idle at source
        actor.state = { kind: 'idle' };
        continue;
      }

      // Capture from/to before state changes
      const fromCell = actor.state.from;
      const toCell = actor.state.to;

      // Transfer occupancy: leave source, enter destination
      clearOccupant(snapshot, fromCell);

      // If a bomb exists at the source cell, it becomes the occupant now that the actor left
      const bombAtSource = Object.values(snapshot.bombs).find(
        (b) =>
          (b as BombState).cell.x === fromCell.x &&
          (b as BombState).cell.y === fromCell.y &&
          (b as BombState).cell.z === fromCell.z &&
          (b as BombState).state.kind !== 'removed' &&
          (b as BombState).state.kind !== 'exploding' &&
          (b as BombState).state.kind !== 'held' &&
          (b as BombState).state.kind !== 'thrownTravel',
      ) as BombState | undefined;
      if (bombAtSource) {
        setOccupant(snapshot, fromCell, { kind: 'bomb', id: bombAtSource.id });
      }

      setOccupant(snapshot, toCell, { kind: 'actor', id: actor.id });
      actor.cell = { ...toCell };
      actor.lastMoveDirection = actor.facing;

      // Collect item if present
      if (destCell.item) {
        collectItem(actor, destCell, config);
      }

      // Start entering phase
      const totalTicks = actor.state.phaseTicksTotal * 2; // Reconstruct total from leaving
      const enteringTicks = Math.ceil(totalTicks / 2);
      actor.state = {
        ...actor.state,
        phase: 'entering',
        phaseTicksElapsed: 0,
        phaseTicksTotal: enteringTicks,
      };
    } else if (phase === 'entering') {
      // Entering complete — return to idle
      actor.state = { kind: 'idle' };
    }
  }
}

function resolveBombSurfaceTravel(snapshot: WorldSnapshot, config: MatchConfig): void {
  for (const bomb of Object.values(snapshot.bombs) as BombState[]) {
    if (bomb.state.kind !== 'surfaceTravel') continue;

    const { phase, phaseTicksElapsed, phaseTicksTotal } = bomb.state;

    if (phaseTicksElapsed < phaseTicksTotal) continue;

    if (phase === 'leaving') {
      // Check destination
      const destCell = getCell(snapshot, bomb.state.to);
      if (!destCell || isBlockingTerrain(destCell)) {
        // Blocked — stop at source
        bomb.state = { kind: 'idle' };
        continue;
      }

      if (destCell.occupant) {
        // Kicked bomb hitting an actor applies stun
        if (destCell.occupant.kind === 'actor') {
          const hitActor = snapshot.actors[destCell.occupant.id] as ActorState | undefined;
          if (hitActor && hitActor.state.kind !== 'eliminated' && hitActor.shieldTicksRemaining <= 0) {
            hitActor.stunTicksRemaining = config.stunTicks;
          }
        }
        bomb.state = { kind: 'idle' };
        continue;
      }

      // Transfer occupancy
      clearOccupant(snapshot, bomb.state.from);
      setOccupant(snapshot, bomb.state.to, { kind: 'bomb', id: bomb.id });
      bomb.cell = { ...bomb.state.to };
      bomb.lastMoveDirection = bomb.state.direction;

      // Continue sliding in same direction (ramp-aware)
      const nextDest = resolveKickedBombDestination(snapshot, bomb.cell, bomb.state.direction);

      if (!nextDest) {
        bomb.state = { kind: 'idle' };
      } else {
        const leavingTicks = Math.floor((bomb.state.phaseTicksTotal * 2) / 2);
        bomb.state = {
          kind: 'surfaceTravel',
          mode: 'kicked',
          from: { ...bomb.cell },
          to: { ...nextDest },
          direction: bomb.state.direction,
          phase: 'leaving',
          phaseTicksElapsed: 0,
          phaseTicksTotal: leavingTicks,
        };
      }
    } else if (phase === 'entering') {
      bomb.state = { kind: 'idle' };
    }
  }
}

/**
 * Resolve the movement destination for an actor, accounting for ramp traversal rules.
 *
 * Ramp rules:
 * - On a ramp: can only move in the entry direction (low side, same z) or
 *   exit direction (high side, z + deltaZ). Other directions are blocked.
 * - Entering a ramp from the same z: must approach from the entry side
 *   (move direction is opposite of ramp's entry direction).
 * - Descending onto a ramp from above: must approach from the exit side
 *   (move direction is opposite of ramp's exit direction). Only when no
 *   walkable cell exists at the same z.
 */
function resolveMovementDestination(
  snapshot: WorldSnapshot,
  from: Vec3i,
  direction: Direction2D,
): Vec3i | null {
  const srcCell = getCell(snapshot, from);
  if (!srcCell) return null;

  // Case 1: Actor is ON a ramp — restricted to entry/exit directions
  if (srcCell.terrain === 'ramp' && srcCell.ramp) {
    const ramp = srcCell.ramp;
    if (direction === ramp.entry) {
      // Leaving from entry (low) side — same z
      const dest = getNeighbor(from, direction);
      return isValidMoveDest(snapshot, dest) ? dest : null;
    }
    if (direction === ramp.exit) {
      // Leaving from exit (high) side — z + deltaZ
      const neighbor = getNeighbor(from, direction);
      const dest: Vec3i = { x: neighbor.x, y: neighbor.y, z: neighbor.z + ramp.deltaZ };
      return isValidMoveDest(snapshot, dest) ? dest : null;
    }
    // All other directions blocked while on a ramp
    return null;
  }

  // Case 2: Actor is NOT on a ramp — check flat destination
  const flatDest = getNeighbor(from, direction);

  if (isInBounds(snapshot, flatDest)) {
    const destCell = getCell(snapshot, flatDest);
    if (destCell) {
      if (destCell.terrain === 'ramp' && destCell.ramp) {
        // Attempting to enter a ramp at the same z-level
        const approachSide = OPPOSITE_DIRECTION[direction];
        if (approachSide === destCell.ramp.entry) {
          // Valid ascending entry from the low side
          return !destCell.occupant ? flatDest : null;
        }
        // Wrong side — block (can't step onto ramp from non-entry side at same z)
        return null;
      }
      // Regular flat movement
      if (!isBlockingTerrain(destCell) && !destCell.occupant) {
        return flatDest;
      }
    }
  }

  // Case 3: Check for descending onto a ramp one level below
  const belowDest: Vec3i = { x: flatDest.x, y: flatDest.y, z: from.z - 1 };
  if (belowDest.z >= 0 && isInBounds(snapshot, belowDest)) {
    const belowCell = getCell(snapshot, belowDest);
    if (belowCell?.terrain === 'ramp' && belowCell.ramp) {
      const approachSide = OPPOSITE_DIRECTION[direction];
      if (approachSide === belowCell.ramp.exit && !belowCell.occupant) {
        // Valid descending entry from the high (exit) side
        return belowDest;
      }
    }
  }

  return null;
}

/** Check if a position is a valid movement destination (in bounds, not blocking, not occupied). */
function isValidMoveDest(snapshot: WorldSnapshot, pos: Vec3i): boolean {
  if (!isInBounds(snapshot, pos)) return false;
  const cell = getCell(snapshot, pos);
  if (!cell) return false;
  if (isBlockingTerrain(cell)) return false;
  if (cell.occupant) return false;
  return true;
}

/**
 * Resolve the next destination for a kicked bomb, accounting for ramp traversal.
 * Similar to actor ramp logic but bombs slide continuously in one direction.
 */
export function resolveKickedBombDestination(
  snapshot: WorldSnapshot,
  from: Vec3i,
  direction: Direction2D,
): Vec3i | null {
  const srcCell = getCell(snapshot, from);
  if (!srcCell) return null;

  // On a ramp: bomb can only continue if kick direction matches entry or exit
  if (srcCell.terrain === 'ramp' && srcCell.ramp) {
    if (direction === srcCell.ramp.entry) {
      const dest = getNeighbor(from, direction);
      return isValidMoveDest(snapshot, dest) ? dest : null;
    }
    if (direction === srcCell.ramp.exit) {
      const neighbor = getNeighbor(from, direction);
      const dest: Vec3i = { x: neighbor.x, y: neighbor.y, z: neighbor.z + srcCell.ramp.deltaZ };
      return isValidMoveDest(snapshot, dest) ? dest : null;
    }
    return null;
  }

  // Not on a ramp: check flat destination
  const flatDest = getNeighbor(from, direction);

  if (isInBounds(snapshot, flatDest)) {
    const destCell = getCell(snapshot, flatDest);
    if (destCell) {
      if (destCell.terrain === 'ramp' && destCell.ramp) {
        const approachSide = OPPOSITE_DIRECTION[direction];
        if (approachSide === destCell.ramp.entry) {
          return !destCell.occupant ? flatDest : null;
        }
        return null;
      }
      if (!isBlockingTerrain(destCell) && !destCell.occupant) {
        return flatDest;
      }
    }
  }

  // Check descending onto a ramp below
  const belowDest: Vec3i = { x: flatDest.x, y: flatDest.y, z: from.z - 1 };
  if (belowDest.z >= 0 && isInBounds(snapshot, belowDest)) {
    const belowCell = getCell(snapshot, belowDest);
    if (belowCell?.terrain === 'ramp' && belowCell.ramp) {
      const approachSide = OPPOSITE_DIRECTION[direction];
      if (approachSide === belowCell.ramp.exit && !belowCell.occupant) {
        return belowDest;
      }
    }
  }

  return null;
}

function collectItem(actor: ActorState, cell: Cell, config: MatchConfig): void {
  if (!cell.item) return;

  switch (cell.item) {
    case 'power':
      actor.power++;
      break;
    case 'count':
      actor.count++;
      break;
    case 'upgrade-kick':
      actor.upgrade = 'kick';
      break;
    case 'upgrade-carryPump':
      actor.upgrade = 'carryPump';
      break;
    case 'upgrade-shield':
      actor.upgrade = 'shield';
      actor.shieldTicksRemaining = config.shieldTicks;
      break;
  }

  cell.item = undefined;
}
