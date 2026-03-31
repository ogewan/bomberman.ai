import type { MatchConfig } from './config.js';
import type { ActorIntent } from './intents.js';
import type { MapDefinition, ScenarioDefinition } from './map.js';
import type { WorldSnapshot } from './world.js';
import type { SimulationRun } from './run.js';

/** Commands sent from the main thread to the simulation worker. */
export type WorkerCommand =
  | {
      readonly kind: 'start';
      readonly map: MapDefinition;
      readonly config: MatchConfig;
      readonly scenario?: ScenarioDefinition;
      readonly spawnAssignments: SpawnAssignment[];
    }
  | { readonly kind: 'step'; readonly intents: ActorIntent[] }
  | { readonly kind: 'pause' }
  | { readonly kind: 'resume' }
  | { readonly kind: 'stop' }
  | { readonly kind: 'seek'; readonly targetTick: number }
  | { readonly kind: 'setSpeed'; readonly speed: number };

/** Spawn assignment mapping a spawn point to an actor identity. */
export type SpawnAssignment = {
  readonly spawnId: string;
  readonly actorId: string;
  readonly controller: 'player' | 'bot' | 'model';
};

/** Events sent from the simulation worker back to the main thread. */
export type WorkerEvent =
  | { readonly kind: 'started'; readonly run: SimulationRun }
  | { readonly kind: 'tick'; readonly snapshot: WorldSnapshot }
  | { readonly kind: 'paused'; readonly tick: number }
  | { readonly kind: 'resumed'; readonly tick: number }
  | { readonly kind: 'finished'; readonly run: SimulationRun }
  | { readonly kind: 'error'; readonly message: string };
