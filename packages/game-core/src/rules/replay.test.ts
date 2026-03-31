/**
 * Tests for replay recording and reconstruction.
 * Verifies that replaying a recorded intent log produces identical state.
 */

import { describe, it, expect } from 'vitest';
import type { MapDefinition, MatchConfig, ActorState } from '@bomberman65/shared';
import { DEFAULT_MATCH_CONFIG } from '@bomberman65/shared';
import { createSimulationRun } from '../factories/SimulationRunFactory.js';
import { SimulationRunner } from '../run/SimulationRunner.js';
import { IdleIntentCollector } from '../intents/IntentCollector.js';
import { ReplayController } from '../replay/ReplayController.js';
import { serializeReplayLog, deserializeReplayLog } from '../replay/replaySerialization.js';

function makeMap(): MapDefinition {
  return {
    id: 'replay_test',
    version: 'v0',
    name: 'Replay Test',
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
          { terrain: 'empty' },
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
      { id: 'sp1', kind: 'player', cell: { x: 1, y: 1, z: 0 } },
      { id: 'sp2', kind: 'bot', cell: { x: 3, y: 3, z: 0 } },
    ],
  };
}

function makeConfig(): MatchConfig {
  return { ...DEFAULT_MATCH_CONFIG, mapId: 'replay_test', seed: 42, maxTicks: 50 } as MatchConfig;
}

function createRun() {
  const map = makeMap();
  const config = makeConfig();
  const { run } = createSimulationRun({
    map,
    config,
    spawnAssignments: [
      { spawnId: 'sp1', actorId: 'actor1', controller: 'player' },
      { spawnId: 'sp2', actorId: 'actor2', controller: 'bot' },
    ],
  });
  return { run, map, config };
}

describe('Replay recording', () => {
  it('records intents for each tick', () => {
    const { run } = createRun();
    const runner = new SimulationRunner(run, new IdleIntentCollector());
    runner.start();
    runner.stepTicks(10);

    const recorder = runner.getRecorder();
    expect(recorder).not.toBeNull();

    const log = recorder!.getLog();
    expect(log.entries.length).toBe(10);
    expect(log.initialSnapshot.tick).toBe(0);
    expect(log.mapId).toBe('replay_test');
  });

  it('records result on termination', () => {
    const { run } = createRun();
    const runner = new SimulationRunner(run, new IdleIntentCollector());
    runner.start();
    runner.stepTicks(60); // maxTicks is 50

    const log = runner.getRecorder()!.getLog();
    expect(log.result).toBeDefined();
    expect(log.result!.reason).toBe('timeout');
  });
});

describe('Replay reconstruction', () => {
  it('produces identical state when replayed', () => {
    const { run } = createRun();
    const runner = new SimulationRunner(run, new IdleIntentCollector());
    runner.start();
    runner.stepTicks(20);

    const originalSnapshot = run.snapshot;
    const log = runner.getRecorder()!.getLog();

    // Reconstruct via ReplayController
    const controller = new ReplayController(log);
    controller.seekToTick(20);

    const replaySnapshot = controller.getSnapshot();

    expect(replaySnapshot.tick).toBe(originalSnapshot.tick);

    for (const id of Object.keys(originalSnapshot.actors)) {
      const orig = originalSnapshot.actors[id] as ActorState;
      const replay = replaySnapshot.actors[id] as ActorState;
      expect(replay.cell).toEqual(orig.cell);
      expect(replay.state.kind).toBe(orig.state.kind);
    }
  });

  it('can step forward through replay', () => {
    const { run } = createRun();
    const runner = new SimulationRunner(run, new IdleIntentCollector());
    runner.start();
    runner.stepTicks(10);

    const log = runner.getRecorder()!.getLog();
    const controller = new ReplayController(log);

    expect(controller.getCurrentTick()).toBe(0);

    controller.stepForward();
    expect(controller.getCurrentTick()).toBe(1);

    controller.stepForward();
    expect(controller.getCurrentTick()).toBe(2);
  });

  it('can seek backward', () => {
    const { run } = createRun();
    const runner = new SimulationRunner(run, new IdleIntentCollector());
    runner.start();
    runner.stepTicks(10);

    const log = runner.getRecorder()!.getLog();
    const controller = new ReplayController(log);

    controller.seekToTick(8);
    expect(controller.getCurrentTick()).toBe(8);

    controller.stepBackward();
    expect(controller.getCurrentTick()).toBe(7);
  });
});

describe('Replay serialization', () => {
  it('round-trips through JSON', () => {
    const { run } = createRun();
    const runner = new SimulationRunner(run, new IdleIntentCollector());
    runner.start();
    runner.stepTicks(5);

    const log = runner.getRecorder()!.getLog();
    const json = serializeReplayLog(log);
    const restored = deserializeReplayLog(json);

    expect(restored.replayId).toBe(log.replayId);
    expect(restored.entries.length).toBe(log.entries.length);
    expect(restored.initialSnapshot.tick).toBe(0);
  });

  it('rejects invalid JSON', () => {
    expect(() => deserializeReplayLog('{}')).toThrow(/replayId/);
  });
});
