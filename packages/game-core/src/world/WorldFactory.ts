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
import { SeededRng } from '@bomberman65/shared';

/** Parameters needed to construct a world snapshot. */
export type WorldConstructionParams = {
  readonly map: MapDefinition;
  readonly config: MatchConfig;
  readonly spawnAssignments: SpawnAssignment[];
  readonly scenario?: ScenarioDefinition;
};

/** Builds a WorldSnapshot from authored content and configuration. */
export function buildWorldSnapshot(params: WorldConstructionParams): WorldSnapshot {
  const { map, config, spawnAssignments, scenario } = params;
  const rng = new SeededRng(config.seed);

  // Step 1: Create empty cell grid
  const cells = createEmptyCellGrid(map.size);

  // Step 2: Copy terrain and resolve items from map
  copyTerrainAndItems(cells, map, rng);

  // Steps 3-4: Create and place actors
  const actors: Record<string, ActorState> = {};
  createActorsFromSpawns(actors, cells, map, config, spawnAssignments);

  // Step 5: Initialize bomb table
  const bombs: Record<string, BombState> = {};

  // Step 7: Apply scenario overrides
  if (scenario) {
    applyScenarioOverrides(actors, bombs, cells, scenario, config);
  }

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

function copyTerrainAndItems(cells: Cell[][][], map: MapDefinition, rng: SeededRng): void {
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

        // Resolve item placement with seeded RNG for dropChance
        if (mapCell.item) {
          const dropChance = mapCell.item.dropChance ?? 1;
          if (rng.chance(dropChance)) {
            // Hidden items are not visible until breakable is destroyed
            // For runtime, we still place the item in the cell — the breakable terrain blocks access
            cell.item = mapCell.item.type;
          }
        }
      }
    }
  }
}

function createActorsFromSpawns(
  actors: Record<string, ActorState>,
  cells: Cell[][][],
  map: MapDefinition,
  config: MatchConfig,
  spawnAssignments: SpawnAssignment[],
): void {
  for (const assignment of spawnAssignments) {
    const spawn = map.spawns.find((s) => s.id === assignment.spawnId);
    if (!spawn) continue;

    // Step 6: Apply default actor attributes from config
    const actor: ActorState = {
      id: assignment.actorId,
      cell: { ...spawn.cell },
      facing: spawn.facing ?? 'south',
      count: config.defaultActorCount,
      power: config.defaultActorPower,
      upgrade: config.defaultActorUpgrade,
      stunTicksRemaining: 0,
      shieldTicksRemaining: config.defaultActorUpgrade === 'shield' ? config.shieldTicks : 0,
      state: { kind: 'idle' },
    };

    actors[actor.id] = actor;

    // Place actor as occupant in cell
    const cell = cells[spawn.cell.z]?.[spawn.cell.y]?.[spawn.cell.x];
    if (cell) {
      cell.occupant = { kind: 'actor', id: actor.id };
    }
  }
}

function applyScenarioOverrides(
  actors: Record<string, ActorState>,
  bombs: Record<string, BombState>,
  cells: Cell[][][],
  scenario: ScenarioDefinition,
  config: MatchConfig,
): void {
  // Override or create actors from scenario
  if (scenario.actors) {
    for (const sa of scenario.actors) {
      const existing = actors[sa.id];
      if (existing) {
        // Override existing actor attributes
        if (sa.count !== undefined) existing.count = sa.count;
        if (sa.power !== undefined) existing.power = sa.power;
        if (sa.upgrade !== undefined) existing.upgrade = sa.upgrade;
        if (sa.stunned !== undefined) existing.stunTicksRemaining = sa.stunned;
      } else {
        // Create new actor from scenario
        const actor: ActorState = {
          id: sa.id,
          cell: { ...sa.spawnCell },
          facing: sa.facing ?? 'south',
          count: sa.count ?? config.defaultActorCount,
          power: sa.power ?? config.defaultActorPower,
          upgrade: sa.upgrade ?? config.defaultActorUpgrade,
          stunTicksRemaining: sa.stunned ?? 0,
          shieldTicksRemaining: 0,
          state: { kind: 'idle' },
        };
        actors[actor.id] = actor;

        const cell = cells[sa.spawnCell.z]?.[sa.spawnCell.y]?.[sa.spawnCell.x];
        if (cell) {
          cell.occupant = { kind: 'actor', id: actor.id };
        }
      }
    }
  }

  // Create authored starting bombs from scenario
  if (scenario.bombs) {
    for (const sb of scenario.bombs) {
      const bomb: BombState = {
        id: sb.id,
        ownerActorId: sb.ownerActorId,
        bombType: sb.bombType,
        cell: { ...sb.cell },
        power: sb.power,
        fuseTicksRemaining: sb.fuseTicksRemaining,
        initialFuseTicks: sb.fuseTicksRemaining,
        state: { kind: 'idle' },
      };
      bombs[bomb.id] = bomb;

      const cell = cells[sb.cell.z]?.[sb.cell.y]?.[sb.cell.x];
      if (cell) {
        cell.occupant = { kind: 'bomb', id: bomb.id };
      }
    }
  }
}
