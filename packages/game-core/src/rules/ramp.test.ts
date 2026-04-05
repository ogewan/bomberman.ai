/**
 * Tests for ramp traversal — actors and kicked bombs moving across ramps.
 */

import { describe, it, expect } from 'vitest';
import type { ActorState, BombState, Cell, MatchConfig, WorldSnapshot } from '@bomberman65/shared';
import { DEFAULT_MATCH_CONFIG } from '@bomberman65/shared';
import { executeTick } from '../run/TickPipeline.js';
import { validateMap } from '../validation/validateMap.js';

const config = { ...DEFAULT_MATCH_CONFIG, mapId: 'test', seed: 1 } as MatchConfig;

function tick(snapshot: WorldSnapshot, intents: Parameters<typeof executeTick>[1] = []) {
  executeTick(snapshot, intents, config);
}

/** Build a 5x5x2 snapshot with walls on z=0 edges, empty interior, and a ramp. */
function makeRampSnapshot(): WorldSnapshot {
  const cells: Cell[][][] = [];

  // z=0: walls on edges, empty interior
  const layer0: Cell[][] = [];
  for (let y = 0; y < 5; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < 5; x++) {
      const isEdge = x === 0 || x === 4 || y === 0 || y === 4;
      row.push({ terrain: isEdge ? 'wall' : 'empty' });
    }
    layer0.push(row);
  }
  cells.push(layer0);

  // z=1: all empty (elevated)
  const layer1: Cell[][] = [];
  for (let y = 0; y < 5; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < 5; x++) {
      row.push({ terrain: 'empty' });
    }
    layer1.push(row);
  }
  cells.push(layer1);

  return {
    tick: 0,
    size: { x: 5, y: 5, z: 2 },
    cells,
    actors: {},
    bombs: {},
  };
}

function addActor(
  snapshot: WorldSnapshot,
  id: string,
  x: number,
  y: number,
  z: number = 0,
): ActorState {
  const actor: ActorState = {
    id,
    cell: { x, y, z },
    facing: 'south',
    count: 1,
    power: 2,
    upgrade: 'none',
    stunTicksRemaining: 0,
    shieldTicksRemaining: 0,
    state: { kind: 'idle' },
  };
  snapshot.actors[id] = actor;
  snapshot.cells[z]![y]![x]!.occupant = { kind: 'actor', id };
  return actor;
}

function placeRamp(
  snapshot: WorldSnapshot,
  x: number,
  y: number,
  z: number,
  entry: string,
  exit: string,
): void {
  const cell = snapshot.cells[z]![y]![x]!;
  cell.terrain = 'ramp';
  cell.ramp = { entry: entry as any, exit: exit as any, deltaZ: 1 };
}

function addBomb(
  snapshot: WorldSnapshot,
  id: string,
  owner: string,
  x: number,
  y: number,
  z: number = 0,
): BombState {
  const bomb: BombState = {
    id,
    ownerActorId: owner,
    bombType: 'regular',
    cell: { x, y, z },
    power: 2,
    fuseTicksRemaining: 200,
    initialFuseTicks: 200,
    state: { kind: 'idle' },
  };
  snapshot.bombs[id] = bomb;
  snapshot.cells[z]![y]![x]!.occupant = { kind: 'bomb', id };
  return bomb;
}

/** Run ticks until actor is idle again or maxTicks reached. */
function tickUntilIdle(snapshot: WorldSnapshot, maxTicks: number = 60): void {
  for (let i = 0; i < maxTicks; i++) {
    tick(snapshot);
  }
}

describe('Actor ramp traversal', () => {
  it('actor walks up a ramp (entry side to exit side)', () => {
    const snapshot = makeRampSnapshot();
    // Ramp at (2,2,0) with entry=south, exit=north
    placeRamp(snapshot, 2, 2, 0, 'south', 'north');
    // Add wall at (2,1,0) so z=1 at (2,1) has support
    snapshot.cells[0]![1]![2]!.terrain = 'wall';

    const actor = addActor(snapshot, 'a1', 2, 3, 0);

    // Move north onto the ramp
    tick(snapshot, [{ kind: 'move', actorId: 'a1', direction: 'north' }]);
    tickUntilIdle(snapshot);

    expect(actor.cell).toEqual({ x: 2, y: 2, z: 0 });

    // Now move north again (exit direction) — should go to z=1
    tick(snapshot, [{ kind: 'move', actorId: 'a1', direction: 'north' }]);
    tickUntilIdle(snapshot);

    expect(actor.cell).toEqual({ x: 2, y: 1, z: 1 });
  });

  it('actor cannot move sideways while on a ramp', () => {
    const snapshot = makeRampSnapshot();
    placeRamp(snapshot, 2, 2, 0, 'south', 'north');
    const actor = addActor(snapshot, 'a1', 2, 2, 0);

    // Try to move east — should be blocked
    tick(snapshot, [{ kind: 'move', actorId: 'a1', direction: 'east' }]);

    expect(actor.state.kind).toBe('idle');
    expect(actor.cell).toEqual({ x: 2, y: 2, z: 0 });
  });

  it('actor walks down a ramp from the exit (high) side', () => {
    const snapshot = makeRampSnapshot();
    placeRamp(snapshot, 2, 2, 0, 'south', 'north');
    // Put wall at z=0 under (2,1) so z=1 is supported
    snapshot.cells[0]![1]![2]!.terrain = 'wall';
    // Put wall at z=1 at (2,2) so flat movement is blocked — forces descent check
    snapshot.cells[1]![2]![2]!.terrain = 'wall';

    const actor = addActor(snapshot, 'a1', 2, 1, 1);

    // Move south — flat dest (2,2,1) is wall, so descend onto ramp at (2,2,0)
    tick(snapshot, [{ kind: 'move', actorId: 'a1', direction: 'south' }]);
    tickUntilIdle(snapshot);

    expect(actor.cell).toEqual({ x: 2, y: 2, z: 0 });
  });

  it('actor cannot enter ramp from wrong side', () => {
    const snapshot = makeRampSnapshot();
    placeRamp(snapshot, 2, 2, 0, 'south', 'north');
    const actor = addActor(snapshot, 'a1', 1, 2, 0);

    // Try to move east onto ramp — wrong side (should be from south)
    tick(snapshot, [{ kind: 'move', actorId: 'a1', direction: 'east' }]);

    expect(actor.state.kind).toBe('idle');
    expect(actor.cell).toEqual({ x: 1, y: 2, z: 0 });
  });
});

describe('Kicked bomb ramp traversal', () => {
  it('kicked bomb slides up a ramp', () => {
    const snapshot = makeRampSnapshot();
    placeRamp(snapshot, 2, 2, 0, 'south', 'north');
    const actor = addActor(snapshot, 'a1', 2, 3, 0);
    actor.upgrade = 'kick';
    // Bomb on the ramp
    const bomb = addBomb(snapshot, 'b1', 'a1', 2, 2, 0);

    // Kick north (along ramp exit direction)
    tick(snapshot, [{ kind: 'kick', actorId: 'a1', direction: 'north' }]);
    tickUntilIdle(snapshot);

    // Bomb should have traveled up the ramp and be at z=1
    expect(bomb.cell.z).toBe(1);
    expect(bomb.cell.y).toBeLessThan(2);
  });

  it('kicked bomb stops at ramp when kick direction does not match ramp orientation', () => {
    const snapshot = makeRampSnapshot();
    placeRamp(snapshot, 2, 2, 0, 'south', 'north');
    const actor = addActor(snapshot, 'a1', 1, 2, 0);
    actor.upgrade = 'kick';
    addBomb(snapshot, 'b1', 'a1', 2, 2, 0);

    // Kick east (perpendicular to ramp) — bomb cannot enter ramp from wrong side
    tick(snapshot, [{ kind: 'kick', actorId: 'a1', direction: 'east' }]);

    // Bomb should not have moved (kick direction doesn't work)
    const bomb = snapshot.bombs['b1'] as BombState;
    expect(bomb.state.kind).toBe('idle');
  });
});

describe('Ramp validation', () => {
  it('validates ramp adjacency on map load', () => {
    const map = {
      id: 'test',
      version: 'v0',
      name: 'test',
      size: { x: 3, y: 3, z: 1 },
      cells: [
        [
          [{ terrain: 'wall' }, { terrain: 'wall' }, { terrain: 'wall' }],
          [
            { terrain: 'wall' },
            { terrain: 'ramp', ramp: { entry: 'south', exit: 'north', deltaZ: 1 } },
            { terrain: 'wall' },
          ],
          [{ terrain: 'wall' }, { terrain: 'wall' }, { terrain: 'wall' }],
        ],
      ],
      spawns: [],
    };
    const issues = validateMap(map as any);
    // Ramp exit goes to z=1 which doesn't exist — should produce error
    expect(issues.some((i) => i.code === 'MAP_RAMP_EXIT_OUT_OF_BOUNDS')).toBe(true);
    // Entry neighbor is wall — should produce warning
    expect(issues.some((i) => i.code === 'MAP_RAMP_ENTRY_BLOCKED')).toBe(true);
  });
});
