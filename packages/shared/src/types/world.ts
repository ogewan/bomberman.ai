import type { Direction2D } from './direction.js';
import type { EntityRef, ItemType, TerrainType, Vec3i } from './primitives.js';

/** Ramp metadata defining entry/exit directions and elevation change. */
export type RampData = {
  readonly entry: Direction2D;
  readonly exit: Direction2D;
  readonly deltaZ: 1;
};

/** A single cell in the 3D world grid. */
export type Cell = {
  terrain: TerrainType;
  ramp?: RampData;
  occupant?: EntityRef;
  item?: ItemType;
};

/** Immutable snapshot of the full world state at a given tick. */
export type WorldSnapshot = {
  readonly tick: number;
  readonly size: Vec3i;
  readonly cells: Cell[][][];
  readonly actors: Record<string, ActorState>;
  readonly bombs: Record<string, BombState>;
};

// Re-export actor/bomb state from their own modules for convenience.
// These are imported here to define WorldSnapshot; the canonical definitions live in actor.ts and bomb.ts.
import type { ActorState } from './actor.js';
import type { BombState } from './bomb.js';
export type { ActorState, BombState };
