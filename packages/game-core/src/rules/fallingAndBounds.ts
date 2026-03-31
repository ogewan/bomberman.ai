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

import type { ActorState, BombState, WorldSnapshot } from '@bomberman65/shared';
import {
  getCell,
  hasSupportBelow,
  isInBounds,
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

      // Fall until supported or out of bounds
      let z = actor.cell.z - 1;
      while (z >= 0) {
        const landingPos = { x: actor.cell.x, y: actor.cell.y, z };
        const landingCell = getCell(snapshot, landingPos);

        if (landingCell && landingCell.terrain !== 'empty') {
          // Check one above the support
          const abovePos = { x: actor.cell.x, y: actor.cell.y, z: z + 1 };
          const aboveCell = getCell(snapshot, abovePos);
          if (aboveCell && !aboveCell.occupant) {
            actor.cell = abovePos;
            setOccupant(snapshot, abovePos, { kind: 'actor', id: actor.id });
            break;
          }
        }
        z--;
      }

      if (z < 0) {
        // Fell out of bounds
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
      bomb.state = { kind: 'removed' };
      continue;
    }

    if (!hasSupportBelow(snapshot, bomb.cell)) {
      clearOccupant(snapshot, bomb.cell);

      let z = bomb.cell.z - 1;
      while (z >= 0) {
        const landingPos = { x: bomb.cell.x, y: bomb.cell.y, z };
        const landingCell = getCell(snapshot, landingPos);

        if (landingCell && landingCell.terrain !== 'empty') {
          const abovePos = { x: bomb.cell.x, y: bomb.cell.y, z: z + 1 };
          const aboveCell = getCell(snapshot, abovePos);
          if (aboveCell && !aboveCell.occupant) {
            bomb.cell = abovePos;
            setOccupant(snapshot, abovePos, { kind: 'bomb', id: bomb.id });
            break;
          }
        }
        z--;
      }

      if (z < 0) {
        bomb.state = { kind: 'removed' };
      }
    }
  }
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
