import type { Vec3i } from '../types/primitives.js';

/** Create a Vec3i from components. */
export function vec3i(x: number, y: number, z: number): Vec3i {
  return { x, y, z };
}

/** Check if two Vec3i are equal. */
export function vec3iEqual(a: Vec3i, b: Vec3i): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

/** Add two Vec3i component-wise. */
export function vec3iAdd(a: Vec3i, b: Vec3i): Vec3i {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** Check if a position is within grid bounds. */
export function vec3iInBounds(pos: Vec3i, size: Vec3i): boolean {
  return (
    pos.x >= 0 && pos.x < size.x && pos.y >= 0 && pos.y < size.y && pos.z >= 0 && pos.z < size.z
  );
}
