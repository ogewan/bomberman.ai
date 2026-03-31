/**
 * blastEffects — applies the effects of active explosions.
 *
 * Rules:
 * - Actor eliminated on explosion contact (unless shielded)
 * - Actor stunned on contact with kicked bomb (handled in movement, not here)
 * - Shield prevents both stun and elimination while active
 * - Breakable terrain breaks if inside any explosion
 * - Chain detonation: bombs in affected cells detonate immediately
 */

import type { ActorState, BombState, WorldSnapshot } from '@bomberman65/shared';
import { vec3iEqual } from '@bomberman65/shared';
import { getCell } from '../world/gridHelpers.js';
import { detonateBomb } from './explosionPropagation.js';

/** Apply blast effects for all currently exploding bombs. */
export function applyBlastEffects(snapshot: WorldSnapshot): void {
  // Collect all affected cells from all exploding bombs
  const explodingBombs = (Object.values(snapshot.bombs) as BombState[]).filter(
    (b) => b.state.kind === 'exploding',
  );

  for (const bomb of explodingBombs) {
    if (bomb.state.kind !== 'exploding') continue;

    for (const pos of bomb.state.affectedCells) {
      // Breakable destruction
      const cell = getCell(snapshot, pos);
      if (cell && cell.terrain === 'breakable') {
        cell.terrain = 'empty';
        // Hidden items become visible when breakable is destroyed
        // (item is already placed in cell during world construction)
      }

      // Actor elimination
      for (const actor of Object.values(snapshot.actors) as ActorState[]) {
        if (actor.state.kind === 'eliminated') continue;
        if (actor.state.kind === 'held' || actor.state.kind === 'thrownTravel') continue;

        if (vec3iEqual(actor.cell, pos)) {
          if (actor.shieldTicksRemaining > 0) {
            // Shield absorbs the hit — no elimination, no stun
            continue;
          }
          actor.state = { kind: 'eliminated' };

          // Clear occupant if this actor was occupying the cell
          if (cell?.occupant?.kind === 'actor' && cell.occupant.id === actor.id) {
            cell.occupant = undefined;
          }
        }
      }

      // Chain detonation: bombs in affected cells detonate
      for (const otherBomb of Object.values(snapshot.bombs) as BombState[]) {
        if (otherBomb.id === bomb.id) continue;
        if (otherBomb.state.kind === 'exploding' || otherBomb.state.kind === 'removed') continue;

        if (vec3iEqual(otherBomb.cell, pos)) {
          detonateBomb(snapshot, otherBomb);
        }
      }
    }
  }
}

/** Cleanup: remove expired explosions, removed bombs, finalize eliminated actors. */
export function cleanup(snapshot: WorldSnapshot): void {
  const bombIds = Object.keys(snapshot.bombs);

  for (const id of bombIds) {
    const bomb = snapshot.bombs[id] as BombState;

    // Remove expired explosions
    if (bomb.state.kind === 'exploding' && bomb.state.ticksRemaining <= 0) {
      bomb.state = { kind: 'removed' };
    }

    // Remove fully removed bombs from the table
    if (bomb.state.kind === 'removed') {
      delete snapshot.bombs[id];
    }
  }

  // Finalize eliminated actors — clear their cell occupancy
  for (const actor of Object.values(snapshot.actors) as ActorState[]) {
    if (actor.state.kind === 'eliminated') {
      const cell = getCell(snapshot, actor.cell);
      if (cell?.occupant?.kind === 'actor' && cell.occupant.id === actor.id) {
        cell.occupant = undefined;
      }
    }
  }
}
