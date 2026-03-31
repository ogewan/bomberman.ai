/**
 * WorldFactory — constructs a WorldSnapshot from a MapDefinition, MatchConfig, spawn assignments,
 * and an optional ScenarioDefinition.
 *
 * Construction steps (from Map and Content Schema spec):
 * 1. Create empty world snapshot with dimensions
 * 2. Copy terrain and embedded items from map cells into runtime cells
 * 3. Create actors from spawn assignments
 * 4. Place actors into runtime cells
 * 5. Initialize bomb table as empty unless a scenario defines bombs
 * 6. Apply default actor attributes from config
 * 7. Apply scenario overrides if present
 * 8. Set seed and start tick at 0
 *
 * Full implementation deferred to Phase 3 (map/scenario loading and validation).
 */

import type {
  WorldSnapshot,
  Cell,
  ActorState,
  BombState,
  MapDefinition,
  MatchConfig,
  SpawnAssignment,
  ScenarioDefinition,
  Vec3i,
} from '@bomberman65/shared';

/** Parameters needed to construct a world snapshot. */
export type WorldConstructionParams = {
  readonly map: MapDefinition;
  readonly config: MatchConfig;
  readonly spawnAssignments: SpawnAssignment[];
  readonly scenario?: ScenarioDefinition;
};

/**
 * Builds a WorldSnapshot from authored content and configuration.
 * Phase 3 will provide the full implementation with validation.
 */
export function buildWorldSnapshot(params: WorldConstructionParams): WorldSnapshot {
  const { map } = params;

  // Step 1: Create empty cell grid
  const cells = createEmptyCellGrid(map.size);

  // Step 2: Copy terrain from map (stub — full implementation in Phase 3)
  copyTerrainFromMap(cells, map);

  // Steps 3-7: Actor and bomb creation (stub — full implementation in Phase 3)
  const actors: Record<string, ActorState> = {};
  const bombs: Record<string, BombState> = {};

  return {
    tick: 0,
    size: { ...map.size },
    cells,
    actors,
    bombs,
  };
}

function createEmptyCellGrid(size: Vec3i): Cell[][][] {
  const grid: Cell[][][] = [];
  for (let z = 0; z < size.z; z++) {
    const layer: Cell[][] = [];
    for (let y = 0; y < size.y; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < size.x; x++) {
        row.push({ terrain: 'empty' });
      }
      layer.push(row);
    }
    grid.push(layer);
  }
  return grid;
}

function copyTerrainFromMap(cells: Cell[][][], map: MapDefinition): void {
  for (let z = 0; z < map.size.z; z++) {
    const mapLayer = map.cells[z];
    if (!mapLayer) continue;
    for (let y = 0; y < map.size.y; y++) {
      const mapRow = mapLayer[y];
      if (!mapRow) continue;
      for (let x = 0; x < map.size.x; x++) {
        const mapCell = mapRow[x];
        if (!mapCell) continue;
        const cell = cells[z]![y]![x]!;
        cell.terrain = mapCell.terrain;
        if (mapCell.ramp) {
          cell.ramp = { ...mapCell.ramp };
        }
        // Item placement resolved in Phase 3 with seeded RNG for dropChance
      }
    }
  }
}
