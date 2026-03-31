/**
 * bombActions — handles bomb placement, kick, carry/pickup, pump, and throw actions.
 */

import type {
  ActorIntent,
  ActorState,
  BombState,
  WorldSnapshot,
  Direction2D,
} from '@bomberman65/shared';
import { getCell, getNeighbor, clearOccupant } from '../world/gridHelpers.js';

let bombCounter = 0;

/** Apply all bomb-related intents from the validated intent list. */
export function applyBombIntents(snapshot: WorldSnapshot, intents: ActorIntent[]): void {
  for (const intent of intents) {
    const actor = snapshot.actors[intent.actorId] as ActorState | undefined;
    if (!actor) continue;

    switch (intent.kind) {
      case 'placeBomb':
        placeBomb(snapshot, actor);
        break;
      case 'kick':
        kickBomb(snapshot, actor, intent.direction);
        break;
      case 'pickup':
        pickupBomb(snapshot, actor);
        break;
      case 'pump':
        pumpBomb(snapshot, actor);
        break;
      case 'throw':
        throwHeldEntity(snapshot, actor, intent.direction);
        break;
    }
  }
}

function placeBomb(snapshot: WorldSnapshot, actor: ActorState): void {
  const cell = getCell(snapshot, actor.cell);
  if (!cell) return;

  // Can only place if actor is on the cell and no bomb occupant already
  // (actor is the occupant, so we need to check if there's a bomb at this position already)
  const existingBomb = Object.values(snapshot.bombs).find(
    (b) =>
      (b as BombState).cell.x === actor.cell.x &&
      (b as BombState).cell.y === actor.cell.y &&
      (b as BombState).cell.z === actor.cell.z &&
      (b as BombState).state.kind !== 'removed',
  );
  if (existingBomb) return;

  const bombId = `bomb_${++bombCounter}`;
  const config = findMatchConfig(snapshot);

  const bomb: BombState = {
    id: bombId,
    ownerActorId: actor.id,
    bombType: 'regular',
    cell: { ...actor.cell },
    power: actor.power,
    fuseTicksRemaining: config.regularBombFuseTicks,
    state: { kind: 'idle' },
  };

  snapshot.bombs[bombId] = bomb;
  // Note: actor already occupies the cell, bomb shares position until actor moves away
}

function kickBomb(snapshot: WorldSnapshot, actor: ActorState, direction: Direction2D): void {
  if (actor.upgrade !== 'kick') return;

  const targetPos = getNeighbor(actor.cell, direction);
  const targetCell = getCell(snapshot, targetPos);
  if (!targetCell || !targetCell.occupant || targetCell.occupant.kind !== 'bomb') return;

  const bomb = snapshot.bombs[targetCell.occupant.id] as BombState | undefined;
  if (!bomb || bomb.bombType !== 'regular') return; // Only regular bombs can be kicked
  if (bomb.state.kind !== 'idle') return;

  const config = findMatchConfig(snapshot);
  const totalTicks = config.kickedBombTravelTicks;
  const leavingTicks = Math.floor(totalTicks / 2);

  const dest = getNeighbor(targetPos, direction);

  bomb.state = {
    kind: 'surfaceTravel',
    mode: 'kicked',
    from: { ...targetPos },
    to: { ...dest },
    direction,
    phase: 'leaving',
    phaseTicksElapsed: 0,
    phaseTicksTotal: leavingTicks,
  };
}

function pickupBomb(snapshot: WorldSnapshot, actor: ActorState): void {
  if (actor.upgrade !== 'carryPump') return;

  // Find an idle regular bomb at actor's cell or adjacent facing cell
  const facingPos = getNeighbor(actor.cell, actor.facing);
  const facingCell = getCell(snapshot, facingPos);

  if (facingCell?.occupant?.kind === 'bomb') {
    const bomb = snapshot.bombs[facingCell.occupant.id] as BombState | undefined;
    if (!bomb || bomb.bombType !== 'regular' || bomb.state.kind !== 'idle') return;

    // Pick up bomb
    clearOccupant(snapshot, facingPos);
    bomb.state = { kind: 'held', holderActorId: actor.id };
  }
}

function pumpBomb(snapshot: WorldSnapshot, actor: ActorState): void {
  if (actor.upgrade !== 'carryPump') return;

  // Find held regular bomb owned by this actor
  const heldBomb = Object.values(snapshot.bombs).find(
    (b) =>
      (b as BombState).state.kind === 'held' &&
      ((b as BombState).state as { holderActorId: string }).holderActorId === actor.id &&
      (b as BombState).bombType === 'regular',
  ) as BombState | undefined;

  if (!heldBomb) return;
  heldBomb.bombType = 'pumped';

  const config = findMatchConfig(snapshot);
  heldBomb.fuseTicksRemaining = config.pumpedBombFuseTicks;
}

function throwHeldEntity(snapshot: WorldSnapshot, actor: ActorState, direction: Direction2D): void {
  // Find held bomb
  const heldBomb = Object.values(snapshot.bombs).find(
    (b) =>
      (b as BombState).state.kind === 'held' &&
      ((b as BombState).state as { holderActorId: string }).holderActorId === actor.id,
  ) as BombState | undefined;

  if (heldBomb) {
    const config = findMatchConfig(snapshot);
    const totalTicks = config.thrownTravelTicks;
    const leavingTicks = Math.floor(totalTicks / 2);
    const dest = getNeighbor(actor.cell, direction);

    heldBomb.state = {
      kind: 'thrownTravel',
      throwOrigin: { ...actor.cell },
      from: { ...actor.cell },
      to: { ...dest },
      direction,
      remainingDistance: actor.power + 2, // Throw distance based on power
      phase: 'leaving',
      phaseTicksElapsed: 0,
      phaseTicksTotal: leavingTicks,
      interactionLocked: true,
    };
    return;
  }

  // Find held stunned actor
  const heldActor = Object.values(snapshot.actors).find(
    (a) =>
      (a as ActorState).state.kind === 'held' &&
      ((a as ActorState).state as { holderActorId: string }).holderActorId === actor.id,
  ) as ActorState | undefined;

  if (heldActor) {
    const config = findMatchConfig(snapshot);
    const totalTicks = config.thrownTravelTicks;
    const leavingTicks = Math.floor(totalTicks / 2);
    const dest = getNeighbor(actor.cell, direction);

    heldActor.state = {
      kind: 'thrownTravel',
      throwOrigin: { ...actor.cell },
      from: { ...actor.cell },
      to: { ...dest },
      direction,
      remainingDistance: actor.power + 2,
      phase: 'leaving',
      phaseTicksElapsed: 0,
      phaseTicksTotal: leavingTicks,
      interactionLocked: true,
    };
  }
}

/**
 * Extract match config timing values from the snapshot.
 * In the real system, config is stored on SimulationRun, not on WorldSnapshot.
 * This helper returns defaults until we thread config through properly.
 */
function findMatchConfig(_snapshot: WorldSnapshot) {
  // TODO: thread MatchConfig through the tick pipeline
  return {
    regularBombFuseTicks: 120,
    pumpedBombFuseTicks: 120,
    kickedBombTravelTicks: 20,
    thrownTravelTicks: 20,
  };
}
