/** Semantic 2D direction type used for movement, facing, ramp orientation, and throw direction. */
export type Direction2D =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'northEast'
  | 'northWest'
  | 'southEast'
  | 'southWest';

/** Cardinal directions only (no diagonals). Used for bomb propagation and kick directions. */
export type CardinalDirection = 'north' | 'south' | 'east' | 'west';

/** All cardinal directions as an array for iteration. */
export const CARDINAL_DIRECTIONS: readonly CardinalDirection[] = [
  'north',
  'south',
  'east',
  'west',
] as const;

/** All eight directions as an array for iteration. */
export const ALL_DIRECTIONS: readonly Direction2D[] = [
  'north',
  'south',
  'east',
  'west',
  'northEast',
  'northWest',
  'southEast',
  'southWest',
] as const;

/** Vector lookup table mapping each direction to its dx/dy offset. */
export const DIRECTION_TO_VECTOR: Record<Direction2D, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
  northEast: { dx: 1, dy: -1 },
  northWest: { dx: -1, dy: -1 },
  southEast: { dx: 1, dy: 1 },
  southWest: { dx: -1, dy: 1 },
};

/** Returns the opposite of a given direction. */
export const OPPOSITE_DIRECTION: Record<Direction2D, Direction2D> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  northEast: 'southWest',
  southWest: 'northEast',
  northWest: 'southEast',
  southEast: 'northWest',
};
