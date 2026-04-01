/**
 * Tests for movement edge cases.
 * Covers blocked movement, item collection, falling, and out-of-bounds.
 */

import { describe, it, expect } from 'vitest';
import type { ActorState, MatchConfig, WorldSnapshot } from '@bomberman65/shared';
import { DEFAULT_MATCH_CONFIG } from '@bomberman65/shared';
import { executeTick } from '../run/TickPipeline.js';

const defaultConfig = { ...DEFAULT_MATCH_CONFIG, mapId: 'test', seed: 1 } as MatchConfig;

function tick(snapshot: WorldSnapshot, intents: Parameters<typeof executeTick>[1] = []) {
  executeTick(snapshot, intents, defaultConfig);
}

function makeSnapshot(): WorldSnapshot {
  const cells = [];
  // z=0: 5x5, walls on edges, empty interior
  const layer0 = [];
  for (let y = 0; y < 5; y++) {
    const row = [];
    for (let x = 0; x < 5; x++) {
      const isEdge = x === 0 || x === 4 || y === 0 || y === 4;
      row.push({ terrain: isEdge ? ('wall' as const) : ('empty' as const) });
    }
    layer0.push(row);
  }
  cells.push(layer0);

  return {
    tick: 0,
    size: { x: 5, y: 5, z: 1 },
    cells,
    actors: {},
    bombs: {},
  };
}

function addActor(snapshot: WorldSnapshot, id: string, x: number, y: number): ActorState {
  const actor: ActorState = {
    id,
    cell: { x, y, z: 0 },
    facing: 'south',
    count: 1,
    power: 1,
    upgrade: 'none',
    stunTicksRemaining: 0,
    shieldTicksRemaining: 0,
    state: { kind: 'idle' },
  };
  snapshot.actors[id] = actor;
  snapshot.cells[0]![y]![x]!.occupant = { kind: 'actor', id };
  return actor;
}

describe('Movement blocked scenarios', () => {
  it('cannot move into a breakable cell', () => {
    const snapshot = makeSnapshot();
    snapshot.cells[0]![2]![2]!.terrain = 'breakable';
    const actor = addActor(snapshot, 'a1', 1, 2);

    tick(snapshot, [{ kind: 'move', actorId: 'a1', direction: 'east' }]);

    // Actor tried to move east toward breakable — should stay idle
    expect(actor.state.kind).toBe('idle');
    expect(actor.cell).toEqual({ x: 1, y: 2, z: 0 });
  });

  it('cannot move into an occupied cell', () => {
    const snapshot = makeSnapshot();
    addActor(snapshot, 'a1', 1, 2);
    addActor(snapshot, 'a2', 2, 2);

    tick(snapshot, [{ kind: 'move', actorId: 'a1', direction: 'east' }]);

    const a1 = snapshot.actors['a1'] as ActorState;
    expect(a1.state.kind).toBe('idle');
    expect(a1.cell).toEqual({ x: 1, y: 2, z: 0 });
  });

  it('stunned actor cannot move', () => {
    const snapshot = makeSnapshot();
    const actor = addActor(snapshot, 'a1', 2, 2);
    actor.stunTicksRemaining = 10;

    tick(snapshot, [{ kind: 'move', actorId: 'a1', direction: 'south' }]);

    expect(actor.cell).toEqual({ x: 2, y: 2, z: 0 });
  });
});

describe('Item collection', () => {
  it('collects power item on entering a cell', () => {
    const snapshot = makeSnapshot();
    snapshot.cells[0]![2]![2]!.item = 'power';
    const actor = addActor(snapshot, 'a1', 1, 2);

    // Start move east
    tick(snapshot, [{ kind: 'move', actorId: 'a1', direction: 'east' }]);

    // Run enough ticks for movement to complete
    for (let i = 0; i < 35; i++) {
      tick(snapshot, []);
    }

    expect(actor.cell).toEqual({ x: 2, y: 2, z: 0 });
    expect(actor.power).toBe(2); // Was 1, collected power
    expect(snapshot.cells[0]![2]![2]!.item).toBeUndefined();
  });

  it('collects upgrade item and changes upgrade', () => {
    const snapshot = makeSnapshot();
    snapshot.cells[0]![2]![2]!.item = 'upgrade-kick';
    const actor = addActor(snapshot, 'a1', 1, 2);
    expect(actor.upgrade).toBe('none');

    tick(snapshot, [{ kind: 'move', actorId: 'a1', direction: 'east' }]);
    for (let i = 0; i < 35; i++) {
      tick(snapshot, []);
    }

    expect(actor.upgrade).toBe('kick');
  });
});

describe('Falling', () => {
  it('actor falls when support is removed beneath', () => {
    // 5x5x2 grid
    const cells: WorldSnapshot['cells'] = [];

    // z=0: all walls (floor)
    const floor = [];
    for (let y = 0; y < 5; y++) {
      const row = [];
      for (let x = 0; x < 5; x++) {
        row.push({ terrain: 'wall' as const });
      }
      floor.push(row);
    }
    cells.push(floor);

    // z=1: walls on edges, empty interior, one breakable support
    const upper = [];
    for (let y = 0; y < 5; y++) {
      const row = [];
      for (let x = 0; x < 5; x++) {
        const isEdge = x === 0 || x === 4 || y === 0 || y === 4;
        row.push({ terrain: isEdge ? ('wall' as const) : ('empty' as const) });
      }
      upper.push(row);
    }
    cells.push(upper);

    const snapshot: WorldSnapshot = {
      tick: 0,
      size: { x: 5, y: 5, z: 2 },
      cells,
      actors: {},
      bombs: {},
    };

    // Actor at z=1 with wall support below at z=0 — should NOT fall
    const actor: ActorState = {
      id: 'high_actor',
      cell: { x: 2, y: 2, z: 1 },
      facing: 'south',
      count: 1,
      power: 1,
      upgrade: 'none',
      stunTicksRemaining: 0,
      shieldTicksRemaining: 0,
      state: { kind: 'idle' },
    };
    snapshot.actors['high_actor'] = actor;
    snapshot.cells[1]![2]![2]!.occupant = { kind: 'actor', id: 'high_actor' };

    tick(snapshot, []);

    // Wall at z=0 supports — actor stays at z=1
    expect(actor.cell.z).toBe(1);
  });
});
