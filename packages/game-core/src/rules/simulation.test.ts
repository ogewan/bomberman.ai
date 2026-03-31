/**
 * Targeted unit tests for core simulation rules.
 * Covers: movement, bomb placement, explosions, item collection,
 * falling, determinism, and the full tick pipeline.
 */

import { describe, it, expect } from 'vitest';
import type {
  MapDefinition,
  MatchConfig,
  ActorState,
  BombState,
  WorldSnapshot,
  ActorIntent,
} from '@bomberman65/shared';
import { DEFAULT_MATCH_CONFIG } from '@bomberman65/shared';
import { createSimulationRun } from '../factories/SimulationRunFactory.js';
import { SimulationRunner } from '../run/SimulationRunner.js';
import { IdleIntentCollector } from '../intents/IntentCollector.js';
import { executeTick } from '../run/TickPipeline.js';

// --- Helpers ---

function makeConfig(overrides?: Partial<MatchConfig>): MatchConfig {
  return {
    ...DEFAULT_MATCH_CONFIG,
    mapId: 'test_map',
    seed: 42,
    ...overrides,
  } as MatchConfig;
}

function makeSmallMap(): MapDefinition {
  return {
    id: 'test_map',
    version: 'v0',
    name: 'Test Map',
    size: { x: 5, y: 5, z: 1 },
    cells: [
      [
        [
          { terrain: 'wall' },
          { terrain: 'wall' },
          { terrain: 'wall' },
          { terrain: 'wall' },
          { terrain: 'wall' },
        ],
        [
          { terrain: 'wall' },
          { terrain: 'empty' },
          { terrain: 'empty' },
          { terrain: 'empty' },
          { terrain: 'wall' },
        ],
        [
          { terrain: 'wall' },
          { terrain: 'empty' },
          { terrain: 'breakable' },
          { terrain: 'empty' },
          { terrain: 'wall' },
        ],
        [
          { terrain: 'wall' },
          { terrain: 'empty' },
          { terrain: 'empty' },
          { terrain: 'empty' },
          { terrain: 'wall' },
        ],
        [
          { terrain: 'wall' },
          { terrain: 'wall' },
          { terrain: 'wall' },
          { terrain: 'wall' },
          { terrain: 'wall' },
        ],
      ],
    ],
    spawns: [
      { id: 'sp1', kind: 'player', cell: { x: 1, y: 1, z: 0 }, facing: 'east' },
      { id: 'sp2', kind: 'bot', cell: { x: 3, y: 3, z: 0 }, facing: 'west' },
    ],
  };
}

function createTestRun(map?: MapDefinition, configOverrides?: Partial<MatchConfig>) {
  const m = map ?? makeSmallMap();
  const config = makeConfig({ ...configOverrides, mapId: m.id });
  const { run } = createSimulationRun({
    map: m,
    config,
    spawnAssignments: m.spawns.map((s) => ({
      spawnId: s.id,
      actorId: `actor_${s.id}`,
      controller: s.kind === 'player' ? ('player' as const) : ('bot' as const),
    })),
  });
  return run;
}

function getActor(snapshot: WorldSnapshot, partialId: string): ActorState {
  const actor = Object.values(snapshot.actors).find((a) =>
    (a as ActorState).id.includes(partialId),
  ) as ActorState;
  if (!actor) throw new Error(`Actor matching '${partialId}' not found`);
  return actor;
}

// --- Tests ---

describe('World construction', () => {
  it('creates actors at spawn positions', () => {
    const run = createTestRun();
    const snapshot = run.snapshot;

    expect(Object.keys(snapshot.actors)).toHaveLength(2);
    const a1 = getActor(snapshot, 'sp1');
    expect(a1.cell).toEqual({ x: 1, y: 1, z: 0 });
    expect(a1.facing).toBe('east');

    const a2 = getActor(snapshot, 'sp2');
    expect(a2.cell).toEqual({ x: 3, y: 3, z: 0 });
  });

  it('copies terrain from map', () => {
    const run = createTestRun();
    const snapshot = run.snapshot;

    expect(snapshot.cells[0]![0]![0]!.terrain).toBe('wall');
    expect(snapshot.cells[0]![1]![1]!.terrain).toBe('empty');
    expect(snapshot.cells[0]![2]![2]!.terrain).toBe('breakable');
  });

  it('sets occupants at spawn cells', () => {
    const run = createTestRun();
    const cell = run.snapshot.cells[0]![1]![1]!;
    expect(cell.occupant).toEqual({ kind: 'actor', id: 'actor_sp1' });
  });

  it('starts at tick 0 with idle status', () => {
    const run = createTestRun();
    expect(run.snapshot.tick).toBe(0);
    expect(run.status).toBe('idle');
  });
});

describe('Movement', () => {
  it('idle intent does not change actor state', () => {
    const run = createTestRun();
    const snapshot = run.snapshot;
    const actor = getActor(snapshot, 'sp1');
    const startCell = { ...actor.cell };

    executeTick(snapshot, [{ kind: 'idle', actorId: actor.id }]);

    expect(actor.cell).toEqual(startCell);
    expect(actor.state.kind).toBe('idle');
  });

  it('move intent starts surface travel', () => {
    const run = createTestRun();
    const snapshot = run.snapshot;
    const actor = getActor(snapshot, 'sp1');

    executeTick(snapshot, [{ kind: 'move', actorId: actor.id, direction: 'east' }]);

    expect(actor.state.kind).toBe('surfaceTravel');
    if (actor.state.kind === 'surfaceTravel') {
      expect(actor.state.from).toEqual({ x: 1, y: 1, z: 0 });
      expect(actor.state.to).toEqual({ x: 2, y: 1, z: 0 });
      expect(actor.state.phase).toBe('leaving');
    }
  });

  it('movement into wall is rejected', () => {
    const run = createTestRun();
    const snapshot = run.snapshot;
    const actor = getActor(snapshot, 'sp1');

    // North is a wall at y=0
    executeTick(snapshot, [{ kind: 'move', actorId: actor.id, direction: 'north' }]);

    expect(actor.state.kind).toBe('idle');
    expect(actor.cell).toEqual({ x: 1, y: 1, z: 0 });
  });

  it('actor completes movement after enough ticks', () => {
    const run = createTestRun();
    const snapshot = run.snapshot;
    const actor = getActor(snapshot, 'sp1');

    // Start move east (to breakable at 2,2 is blocked, but 2,1 is empty)
    executeTick(snapshot, [{ kind: 'move', actorId: actor.id, direction: 'east' }]);

    // Run enough ticks for move to complete (30 ticks default)
    for (let i = 0; i < 35; i++) {
      executeTick(snapshot, []);
    }

    expect(actor.state.kind).toBe('idle');
    expect(actor.cell).toEqual({ x: 2, y: 1, z: 0 });
  });
});

describe('Bomb placement', () => {
  it('places a bomb at actor position', () => {
    const run = createTestRun();
    const snapshot = run.snapshot;
    const actor = getActor(snapshot, 'sp1');

    executeTick(snapshot, [{ kind: 'placeBomb', actorId: actor.id }]);

    const bombs = Object.values(snapshot.bombs) as BombState[];
    expect(bombs.length).toBe(1);
    expect(bombs[0]!.cell).toEqual(actor.cell);
    expect(bombs[0]!.ownerActorId).toBe(actor.id);
    expect(bombs[0]!.bombType).toBe('regular');
  });

  it('respects bomb count limit', () => {
    const run = createTestRun();
    const snapshot = run.snapshot;
    const actor = getActor(snapshot, 'sp1');
    expect(actor.count).toBe(1); // Default count is 1

    // Place first bomb
    executeTick(snapshot, [{ kind: 'placeBomb', actorId: actor.id }]);
    expect(Object.keys(snapshot.bombs)).toHaveLength(1);

    // Try to place second — should be rejected
    executeTick(snapshot, [{ kind: 'placeBomb', actorId: actor.id }]);
    expect(Object.keys(snapshot.bombs)).toHaveLength(1);
  });
});

describe('Explosion', () => {
  it('bomb explodes after fuse expires', () => {
    const run = createTestRun();
    const snapshot = run.snapshot;

    // Manually place a bomb with short fuse
    const bombId = 'fuse_test';
    snapshot.bombs[bombId] = {
      id: bombId,
      ownerActorId: 'actor_sp1',
      bombType: 'regular',
      cell: { x: 2, y: 1, z: 0 },
      power: 1,
      fuseTicksRemaining: 2,
      state: { kind: 'idle' },
    };
    const bomb = snapshot.bombs[bombId]!;

    // Tick 1: fuse 2→1
    executeTick(snapshot, []);
    expect(bomb.state.kind).toBe('idle');

    // Tick 2: fuse 1→0, then transition to exploding
    executeTick(snapshot, []);
    expect(bomb.state.kind).toBe('exploding');
  });

  it('explosion destroys breakable terrain', () => {
    const run = createTestRun(undefined, { regularBombFuseTicks: 2 });
    const snapshot = run.snapshot;

    // Manually place a bomb adjacent to the breakable at (2,2)
    const bombId = 'test_bomb';
    snapshot.bombs[bombId] = {
      id: bombId,
      ownerActorId: 'actor_sp1',
      bombType: 'regular',
      cell: { x: 2, y: 1, z: 0 },
      power: 2,
      fuseTicksRemaining: 1,
      state: { kind: 'idle' },
    };

    expect(snapshot.cells[0]![2]![2]!.terrain).toBe('breakable');

    // Tick to detonate
    executeTick(snapshot, []);
    executeTick(snapshot, []);

    expect(snapshot.cells[0]![2]![2]!.terrain).toBe('empty');
  });

  it('explosion eliminates unshielded actor', () => {
    const run = createTestRun(undefined, { regularBombFuseTicks: 1 });
    const snapshot = run.snapshot;
    const actor2 = getActor(snapshot, 'sp2');

    // Place bomb at (3,2) adjacent to actor2 at (3,3) with power 2
    snapshot.bombs['kill_bomb'] = {
      id: 'kill_bomb',
      ownerActorId: 'actor_sp1',
      bombType: 'regular',
      cell: { x: 3, y: 2, z: 0 },
      power: 2,
      fuseTicksRemaining: 1,
      state: { kind: 'idle' },
    };

    executeTick(snapshot, []);
    executeTick(snapshot, []);

    expect(actor2.state.kind).toBe('eliminated');
  });

  it('shield prevents elimination', () => {
    const run = createTestRun(undefined, { regularBombFuseTicks: 1 });
    const snapshot = run.snapshot;
    const actor2 = getActor(snapshot, 'sp2');
    actor2.shieldTicksRemaining = 100;

    snapshot.bombs['shield_bomb'] = {
      id: 'shield_bomb',
      ownerActorId: 'actor_sp1',
      bombType: 'regular',
      cell: { x: 3, y: 2, z: 0 },
      power: 2,
      fuseTicksRemaining: 1,
      state: { kind: 'idle' },
    };

    executeTick(snapshot, []);
    executeTick(snapshot, []);

    expect(actor2.state.kind).not.toBe('eliminated');
  });
});

describe('SimulationRunner', () => {
  it('lifecycle: idle → running → paused → running → finished', () => {
    const run = createTestRun(undefined, { maxTicks: 5 });
    const runner = new SimulationRunner(run, new IdleIntentCollector());

    expect(run.status).toBe('idle');

    runner.start();
    expect(run.status).toBe('running');

    runner.pause();
    expect(run.status).toBe('paused');

    runner.resume();
    expect(run.status).toBe('running');

    runner.stepTicks(10);
    expect(run.status).toBe('finished');
    expect(run.result).toBeDefined();
    expect(run.result!.reason).toBe('timeout');
  });

  it('detects elimination victory', () => {
    const run = createTestRun(undefined, { regularBombFuseTicks: 1 });
    const snapshot = run.snapshot;
    const actor2 = getActor(snapshot, 'sp2');

    // Place lethal bomb
    snapshot.bombs['lethal'] = {
      id: 'lethal',
      ownerActorId: 'actor_sp1',
      bombType: 'regular',
      cell: { x: 3, y: 2, z: 0 },
      power: 2,
      fuseTicksRemaining: 1,
      state: { kind: 'idle' },
    };

    const runner = new SimulationRunner(run, new IdleIntentCollector());
    runner.start();
    runner.stepTicks(5);

    expect(actor2.state.kind).toBe('eliminated');
    expect(run.status).toBe('finished');
    expect(run.result?.reason).toBe('elimination');
    expect(run.result?.winnerId).toBe('actor_sp1');
  });
});

describe('Determinism', () => {
  it('same inputs produce identical results', () => {
    const intents: ActorIntent[][] = [
      [{ kind: 'placeBomb', actorId: 'actor_sp1' }],
      [],
      [{ kind: 'move', actorId: 'actor_sp1', direction: 'south' }],
    ];

    function runSimulation() {
      const r = createTestRun(undefined, { regularBombFuseTicks: 10 });
      const snapshot = r.snapshot;
      for (let i = 0; i < 20; i++) {
        executeTick(snapshot, intents[i] ?? []);
      }
      return snapshot;
    }

    const result1 = runSimulation();
    const result2 = runSimulation();

    expect(result1.tick).toBe(result2.tick);
    expect(Object.keys(result1.actors).length).toBe(Object.keys(result2.actors).length);

    for (const id of Object.keys(result1.actors)) {
      const a1 = result1.actors[id] as ActorState;
      const a2 = result2.actors[id] as ActorState;
      expect(a1.cell).toEqual(a2.cell);
      expect(a1.state.kind).toBe(a2.state.kind);
      expect(a1.power).toBe(a2.power);
      expect(a1.count).toBe(a2.count);
    }
  });
});

describe('Validation', () => {
  it('rejects map with height exceeding v0 limit', () => {
    const map: MapDefinition = {
      id: 'tall',
      version: 'v0',
      name: 'Too Tall',
      size: { x: 3, y: 3, z: 5 },
      cells: [],
      spawns: [],
    };

    expect(() =>
      createSimulationRun({
        map,
        config: makeConfig({ mapId: 'tall' }),
        spawnAssignments: [],
      }),
    ).toThrow(/height/i);
  });
});
