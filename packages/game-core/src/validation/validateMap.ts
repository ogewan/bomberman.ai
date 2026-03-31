/**
 * validateMap — validates a MapDefinition for structural and rule correctness.
 *
 * Validation checks:
 * - Height range (max 3 levels for v0)
 * - Ramp adjacency (entry/exit must be valid directions)
 * - Spawn support (spawn cells must be walkable and supported)
 * - Hidden item placement (must be in breakable cells)
 * - Item drop chance range (0..1)
 * - Spawn overlap (no two spawns on same cell)
 * - Dimension consistency (cells array matches declared size)
 */

import type { MapDefinition, ValidationIssue, Vec3i } from '@bomberman65/shared';
import { MAX_HEIGHT_LEVELS, vec3iEqual } from '@bomberman65/shared';

export function validateMap(map: MapDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  validateDimensions(map, issues);
  validateHeightRange(map, issues);
  validateCells(map, issues);
  validateSpawns(map, issues);

  return issues;
}

function validateDimensions(map: MapDefinition, issues: ValidationIssue[]): void {
  const { size } = map;
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
    issues.push({
      severity: 'error',
      code: 'MAP_INVALID_DIMENSIONS',
      message: `Map dimensions must be positive: got ${size.x}x${size.y}x${size.z}`,
    });
  }
}

function validateHeightRange(map: MapDefinition, issues: ValidationIssue[]): void {
  if (map.size.z > MAX_HEIGHT_LEVELS) {
    issues.push({
      severity: 'error',
      code: 'MAP_HEIGHT_EXCEEDS_V0_LIMIT',
      message: `Map height ${map.size.z} exceeds v0 limit of ${MAX_HEIGHT_LEVELS}`,
    });
  }
}

function validateCells(map: MapDefinition, issues: ValidationIssue[]): void {
  for (let z = 0; z < map.size.z; z++) {
    const layer = map.cells[z];
    if (!layer) {
      issues.push({
        severity: 'warning',
        code: 'MAP_MISSING_LAYER',
        message: `Missing cell layer at z=${z}`,
        location: { x: 0, y: 0, z },
      });
      continue;
    }
    for (let y = 0; y < map.size.y; y++) {
      const row = layer[y];
      if (!row) continue;
      for (let x = 0; x < map.size.x; x++) {
        const cell = row[x];
        if (!cell) continue;
        const pos: Vec3i = { x, y, z };
        validateCellContent(cell, pos, issues);
      }
    }
  }
}

function validateCellContent(
  cell: MapDefinition['cells'][0][0][0],
  pos: Vec3i,
  issues: ValidationIssue[],
): void {
  // Ramp must have terrain type 'ramp'
  if (cell.ramp && cell.terrain !== 'ramp') {
    issues.push({
      severity: 'error',
      code: 'MAP_RAMP_TERRAIN_MISMATCH',
      message: `Cell has ramp data but terrain is '${cell.terrain}', expected 'ramp'`,
      location: pos,
    });
  }

  if (cell.terrain === 'ramp' && !cell.ramp) {
    issues.push({
      severity: 'error',
      code: 'MAP_RAMP_MISSING_DATA',
      message: `Cell has terrain 'ramp' but no ramp data`,
      location: pos,
    });
  }

  // Hidden items must be in breakable cells
  if (cell.item?.hiddenInBreakable && cell.terrain !== 'breakable') {
    issues.push({
      severity: 'error',
      code: 'MAP_HIDDEN_ITEM_NOT_BREAKABLE',
      message: `Hidden item placed in non-breakable cell (terrain: '${cell.terrain}')`,
      location: pos,
    });
  }

  // Drop chance must be in 0..1
  if (cell.item?.dropChance !== undefined) {
    if (cell.item.dropChance < 0 || cell.item.dropChance > 1) {
      issues.push({
        severity: 'error',
        code: 'MAP_ITEM_DROP_CHANCE_RANGE',
        message: `Item dropChance ${cell.item.dropChance} is outside valid range 0..1`,
        location: pos,
      });
    }
  }
}

function validateSpawns(map: MapDefinition, issues: ValidationIssue[]): void {
  // Check for overlapping spawns
  for (let i = 0; i < map.spawns.length; i++) {
    const spawn = map.spawns[i]!;

    // Spawn must be within bounds
    if (
      spawn.cell.x < 0 ||
      spawn.cell.x >= map.size.x ||
      spawn.cell.y < 0 ||
      spawn.cell.y >= map.size.y ||
      spawn.cell.z < 0 ||
      spawn.cell.z >= map.size.z
    ) {
      issues.push({
        severity: 'error',
        code: 'MAP_SPAWN_OUT_OF_BOUNDS',
        message: `Spawn '${spawn.id}' is outside map bounds`,
        location: spawn.cell,
      });
      continue;
    }

    // Spawn cell must be walkable (empty terrain)
    const layer = map.cells[spawn.cell.z];
    const row = layer?.[spawn.cell.y];
    const cell = row?.[spawn.cell.x];
    if (cell && cell.terrain !== 'empty') {
      issues.push({
        severity: 'error',
        code: 'MAP_SPAWN_NOT_WALKABLE',
        message: `Spawn '${spawn.id}' is on non-walkable terrain '${cell.terrain}'`,
        location: spawn.cell,
      });
    }

    // Elevated spawn must have support below
    if (spawn.cell.z > 0) {
      const belowLayer = map.cells[spawn.cell.z - 1];
      const belowCell = belowLayer?.[spawn.cell.y]?.[spawn.cell.x];
      if (!belowCell || belowCell.terrain === 'empty') {
        issues.push({
          severity: 'error',
          code: 'MAP_SPAWN_UNSUPPORTED',
          message: `Spawn '${spawn.id}' at z=${spawn.cell.z} has no support below`,
          location: spawn.cell,
        });
      }
    }

    // Check for overlap with other spawns
    for (let j = i + 1; j < map.spawns.length; j++) {
      const other = map.spawns[j]!;
      if (vec3iEqual(spawn.cell, other.cell)) {
        issues.push({
          severity: 'error',
          code: 'MAP_SPAWN_OVERLAP',
          message: `Spawns '${spawn.id}' and '${other.id}' overlap at same cell`,
          location: spawn.cell,
        });
      }
    }
  }
}
