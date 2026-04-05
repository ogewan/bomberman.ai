/**
 * bombActions — handles bomb placement, kick, carry/pickup, pump, and throw actions.
 */

import type {
  ActorIntent,
  ActorState,
  BombState,
  MatchConfig,
  WorldSnapshot,
  Direction2D,
} from '@bomberman65/shared';
import { getCell, getNeighbor, clearOccupant } from '../world/gridHelpers.js';
import { resolveKickedBombDestination } from './movementResolution.js';

let bombCounter = 0;

/** Reset bomb ID counter — call when starting a new simulation session. */
export function resetBombCounter(): void {
  bombCounter = 0;
}

/** Apply all bomb-related intents from the validated intent list. */
export function applyBombIntents(
  snapshot: WorldSnapshot,
  intents: ActorIntent[],
  config: MatchConfig,
): void {
  for (const intent of intents) {
    const actor = snapshot.actors[intent.actorId] as ActorState | undefined;
    if (!actor) continue;

    switch (intent.kind) {
      case 'placeBomb':
        placeBomb(snapshot, actor, config);
        break;
      case 'kick':
        kickBomb(snapshot, actor, intent.direction, config);
        break;
      case 'pickup':
        pickupBomb(snapshot, actor);
        break;
      case 'pump':
        pumpBomb(snapshot, actor, config);
        break;
      case 'throw':
        throwHeldEntity(snapshot, actor, intent.direction, config);
        break;
    }
  }
}

function placeBomb(snapshot: WorldSnapshot, actor: ActorState, config: MatchConfig): void {
  const cell = getCell(snapshot, actor.cell);
  if (!cell) return;

  const existingBomb = Object.values(snapshot.bombs).find(
    (b) =>
      (b as BombState).cell.x === actor.cell.x &&
      (b as BombState).cell.y === actor.cell.y &&
      (b as BombState).cell.z === actor.cell.z &&
      (b as BombState).state.kind !== 'removed',
  );
  if (existingBomb) return;

  const bombId = `bomb_${++bombCounter}`;

  const bomb: BombState = {
    id: bombId,
    ownerActorId: actor.id,
    bombType: 'regular',
    cell: { ...actor.cell },
    power: actor.power,
    fuseTicksRemaining: config.regularBombFuseTicks,
    initialFuseTicks: config.regularBombFuseTicks,
    state: { kind: 'idle' },
  };

  snapshot.bombs[bombId] = bomb;
}

function kickBomb(
  snapshot: WorldSnapshot,
  actor: ActorState,
  direction: Direction2D,
  config: MatchConfig,
): void {
  if (actor.upgrade !== 'kick') return;

  const targetPos = getNeighbor(actor.cell, direction);
  const targetCell = getCell(snapshot, targetPos);
  if (!targetCell || !targetCell.occupant || targetCell.occupant.kind !== 'bomb') return;

  const bomb = snapshot.bombs[targetCell.occupant.id] as BombState | undefined;
  if (!bomb || bomb.bombType !== 'regular') return;
  if (bomb.state.kind !== 'idle') return;

  const totalTicks = config.kickedBombTravelTicks;
  const leavingTicks = Math.floor(totalTicks / 2);

  const dest = resolveKickedBombDestination(snapshot, targetPos, direction);
  if (!dest) return; // No valid destination (blocked by ramp orientation, etc.)

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

  // Don't pickup if already holding something
  const holdingBomb = Object.values(snapshot.bombs).some(
    (b) =>
      (b as BombState).state.kind === 'held' &&
      ((b as BombState).state as { holderActorId: string }).holderActorId === actor.id,
  );
  const holdingActor = Object.values(snapshot.actors).some(
    (a) =>
      (a as ActorState).state.kind === 'held' &&
      ((a as ActorState).state as { holderActorId: string }).holderActorId === actor.id,
  );
  if (holdingBomb || holdingActor) return;

  const facingPos = getNeighbor(actor.cell, actor.facing);
  const facingCell = getCell(snapshot, facingPos);

  // Try bomb pickup
  if (facingCell?.occupant?.kind === 'bomb') {
    const bomb = snapshot.bombs[facingCell.occupant.id] as BombState | undefined;
    if (!bomb || bomb.bombType !== 'regular' || bomb.state.kind !== 'idle') return;

    clearOccupant(snapshot, facingPos);
    bomb.state = { kind: 'held', holderActorId: actor.id };
    return;
  }

  // Try stunned actor pickup
  if (facingCell?.occupant?.kind === 'actor') {
    const target = snapshot.actors[facingCell.occupant.id] as ActorState | undefined;
    if (!target || target.stunTicksRemaining <= 0 || target.state.kind !== 'idle') return;

    clearOccupant(snapshot, facingPos);
    target.state = { kind: 'held', holderActorId: actor.id };
  }
}

function pumpBomb(snapshot: WorldSnapshot, actor: ActorState, config: MatchConfig): void {
  if (actor.upgrade !== 'carryPump') return;

  const heldBomb = Object.values(snapshot.bombs).find(
    (b) =>
      (b as BombState).state.kind === 'held' &&
      ((b as BombState).state as { holderActorId: string }).holderActorId === actor.id &&
      (b as BombState).bombType === 'regular',
  ) as BombState | undefined;

  if (!heldBomb) return;
  heldBomb.bombType = 'pumped';
  heldBomb.fuseTicksRemaining = config.pumpedBombFuseTicks;
  heldBomb.initialFuseTicks = config.pumpedBombFuseTicks;
}

function throwHeldEntity(
  snapshot: WorldSnapshot,
  actor: ActorState,
  direction: Direction2D,
  config: MatchConfig,
): void {
  // Find held bomb
  const heldBomb = Object.values(snapshot.bombs).find(
    (b) =>
      (b as BombState).state.kind === 'held' &&
      ((b as BombState).state as { holderActorId: string }).holderActorId === actor.id,
  ) as BombState | undefined;

  if (heldBomb) {
    const totalTicks = config.thrownTravelTicks;
    const leavingTicks = Math.floor(totalTicks / 2);
    const dest = getNeighbor(actor.cell, direction);

    // Update bomb cell to actor's current position before throwing
    heldBomb.cell = { ...actor.cell };

    heldBomb.state = {
      kind: 'thrownTravel',
      throwOrigin: { ...actor.cell },
      from: { ...actor.cell },
      to: { ...dest },
      direction,
      remainingDistance: config.throwDistance,
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
    const totalTicks = config.thrownTravelTicks;
    const leavingTicks = Math.floor(totalTicks / 2);
    const dest = getNeighbor(actor.cell, direction);

    // Update held actor cell to thrower's position
    heldActor.cell = { ...actor.cell };

    heldActor.state = {
      kind: 'thrownTravel',
      throwOrigin: { ...actor.cell },
      from: { ...actor.cell },
      to: { ...dest },
      direction,
      remainingDistance: config.throwDistance,
      phase: 'leaving',
      phaseTicksElapsed: 0,
      phaseTicksTotal: leavingTicks,
      interactionLocked: true,
    };
  }
}
