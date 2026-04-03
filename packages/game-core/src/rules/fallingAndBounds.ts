/**
 * fallingAndBounds — handles falling logic and out-of-bounds resolution.
 *
 * Rules:
 * - Actors fall immediately when unsupported
 * - Kicked bombs preserve horizontal momentum after falling
 * - Items fall by downward transfer (if lower cell has no item, transfer down)
 * - Actors out of bounds die immediately
 * - Bombs fully resolving out of bounds are removed
 */

import type { ActorState, BombState, WorldSnapshot, Direction2D } from '@bomberman65/shared';
import { BOUNCE_CHAIN_EXTRA } from '@bomberman65/shared';
import {
  getCell,
  getNeighbor,
  hasSupportBelow,
  isInBounds,
  isBlockingTerrain,
  clearOccupant,
  setOccupant,
} from '../world/gridHelpers.js';

/** Check and apply falling and out-of-bounds for all entities. */
export function resolveFallingAndBounds(snapshot: WorldSnapshot): void {
  resolveActorFalling(snapshot);
  resolveBombFalling(snapshot);
  resolveItemFalling(snapshot);
}

function resolveActorFalling(snapshot: WorldSnapshot): void {
  for (const actor of Object.values(snapshot.actors) as ActorState[]) {
    if (actor.state.kind === 'eliminated') continue;
    if (actor.state.kind === 'held' || actor.state.kind === 'thrownTravel') continue;
    if (actor.state.kind === 'surfaceTravel') continue; // Don't fall during travel

    // Out of bounds check
    if (!isInBounds(snapshot, actor.cell)) {
      actor.state = { kind: 'eliminated' };
      continue;
    }

    // Support check — actors fall immediately when unsupported
    if (!hasSupportBelow(snapshot, actor.cell)) {
      clearOccupant(snapshot, actor.cell);

      const landed = fallEntity(
        snapshot,
        actor.cell,
        actor.lastMoveDirection ?? actor.facing,
        (pos) => {
          actor.cell = pos;
          setOccupant(snapshot, pos, { kind: 'actor', id: actor.id });
        },
      );

      if (!landed) {
        actor.state = { kind: 'eliminated' };
      }
    }
  }
}

function resolveBombFalling(snapshot: WorldSnapshot): void {
  for (const bomb of Object.values(snapshot.bombs) as BombState[]) {
    if (bomb.state.kind === 'removed' || bomb.state.kind === 'exploding') continue;
    if (bomb.state.kind === 'held' || bomb.state.kind === 'thrownTravel') continue;
    if (bomb.state.kind === 'surfaceTravel') continue;

    if (!isInBounds(snapshot, bomb.cell)) {
      clearOccupant(snapshot, bomb.cell);
      bomb.state = { kind: 'removed' };
      continue;
    }

    if (!hasSupportBelow(snapshot, bomb.cell)) {
      clearOccupant(snapshot, bomb.cell);

      const landed = fallEntity(
        snapshot,
        bomb.cell,
        bomb.lastMoveDirection ?? 'south',
        (pos) => {
          bomb.cell = pos;
          setOccupant(snapshot, pos, { kind: 'bomb', id: bomb.id });
        },
      );

      if (!landed) {
        bomb.state = { kind: 'removed' };
      }
    }
  }
}

/**
 * Shared falling logic for actors and bombs.
 * Falls straight down to find support, bouncing horizontally if landing cell is occupied.
 * Returns true if entity landed, false if fell out of bounds.
 */
function fallEntity(
  snapshot: WorldSnapshot,
  startCell: { x: number; y: number; z: number },
  bounceDir: Direction2D,
  land: (pos: { x: number; y: number; z: number }) => void,
): boolean {
  const bounceLimit = Math.max(snapshot.size.x, snapshot.size.y) + BOUNCE_CHAIN_EXTRA;

  // Try landing in a column, with horizontal bounce if occupied
  const tryLandInColumn = (cx: number, cy: number, fromZ: number): boolean => {
    let z = fromZ;
    while (z >= 0) {
      const pos = { x: cx, y: cy, z };
      const cell = getCell(snapshot, pos);
      if (!cell) break;

      if (cell.terrain !== 'empty') {
        // Non-empty terrain is support — land one above
        const abovePos = { x: cx, y: cy, z: z + 1 };
        const aboveCell = getCell(snapshot, abovePos);
        if (aboveCell && !aboveCell.occupant && isInBounds(snapshot, abovePos)) {
          land(abovePos);
          return true;
        }
        // Landing cell occupied — return false to trigger bounce
        return false;
      }

      if (z === 0) {
        // z=0 is ground level — land here if unoccupied
        if (!cell.occupant) {
          land(pos);
          return true;
        }
        // Occupied ground — return false to trigger bounce
        return false;
      }

      z--;
    }
    return false;
  };

  // First try: fall straight down in the starting column
  if (tryLandInColumn(startCell.x, startCell.y, startCell.z - 1)) {
    return true;
  }

  // Horizontal bounce — continue in movement direction
  let bouncePos = { ...startCell };
  for (let b = 0; b < bounceLimit; b++) {
    bouncePos = getNeighbor(bouncePos, bounceDir);
    const bounceCell = getCell(snapshot, bouncePos);
    if (!bounceCell || !isInBounds(snapshot, bouncePos) || isBlockingTerrain(bounceCell)) break;
    if (bounceCell.occupant) continue;

    // Found an empty cell at this z-level — check if it has support or can fall further
    if (hasSupportBelow(snapshot, bouncePos) || bouncePos.z === 0) {
      land(bouncePos);
      return true;
    }

    // Unsupported — try falling in this column
    if (tryLandInColumn(bouncePos.x, bouncePos.y, bouncePos.z - 1)) {
      return true;
    }
  }

  return false;
}

function resolveItemFalling(snapshot: WorldSnapshot): void {
  // Process top-down so items cascade correctly
  for (let z = snapshot.size.z - 1; z > 0; z--) {
    for (let y = 0; y < snapshot.size.y; y++) {
      for (let x = 0; x < snapshot.size.x; x++) {
        const cell = getCell(snapshot, { x, y, z });
        if (!cell || !cell.item) continue;
        if (cell.terrain !== 'empty') continue; // Items in breakables stay

        // Check if this cell has support
        const belowCell = getCell(snapshot, { x, y, z: z - 1 });
        if (belowCell && belowCell.terrain === 'empty' && !belowCell.item) {
          // Transfer item down
          belowCell.item = cell.item;
          cell.item = undefined;
        }
        // If lower cell already has an item, upper item stays
      }
    }
  }
}
