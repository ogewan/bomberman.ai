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
  MatchConfig,
  WorldSnapshot,
} from '@bomberman65/shared';
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

    const dest = getNeighbor(actor.cell, intent.direction);

    // Check destination validity — if blocked, actor turns but doesn't move
    if (!isInBounds(snapshot, dest)) continue;
    const destCell = getCell(snapshot, dest);
    if (!destCell) continue;
    if (isBlockingTerrain(destCell)) continue;
    if (destCell.occupant) continue;

    // TODO: ramp traversal rules (check entry/exit validity)

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

      // Continue sliding in same direction
      const nextDest = getNeighbor(bomb.state.to, bomb.state.direction);
      const nextCell = getCell(snapshot, nextDest);

      if (
        !nextCell ||
        isBlockingTerrain(nextCell) ||
        nextCell.occupant ||
        !isInBounds(snapshot, nextDest)
      ) {
        // Can't continue — stop
        bomb.state = { kind: 'idle' };
      } else {
        // Continue kicked travel
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

import type { Cell } from '@bomberman65/shared';

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
