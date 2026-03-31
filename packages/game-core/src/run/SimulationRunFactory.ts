/**
 * SimulationRunFactory — creates a SimulationRun data structure from a map, config,
 * spawn assignments, and optional scenario.
 */

import type {
  SimulationRun,
  MapDefinition,
  MatchConfig,
  SpawnAssignment,
  ScenarioDefinition,
} from '@bomberman65/shared';
import { buildWorldSnapshot } from '../world/WorldFactory.js';

let runCounter = 0;

/** Create a new SimulationRun from authored content and configuration. */
export function createSimulationRun(params: {
  map: MapDefinition;
  config: MatchConfig;
  spawnAssignments: SpawnAssignment[];
  scenario?: ScenarioDefinition;
}): SimulationRun {
  const snapshot = buildWorldSnapshot(params);

  return {
    runId: `run_${++runCounter}`,
    seed: params.config.seed,
    status: 'idle',
    config: params.config,
    snapshot,
  };
}
