/**
 * explosionPropagation — handles fuse-to-explosion transition and blast cell computation.
 *
 * Rules:
 * - Regular bomb: square propagation using cardinal radius from origin
 * - Pumped bomb: cube version of regular propagation (extends vertically too)
 * - Pumped bombs are NOT blocked by walls, but walls not destroyed unless breakable
 * - Breakable terrain breaks if inside any explosion
 * - Chain detonation: bombs in affected cells detonate immediately
 */

import type { BombState, MatchConfig, WorldSnapshot, Vec3i } from '@bomberman65/shared';
import { CARDINAL_DIRECTIONS, DIRECTION_TO_VECTOR } from '@bomberman65/shared';
import { getCell, isInBounds } from '../world/gridHelpers.js';

/** Transition bombs whose fuse has reached zero into exploding state. */
export function transitionExpiredBombs(snapshot: WorldSnapshot, config: MatchConfig): void {
  for (const bomb of Object.values(snapshot.bombs) as BombState[]) {
    if (bomb.state.kind === 'removed' || bomb.state.kind === 'exploding') continue;

    if (bomb.fuseTicksRemaining <= 0) {
      detonateBomb(snapshot, bomb, config);
    }
  }
}

/** Detonate a single bomb — compute affected cells and transition to exploding. */
export function detonateBomb(snapshot: WorldSnapshot, bomb: BombState, config: MatchConfig): void {
  // Determine origin — for held/thrown bombs, use current cell
  const origin = { ...bomb.cell };

  // If held, the bomb explodes at the holder's position
  if (bomb.state.kind === 'held') {
    const holder = snapshot.actors[bomb.state.holderActorId];
    if (holder) {
      bomb.cell = { ...(holder as { cell: Vec3i }).cell };
    }
  }

  const affectedCells =
    bomb.bombType === 'regular'
      ? computeRegularExplosion(snapshot, bomb.cell, bomb.power)
      : computePumpedExplosion(snapshot, bomb.cell, bomb.power);

  bomb.state = {
    kind: 'exploding',
    origin,
    ticksRemaining: config.explosionDurationTicks,
    affectedCells,
  };
}

/**
 * Regular bomb: square propagation using cardinal radius from origin.
 * Propagates in 4 cardinal directions, blocked by walls.
 */
function computeRegularExplosion(snapshot: WorldSnapshot, origin: Vec3i, power: number): Vec3i[] {
  const cells: Vec3i[] = [{ ...origin }];

  for (const dir of CARDINAL_DIRECTIONS) {
    const vec = DIRECTION_TO_VECTOR[dir];
    for (let i = 1; i <= power; i++) {
      const pos: Vec3i = {
        x: origin.x + vec.dx * i,
        y: origin.y + vec.dy * i,
        z: origin.z,
      };

      if (!isInBounds(snapshot, pos)) break;
      const cell = getCell(snapshot, pos);
      if (!cell) break;

      // Walls block regular explosions
      if (cell.terrain === 'wall') break;

      cells.push(pos);

      // Breakables stop further propagation in this direction but are affected
      if (cell.terrain === 'breakable') break;
    }
  }

  return cells;
}

/**
 * Pumped bomb: cube version of regular propagation.
 * Extends in cardinal directions AND vertically. Not blocked by walls,
 * but walls are not destroyed unless already breakable.
 */
function computePumpedExplosion(snapshot: WorldSnapshot, origin: Vec3i, power: number): Vec3i[] {
  const cells: Vec3i[] = [{ ...origin }];
  const seen = new Set<string>();
  seen.add(`${origin.x},${origin.y},${origin.z}`);

  // Horizontal propagation (same as regular but not blocked by walls)
  for (const dir of CARDINAL_DIRECTIONS) {
    const vec = DIRECTION_TO_VECTOR[dir];
    for (let i = 1; i <= power; i++) {
      const pos: Vec3i = {
        x: origin.x + vec.dx * i,
        y: origin.y + vec.dy * i,
        z: origin.z,
      };

      if (!isInBounds(snapshot, pos)) break;
      const key = `${pos.x},${pos.y},${pos.z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push(pos);
    }
  }

  // Vertical propagation (up and down)
  for (let dz = -power; dz <= power; dz++) {
    if (dz === 0) continue;
    const pos: Vec3i = { x: origin.x, y: origin.y, z: origin.z + dz };
    if (!isInBounds(snapshot, pos)) continue;
    const key = `${pos.x},${pos.y},${pos.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push(pos);
  }

  // Cardinal propagation on other z-levels within cube
  for (let dz = -power; dz <= power; dz++) {
    if (dz === 0) continue;
    const z = origin.z + dz;
    if (z < 0 || z >= snapshot.size.z) continue;

    for (const dir of CARDINAL_DIRECTIONS) {
      const vec = DIRECTION_TO_VECTOR[dir];
      const remainingPower = power - Math.abs(dz);
      for (let i = 1; i <= remainingPower; i++) {
        const pos: Vec3i = {
          x: origin.x + vec.dx * i,
          y: origin.y + vec.dy * i,
          z,
        };

        if (!isInBounds(snapshot, pos)) break;
        const key = `${pos.x},${pos.y},${pos.z}`;
        if (seen.has(key)) continue;
        seen.add(key);
        cells.push(pos);
      }
    }
  }

  return cells;
}
