/** Integer 3D vector used for grid coordinates. */
export type Vec3i = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

/** Reference to a specific entity by kind and id. */
export type EntityRef =
  | { readonly kind: 'actor'; readonly id: string }
  | { readonly kind: 'bomb'; readonly id: string };

/** Terrain types for grid cells. */
export type TerrainType = 'empty' | 'wall' | 'breakable' | 'ramp';

/** Item types that can be placed in cells or dropped from breakables. */
export type ItemType = 'upgrade-kick' | 'upgrade-carryPump' | 'upgrade-shield' | 'power' | 'count';

/** Exclusive upgrade types an actor can hold. */
export type Upgrade = 'none' | 'kick' | 'carryPump' | 'shield';

/** Bomb variants. */
export type BombType = 'regular' | 'pumped';
