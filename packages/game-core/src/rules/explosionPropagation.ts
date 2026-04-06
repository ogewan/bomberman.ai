/**
 * explosionPropagation — handles fuse-to-explosion transition and blast cell
 * computation.
 *
 * Rules:
 * - Regular bomb: square propagation using cardinal radius from origin
 * - Pumped bomb: cube version of regular propagation (extends vertically too)
 * - Pumped bombs are NOT blocked by walls, but walls not destroyed unless
 * breakable
 * - Breakable terrain breaks if inside any explosion
 * - Chain detonation: bombs in affected cells detonate immediately
 */

import type {BombState, MatchConfig, WorldSnapshot, Vec3i} from '@bomberman65/shared';
import {CARDINAL_DIRECTIONS, DIRECTION_TO_VECTOR} from '@bomberman65/shared';
import {getCell, isInBounds, clearOccupant} from '../world/gridHelpers.js';

/** Transition bombs whose fuse has reached zero into exploding state. */
export function transitionExpiredBombs(
    snapshot: WorldSnapshot, config: MatchConfig): void {
  for (const bomb of Object.values(snapshot.bombs) as BombState[]) {
    if (bomb.state.kind === 'removed' || bomb.state.kind === 'exploding')
      continue;

    if (bomb.fuseTicksRemaining <= 0) {
      detonateBomb(snapshot, bomb, config);
    }
  }
}

/**
 * Detonate a single bomb — compute affected cells and transition to exploding.
 */
export function detonateBomb(
    snapshot: WorldSnapshot, bomb: BombState, config: MatchConfig): void {
  // Determine origin — for held/thrown bombs, use current cell
  const origin = {...bomb.cell};

  // If held, the bomb explodes at the holder's position
  if (bomb.state.kind === 'held') {
    const holder = snapshot.actors[bomb.state.holderActorId];
    if (holder) {
      bomb.cell = {...(holder as {cell: Vec3i}).cell};
    }
  }

  const affectedCells = bomb.bombType === 'regular' ?
      computeRegularExplosion(snapshot, bomb.cell, bomb.power) :
      computePumpedExplosion(snapshot, bomb.cell, bomb.power);

  // Clear occupancy before transitioning — the cell is now free for actors to
  // place new bombs
  const bombCell = getCell(snapshot, bomb.cell);
  if (bombCell?.occupant?.kind === 'bomb' && bombCell.occupant.id === bomb.id) {
    clearOccupant(snapshot, bomb.cell);
  }

  bomb.state = {
    kind: 'exploding',
    origin,
    ticksRemaining: config.explosionDurationTicks,
    affectedCells,
  };
}

/**
 * Regular bomb: filled square propagation at origin z-level.
 * Cardinal arms propagate first; diagonal cells are only hit if BOTH
 * adjacent cardinal cells (relative to origin) are reachable.
 * Walls block propagation. Breakable cells are affected but stop further reach.
 */
function computeRegularExplosion(
    snapshot: WorldSnapshot, origin: Vec3i, power: number): Vec3i[] {
  const cells: Vec3i[] = [{...origin}];
  const cardinalReach = new Set<string>();
  cardinalReach.add(`${origin.x},${origin.y}`);

  // Step 1: cardinal arms — walk each direction, blocked by walls/breakables
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
      if (!cell || cell.terrain === 'wall') break;
      cells.push(pos);

      if (cell.terrain === 'breakable') break;
      cardinalReach.add(`${pos.x},${pos.y}`);
    }
  }

  // Step 2: diagonal cells — gated by both adjacent cardinals from origin
  for (let dx = -power; dx <= power; dx++) {
    for (let dy = -power; dy <= power; dy++) {
      if (dx === 0 || dy === 0) continue;  // cardinals already handled
      if (Math.max(Math.abs(dx), Math.abs(dy)) > power) continue;

      const pos: Vec3i = {x: origin.x + dx, y: origin.y + dy, z: origin.z};
      if (!isInBounds(snapshot, pos)) continue;
      const cell = getCell(snapshot, pos);
      if (!cell || cell.terrain === 'wall') continue;

      // Both axis-aligned cardinal cells from origin must be reachable
      if (!cardinalReach.has(`${origin.x + dx},${origin.y}`) ||
          !cardinalReach.has(`${origin.x},${origin.y + dy}`))
        continue;

      cells.push(pos);
    }
  }

  return cells;
}

/**
 * Pumped bomb: filled cube propagation across z-levels.
 * Full Chebyshev square at each z-level from z-power to z+power.
 * Walls do NOT block propagation (but are not destroyed — handled in
 * blastEffects).
 */
function computePumpedExplosion(
    snapshot: WorldSnapshot, origin: Vec3i, power: number): Vec3i[] {
  const cells: Vec3i[] = [];

  for (let dz = -power; dz <= power; dz++) {
    const z = origin.z + dz;
    if (z < 0 || z >= snapshot.size.z) continue;

    for (let dx = -power; dx <= power; dx++) {
      for (let dy = -power; dy <= power; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) > power) continue;

        const pos: Vec3i = {x: origin.x + dx, y: origin.y + dy, z};
        if (!isInBounds(snapshot, pos)) continue;

        cells.push(pos);
      }
    }
  }

  return cells;
}
