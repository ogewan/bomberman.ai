/**
 * Bomberman26Environment — GameEnvironment adapter for the Bomberman 26 custom engine.
 *
 * Wraps SimulationRunner behind the platform's GameEnvironment interface so that
 * the platform UI, agent runtime, and experiment sessions can drive B26 matches
 * identically to any other environment backend.
 *
 * Action mapping:
 * - B26 uses named ActorIntent per actor per tick.
 * - This adapter exposes a composite action space: one discrete sub-space per actor.
 * - For single-agent mode, a flat discrete action index is also accepted.
 */

import type {
  GameEnvironment,
  EnvironmentConfig,
  Observation,
  StepResult,
  StateSnapshot,
  ActionSpaceDescriptor,
  ActionInput,
  EnvironmentInfo,
} from '@bomberman65/platform-core';

import type {
  WorldSnapshot,
  ActorIntent,
  MapDefinition,
  MatchConfig,
  SpawnAssignment,
  ScenarioDefinition,
  Direction2D,
  ActorState,
} from '@bomberman65/shared';
import { deepClone, DEFAULT_MATCH_CONFIG } from '@bomberman65/shared';

import {
  SimulationRunner,
  createSimulationRun,
  resetSessionCounters,
  IdleIntentCollector,
} from '@bomberman65/game-core';

export const ENV_TYPE = 'bomberman26';

/**
 * B26-specific environment configuration.
 * Passed inside EnvironmentConfig.envConfig.
 */
export type B26EnvConfig = {
  readonly map: MapDefinition;
  readonly matchConfig?: Partial<MatchConfig>;
  readonly scenario?: ScenarioDefinition;
  readonly spawnAssignments: SpawnAssignment[];
  /** ID of the actor controlled by the agent (for single-agent reward). Omit for multi-agent. */
  readonly agentActorId?: string;
};

/**
 * The 13 discrete actions available to each actor per tick.
 * Index 0 = idle, 1-8 = move in 8 directions, 9 = placeBomb, 10 = kick, 11 = pickup, 12 = pump/throw.
 */
const ACTION_LABELS = [
  'idle',
  'move_north',
  'move_south',
  'move_east',
  'move_west',
  'move_northEast',
  'move_northWest',
  'move_southEast',
  'move_southWest',
  'placeBomb',
  'kick',
  'pickup',
  'pump',
] as const;

const MOVE_DIRECTIONS: Direction2D[] = [
  'north',
  'south',
  'east',
  'west',
  'northEast',
  'northWest',
  'southEast',
  'southWest',
];

export class Bomberman26Environment implements GameEnvironment {
  private runner: SimulationRunner | null = null;
  private config: B26EnvConfig | null = null;
  private matchConfig: MatchConfig | null = null;
  private actorIds: string[] = [];
  private agentActorId: string | null = null;
  private maxSteps: number | undefined;
  async init(config: EnvironmentConfig): Promise<void> {
    if (config.envType !== ENV_TYPE) {
      throw new Error(`Bomberman26Environment cannot handle envType '${config.envType}'`);
    }

    const envConfig = config.envConfig as unknown as B26EnvConfig;
    this.config = envConfig;
    this.maxSteps = config.maxSteps;

    const seed = config.seed ?? envConfig.matchConfig?.seed ?? 42;
    this.matchConfig = {
      ...DEFAULT_MATCH_CONFIG,
      ...envConfig.matchConfig,
      mapId: envConfig.map.id,
      seed,
    };

    this.agentActorId = envConfig.agentActorId ?? null;

    this.createRun();
  }

  async reset(): Promise<Observation> {
    if (!this.config) {
      throw new Error('Environment not initialized. Call init() first.');
    }

    this.createRun();
    return this.getObservation();
  }

  async step(action: ActionInput): Promise<StepResult> {
    if (!this.runner) {
      throw new Error('Environment not initialized or already disposed.');
    }

    const prevSnapshot = this.runner.getSnapshot();
    const intents = this.actionToIntents(action);

    // Ensure runner is in a steppable state
    const run = this.runner.getRun();
    if (run.status === 'idle') {
      this.runner.start();
    } else if (run.status === 'paused') {
      this.runner.resume();
    }

    this.runner.stepTickWithIntents(intents);

    // Pause after step so we can step again next call
    if (this.runner.getRun().status === 'running') {
      this.runner.pause();
    }

    const newSnapshot = this.runner.getSnapshot();
    const done = this.runner.getRun().status === 'finished';
    const truncated =
      !done && this.maxSteps !== undefined && newSnapshot.tick >= this.maxSteps;

    if (truncated) {
      this.runner.stop();
    }

    return {
      observation: this.buildObservation(newSnapshot),
      reward: this.computeReward(prevSnapshot, newSnapshot),
      done: done || truncated,
      truncated,
      info: this.buildInfo(newSnapshot),
    };
  }

  async saveState(): Promise<StateSnapshot> {
    if (!this.runner) {
      throw new Error('Environment not initialized.');
    }
    const snapshot = this.runner.getSnapshot();
    return {
      envType: ENV_TYPE,
      step: snapshot.tick,
      data: deepClone(snapshot) as unknown as Record<string, unknown>,
    };
  }

  async loadState(snapshot: StateSnapshot): Promise<void> {
    if (snapshot.envType !== ENV_TYPE) {
      throw new Error(`Cannot load state of type '${snapshot.envType}' into Bomberman26Environment`);
    }
    if (!this.runner) {
      throw new Error('Environment not initialized.');
    }

    const worldSnapshot = snapshot.data as unknown as WorldSnapshot;
    const run = this.runner.getRun();
    run.snapshot = deepClone(worldSnapshot);
    run.status = 'paused';
  }

  getObservation(): Observation {
    if (!this.runner) {
      throw new Error('Environment not initialized.');
    }
    return this.buildObservation(this.runner.getSnapshot());
  }

  getActionSpace(): ActionSpaceDescriptor {
    if (this.actorIds.length === 1 || this.agentActorId) {
      return {
        kind: 'discrete',
        n: ACTION_LABELS.length,
        labels: ACTION_LABELS as unknown as string[],
      };
    }

    const spaces: Record<string, ActionSpaceDescriptor> = {};
    for (const actorId of this.actorIds) {
      spaces[actorId] = {
        kind: 'discrete',
        n: ACTION_LABELS.length,
        labels: ACTION_LABELS as unknown as string[],
      };
    }
    return { kind: 'composite', spaces };
  }

  getInfo(): EnvironmentInfo {
    return {
      name: 'Bomberman 26',
      envType: ENV_TYPE,
      deterministic: true,
      capabilities: {
        saveLoad: true,
        visualFrames: false,
        structuredState: true,
        variableStepSize: false,
        multiAgent: true,
      },
    };
  }

  dispose(): void {
    if (this.runner) {
      const run = this.runner.getRun();
      if (run.status === 'running' || run.status === 'paused') {
        this.runner.stop();
      }
    }
    this.runner = null;
  }

  /** Expose the underlying runner for B26-specific integrations (editor, inspector, etc.). */
  getRunner(): SimulationRunner | null {
    return this.runner;
  }

  // --- Private helpers ---

  private createRun(): void {
    if (!this.config || !this.matchConfig) throw new Error('No config');

    resetSessionCounters();
    const { run } = createSimulationRun({
      map: this.config.map,
      config: this.matchConfig,
      spawnAssignments: this.config.spawnAssignments,
      scenario: this.config.scenario,
      validationMode: 'lenient',
    });

    this.runner = new SimulationRunner(run, new IdleIntentCollector(), {
      recordReplay: true,
    });

    this.actorIds = Object.keys(run.snapshot.actors);
  }

  private buildObservation(snapshot: WorldSnapshot): Observation {
    return {
      state: snapshot as unknown as Record<string, unknown>,
      step: snapshot.tick,
    };
  }

  private actionToIntents(action: ActionInput): ActorIntent[] {
    // Single-agent mode: flat discrete action index
    if (typeof action === 'number') {
      const targetId = this.agentActorId ?? this.actorIds[0];
      if (!targetId) return [];

      const intent = this.actionIndexToIntent(action, targetId);
      // Generate idle intents for all other actors
      const intents: ActorIntent[] = [intent];
      for (const id of this.actorIds) {
        if (id !== targetId) {
          intents.push({ kind: 'idle', actorId: id });
        }
      }
      return intents;
    }

    // Multi-agent mode: composite action as Record<actorId, actionIndex>
    if (typeof action === 'object' && !Array.isArray(action)) {
      const intents: ActorIntent[] = [];
      for (const actorId of this.actorIds) {
        const actionIndex = (action as Record<string, number>)[actorId] ?? 0;
        intents.push(this.actionIndexToIntent(actionIndex, actorId));
      }
      return intents;
    }

    throw new Error(`Unsupported action format: ${typeof action}`);
  }

  private actionIndexToIntent(
    actionIndex: number,
    actorId: string,
  ): ActorIntent {
    if (actionIndex === 0) return { kind: 'idle', actorId };
    if (actionIndex >= 1 && actionIndex <= 8) {
      return { kind: 'move', actorId, direction: MOVE_DIRECTIONS[actionIndex - 1]! };
    }
    if (actionIndex === 9) return { kind: 'placeBomb', actorId };

    const defaultDir: Direction2D = 'north';
    if (actionIndex === 10) return { kind: 'kick', actorId, direction: defaultDir };
    if (actionIndex === 11) return { kind: 'pickup', actorId };
    if (actionIndex === 12) return { kind: 'pump', actorId };

    return { kind: 'idle', actorId };
  }

  /**
   * Simple reward computation for RL:
   * - +1.0 for winning
   * - -1.0 for being eliminated
   * - +0.1 for eliminating an opponent
   * - 0 otherwise
   */
  private computeReward(
    prevSnapshot: WorldSnapshot,
    newSnapshot: WorldSnapshot,
  ): number {
    const targetId = this.agentActorId ?? this.actorIds[0];
    if (!targetId) return 0;

    const prevActor = prevSnapshot.actors[targetId];
    const newActor = newSnapshot.actors[targetId];

    // Agent eliminated this tick
    if (
      prevActor &&
      newActor &&
      prevActor.state.kind !== 'eliminated' &&
      newActor.state.kind === 'eliminated'
    ) {
      return -1.0;
    }

    // Check if game finished and agent won
    if (this.runner && this.runner.getRun().status === 'finished') {
      const result = this.runner.getRun().result;
      if (result?.winnerId === targetId) return 1.0;
    }

    // Check if any opponent was eliminated this tick
    let opponentEliminated = 0;
    for (const id of this.actorIds) {
      if (id === targetId) continue;
      const prev = prevSnapshot.actors[id];
      const curr = newSnapshot.actors[id];
      if (
        prev &&
        curr &&
        prev.state.kind !== 'eliminated' &&
        curr.state.kind === 'eliminated'
      ) {
        opponentEliminated++;
      }
    }
    if (opponentEliminated > 0) return 0.1 * opponentEliminated;

    return 0;
  }

  private buildInfo(snapshot: WorldSnapshot): Record<string, unknown> {
    const run = this.runner?.getRun();
    return {
      tick: snapshot.tick,
      status: run?.status,
      aliveActors: Object.values(snapshot.actors).filter(
        (a) => (a as ActorState).state.kind !== 'eliminated',
      ).length,
      result: run?.result,
    };
  }
}
