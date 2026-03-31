/**
 * Tests for map and scenario validation.
 */

import { describe, it, expect } from 'vitest';
import type { MapDefinition, ScenarioDefinition } from '@bomberman65/shared';
import { validateMap } from '../validation/validateMap.js';
import { validateScenario } from '../validation/validateScenario.js';
import { ValidationPipeline, ValidationError } from '../validation/ValidationPipeline.js';

function makeValidMap(): MapDefinition {
  return {
    id: 'valid_map',
    version: 'v0',
    name: 'Valid Map',
    size: { x: 3, y: 3, z: 1 },
    cells: [
      [
        [{ terrain: 'wall' }, { terrain: 'wall' }, { terrain: 'wall' }],
        [{ terrain: 'wall' }, { terrain: 'empty' }, { terrain: 'wall' }],
        [{ terrain: 'wall' }, { terrain: 'wall' }, { terrain: 'wall' }],
      ],
    ],
    spawns: [{ id: 'sp1', kind: 'player', cell: { x: 1, y: 1, z: 0 } }],
  };
}

describe('Map validation', () => {
  it('passes for a valid map', () => {
    const issues = validateMap(makeValidMap());
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('rejects height exceeding v0 limit', () => {
    const map = makeValidMap();
    (map as { size: { x: number; y: number; z: number } }).size = { x: 3, y: 3, z: 5 };
    const issues = validateMap(map);
    expect(issues.some((i) => i.code === 'MAP_HEIGHT_EXCEEDS_V0_LIMIT')).toBe(true);
  });

  it('rejects spawn on wall terrain', () => {
    const map = makeValidMap();
    map.spawns[0] = { id: 'sp1', kind: 'player', cell: { x: 0, y: 0, z: 0 } };
    const issues = validateMap(map);
    expect(issues.some((i) => i.code === 'MAP_SPAWN_NOT_WALKABLE')).toBe(true);
  });

  it('rejects overlapping spawns', () => {
    const map = makeValidMap();
    map.spawns.push({ id: 'sp2', kind: 'bot', cell: { x: 1, y: 1, z: 0 } });
    const issues = validateMap(map);
    expect(issues.some((i) => i.code === 'MAP_SPAWN_OVERLAP')).toBe(true);
  });

  it('rejects hidden item in non-breakable cell', () => {
    const map = makeValidMap();
    map.cells[0]![1]![1] = {
      terrain: 'empty',
      item: { type: 'power', hiddenInBreakable: true, dropChance: 1 },
    };
    const issues = validateMap(map);
    expect(issues.some((i) => i.code === 'MAP_HIDDEN_ITEM_NOT_BREAKABLE')).toBe(true);
  });

  it('rejects invalid dropChance range', () => {
    const map = makeValidMap();
    map.cells[0]![1]![1] = {
      terrain: 'empty',
      item: { type: 'power', dropChance: 1.5 },
    };
    const issues = validateMap(map);
    expect(issues.some((i) => i.code === 'MAP_ITEM_DROP_CHANCE_RANGE')).toBe(true);
  });

  it('rejects ramp terrain without ramp data', () => {
    const map = makeValidMap();
    map.cells[0]![1]![1] = { terrain: 'ramp' };
    const issues = validateMap(map);
    expect(issues.some((i) => i.code === 'MAP_RAMP_MISSING_DATA')).toBe(true);
  });
});

describe('Scenario validation', () => {
  it('passes for a valid scenario', () => {
    const map = makeValidMap();
    const scenario: ScenarioDefinition = {
      id: 'sc1',
      mapId: 'valid_map',
      actors: [{ id: 'a1', spawnCell: { x: 1, y: 1, z: 0 } }],
    };
    const issues = validateScenario(scenario, map);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('rejects mapId mismatch', () => {
    const map = makeValidMap();
    const scenario: ScenarioDefinition = {
      id: 'sc1',
      mapId: 'wrong_map',
    };
    const issues = validateScenario(scenario, map);
    expect(issues.some((i) => i.code === 'SCENARIO_MAP_MISMATCH')).toBe(true);
  });

  it('rejects duplicate actor ids', () => {
    const map = makeValidMap();
    const scenario: ScenarioDefinition = {
      id: 'sc1',
      mapId: 'valid_map',
      actors: [
        { id: 'a1', spawnCell: { x: 1, y: 1, z: 0 } },
        { id: 'a1', spawnCell: { x: 1, y: 1, z: 0 } },
      ],
    };
    const issues = validateScenario(scenario, map);
    expect(issues.some((i) => i.code === 'SCENARIO_DUPLICATE_ACTOR')).toBe(true);
  });

  it('warns on bomb with missing owner', () => {
    const map = makeValidMap();
    const scenario: ScenarioDefinition = {
      id: 'sc1',
      mapId: 'valid_map',
      bombs: [
        {
          id: 'b1',
          ownerActorId: 'ghost',
          bombType: 'regular',
          cell: { x: 1, y: 1, z: 0 },
          power: 1,
          fuseTicksRemaining: 10,
        },
      ],
    };
    const issues = validateScenario(scenario, map);
    expect(issues.some((i) => i.code === 'SCENARIO_BOMB_OWNER_MISSING')).toBe(true);
  });
});

describe('ValidationPipeline', () => {
  it('throws in strict mode on errors', () => {
    const pipeline = new ValidationPipeline('strict');
    const map = makeValidMap();
    (map as { size: { x: number; y: number; z: number } }).size = { x: 3, y: 3, z: 5 };
    expect(() => pipeline.validateMap(map)).toThrow(ValidationError);
  });

  it('downgrades errors to warnings in lenient mode', () => {
    const pipeline = new ValidationPipeline('lenient');
    const map = makeValidMap();
    (map as { size: { x: number; y: number; z: number } }).size = { x: 3, y: 3, z: 5 };
    const result = pipeline.validateMap(map);
    expect(result.valid).toBe(false);
    expect(result.issues.every((i) => i.severity === 'warning')).toBe(true);
  });
});
