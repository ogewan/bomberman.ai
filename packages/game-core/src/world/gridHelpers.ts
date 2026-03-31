/**
 * gridHelpers — cell access, support checks, bounds, and occupancy utilities.
 */

import type { Cell, WorldSnapshot, Vec3i, EntityRef } from '@bomberman65/shared';
import { vec3iInBounds, DIRECTION_TO_VECTOR, type Direction2D } from '@bomberman65/shared';

/** Get a cell from the world grid, or undefined if out of bounds. */
export function getCell(snapshot: WorldSnapshot, pos: Vec3i): Cell | undefined {
  return snapshot.cells[pos.z]?.[pos.y]?.[pos.x];
}

/** Check if a position is within world bounds. */
export function isInBounds(snapshot: WorldSnapshot, pos: Vec3i): boolean {
  return vec3iInBounds(pos, snapshot.size);
}

/** Check if a cell has valid support below (for elevated cells). */
export function hasSupportBelow(snapshot: WorldSnapshot, pos: Vec3i): boolean {
  if (pos.z === 0) return true;
  const below = getCell(snapshot, { x: pos.x, y: pos.y, z: pos.z - 1 });
  if (!below) return false;
  // Non-empty terrain provides support
  return below.terrain !== 'empty';
}

/** Check if a cell is walkable (empty terrain, no blocking occupant). */
export function isWalkable(snapshot: WorldSnapshot, pos: Vec3i): boolean {
  const cell = getCell(snapshot, pos);
  if (!cell) return false;
  if (cell.terrain !== 'empty' && cell.terrain !== 'ramp') return false;
  if (cell.occupant) return false;
  return true;
}

/** Check if a cell's terrain blocks movement. */
export function isBlockingTerrain(cell: Cell): boolean {
  return cell.terrain === 'wall' || cell.terrain === 'breakable';
}

/** Set a cell's occupant. */
export function setOccupant(snapshot: WorldSnapshot, pos: Vec3i, ref: EntityRef | undefined): void {
  const cell = getCell(snapshot, pos);
  if (cell) {
    cell.occupant = ref;
  }
}

/** Clear a cell's occupant. */
export function clearOccupant(snapshot: WorldSnapshot, pos: Vec3i): void {
  setOccupant(snapshot, pos, undefined);
}

/** Compute the destination cell from a position and direction. */
export function getNeighbor(pos: Vec3i, direction: Direction2D): Vec3i {
  const vec = DIRECTION_TO_VECTOR[direction];
  return { x: pos.x + vec.dx, y: pos.y + vec.dy, z: pos.z };
}
