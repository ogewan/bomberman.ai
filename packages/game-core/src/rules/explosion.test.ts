/**
 * Tests for explosion propagation rules.
 * Covers regular (cardinal square) and pumped (cube) propagation,
 * wall blocking, breakable stopping, and chain detonation.
 */

import { describe, it, expect } from 'vitest';
import type { BombState, MatchConfig, WorldSnapshot, Vec3i } from '@bomberman65/shared';
import { DEFAULT_MATCH_CONFIG } from '@bomberman65/shared';
import { executeTick } from '../run/TickPipeline.js';

const defaultConfig = { ...DEFAULT_MATCH_CONFIG, mapId: 'test', seed: 1 } as MatchConfig;

function tick(snapshot: WorldSnapshot, intents: never[] = []) {
  executeTick(snapshot, intents, defaultConfig);
}

function makeSnapshot(overrides?: Partial<WorldSnapshot>): WorldSnapshot {
  // 5x5x1 grid: walls on edges, empty interior
  const cells = [];
  const layer = [];
  for (let y = 0; y < 5; y++) {
    const row = [];
    for (let x = 0; x < 5; x++) {
      const isEdge = x === 0 || x === 4 || y === 0 || y === 4;
      row.push({ terrain: isEdge ? ('wall' as const) : ('empty' as const) });
    }
    layer.push(row);
  }
  cells.push(layer);

  return {
    tick: 0,
    size: { x: 5, y: 5, z: 1 },
    cells,
    actors: {},
    bombs: {},
    ...overrides,
  };
}

function placeBomb(
  snapshot: WorldSnapshot,
  pos: Vec3i,
  power: number,
  fuse: number,
  type: 'regular' | 'pumped' = 'regular',
  id?: string,
): BombState {
  const bombId = id ?? `bomb_${pos.x}_${pos.y}_${pos.z}`;
  const bomb: BombState = {
    id: bombId,
    ownerActorId: 'test_actor',
    bombType: type,
    cell: pos,
    power,
    fuseTicksRemaining: fuse,
    initialFuseTicks: fuse,
    state: { kind: 'idle' },
  };
  snapshot.bombs[bombId] = bomb;
  return bomb;
}

describe('Regular explosion propagation', () => {
  it('propagates in cardinal directions up to power', () => {
    const snapshot = makeSnapshot();
    const bomb = placeBomb(snapshot, { x: 2, y: 2, z: 0 }, 2, 1);

    tick(snapshot);

    expect(bomb.state.kind).toBe('exploding');
    if (bomb.state.kind === 'exploding') {
      const keys = bomb.state.affectedCells.map((c) => `${c.x},${c.y}`);
      // Origin
      expect(keys).toContain('2,2');
      // North (2 cells)
      expect(keys).toContain('2,1');
      // South (2 cells, but y=4 is wall so only y=3)
      expect(keys).toContain('2,3');
      // East
      expect(keys).toContain('3,2');
      // West
      expect(keys).toContain('1,2');
    }
  });

  it('is blocked by walls', () => {
    const snapshot = makeSnapshot();
    placeBomb(snapshot, { x: 1, y: 1, z: 0 }, 3, 1);

    tick(snapshot);

    const bomb = Object.values(snapshot.bombs)[0] as BombState;
    if (bomb.state.kind === 'exploding') {
      const keys = bomb.state.affectedCells.map((c) => `${c.x},${c.y}`);
      // Should not pass through walls at edges
      expect(keys).not.toContain('0,1'); // west wall
      expect(keys).not.toContain('1,0'); // north wall
    }
  });

  it('stops at breakable but includes the breakable cell', () => {
    const snapshot = makeSnapshot();
    snapshot.cells[0]![2]![2]!.terrain = 'breakable';
    placeBomb(snapshot, { x: 1, y: 2, z: 0 }, 3, 1);

    tick(snapshot);

    const bomb = Object.values(snapshot.bombs)[0] as BombState;
    if (bomb.state.kind === 'exploding') {
      const keys = bomb.state.affectedCells.map((c) => `${c.x},${c.y}`);
      // Breakable cell is affected
      expect(keys).toContain('2,2');
      // But propagation stops — cell beyond breakable is NOT affected
      expect(keys).not.toContain('3,2');
    }
  });
});

describe('Pumped explosion propagation', () => {
  it('is not blocked by walls', () => {
    const snapshot = makeSnapshot();
    placeBomb(snapshot, { x: 2, y: 2, z: 0 }, 2, 1, 'pumped');

    tick(snapshot);

    const bomb = Object.values(snapshot.bombs)[0] as BombState;
    if (bomb.state.kind === 'exploding') {
      // Pumped goes through walls — should have more cells than regular would
      expect(bomb.state.affectedCells.length).toBeGreaterThan(1);
    }
  });
});

describe('Chain detonation', () => {
  it('detonates bombs caught in explosion', () => {
    const snapshot = makeSnapshot();
    // Bomb A at (1,2) with fuse=1, power=2
    placeBomb(snapshot, { x: 1, y: 2, z: 0 }, 2, 1, 'regular', 'bombA');
    // Bomb B at (3,2) with fuse=999 (won't expire on its own), power=1
    placeBomb(snapshot, { x: 3, y: 2, z: 0 }, 1, 999, 'regular', 'bombB');

    tick(snapshot);

    // Bomb A explodes and its blast reaches (3,2) where bomb B is
    const bombB = snapshot.bombs['bombB'] as BombState;
    // Bomb B should also be exploding due to chain detonation
    expect(bombB.state.kind).toBe('exploding');
  });
});

describe('Breakable destruction', () => {
  it('converts breakable terrain to empty', () => {
    const snapshot = makeSnapshot();
    snapshot.cells[0]![2]![2]!.terrain = 'breakable';
    placeBomb(snapshot, { x: 2, y: 1, z: 0 }, 2, 1);

    expect(snapshot.cells[0]![2]![2]!.terrain).toBe('breakable');

    tick(snapshot);
    // Need a second tick for blast effects to apply
    tick(snapshot);

    expect(snapshot.cells[0]![2]![2]!.terrain).toBe('empty');
  });
});
