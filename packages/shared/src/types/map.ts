import type { Direction2D } from './direction.js';
import type { BombType, ItemType, TerrainType, Upgrade, Vec3i } from './primitives.js';
import type { MatchConfig, MatchRuleOverrides } from './config.js';

/** Ramp definition within a map cell. */
export type RampDefinition = {
  readonly entry: Direction2D;
  readonly exit: Direction2D;
  readonly deltaZ: 1;
};

/** Item placement within a map cell. */
export type ItemPlacement = {
  readonly type: ItemType;
  readonly hiddenInBreakable?: boolean;
  /** Drop chance in range 0..1. 1 = guaranteed, 0 = never. Intermediate values use seeded RNG. */
  readonly dropChance?: number;
};

/** A single cell in a map definition. */
export type MapCell = {
  readonly terrain: TerrainType;
  readonly ramp?: RampDefinition;
  readonly item?: ItemPlacement;
};

/** Spawn point definition in a map. */
export type SpawnPoint = {
  readonly id: string;
  readonly kind: 'player' | 'bot' | 'generic';
  readonly cell: Vec3i;
  readonly facing?: Direction2D;
  readonly teamId?: string;
};

/** Static map definition — authored content, not runtime state. */
export type MapDefinition = {
  readonly id: string;
  readonly version: 'v0';
  readonly name: string;
  readonly description?: string;
  readonly size: Vec3i;
  readonly cells: MapCell[][][];
  readonly spawns: SpawnPoint[];
  readonly rules?: MatchRuleOverrides;
  readonly tags?: string[];
};

/** Actor override within a scenario. */
export type ScenarioActor = {
  readonly id: string;
  readonly spawnCell: Vec3i;
  readonly facing?: Direction2D;
  readonly count?: number;
  readonly power?: number;
  readonly upgrade?: Upgrade;
  readonly stunned?: number;
};

/** Pre-placed bomb within a scenario. */
export type ScenarioBomb = {
  readonly id: string;
  readonly ownerActorId: string;
  readonly bombType: BombType;
  readonly cell: Vec3i;
  readonly power: number;
  readonly fuseTicksRemaining: number;
};

/** Scenario definition — custom starting setup layered on a map. */
export type ScenarioDefinition = {
  readonly id: string;
  readonly mapId: string;
  readonly configOverrides?: Partial<MatchConfig>;
  readonly actors?: ScenarioActor[];
  readonly bombs?: ScenarioBomb[];
  readonly notes?: string;
};
