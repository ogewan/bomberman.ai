/**
 * SimulationRunFactory — creates a validated SimulationRun from content and configuration.
 * Combines MapContentLoader, ScenarioLoader, ValidationPipeline, and WorldFactory.
 */

import type {
  SimulationRun,
  MapDefinition,
  MatchConfig,
  SpawnAssignment,
  ScenarioDefinition,
  ValidationMode,
  ValidationResult,
} from '@bomberman65/shared';
import { buildWorldSnapshot } from '../world/WorldFactory.js';
import { MapContentLoader } from './MapContentLoader.js';
import { ScenarioLoader } from './ScenarioLoader.js';

let runCounter = 0;

export type CreateRunParams = {
  readonly map: MapDefinition;
  readonly config: MatchConfig;
  readonly spawnAssignments: SpawnAssignment[];
  readonly scenario?: ScenarioDefinition;
  readonly validationMode?: ValidationMode;
};

export type CreateRunResult = {
  readonly run: SimulationRun;
  readonly validation: ValidationResult;
};

/** Create a validated SimulationRun from authored content and configuration. */
export function createSimulationRun(params: CreateRunParams): CreateRunResult {
  const mode = params.validationMode ?? 'strict';

  // Validate map
  const mapLoader = new MapContentLoader(mode);
  const mapResult = mapLoader.load(params.map);

  // Validate scenario if present
  let scenarioValidation: ValidationResult | undefined;
  if (params.scenario) {
    const scenarioLoader = new ScenarioLoader(mode);
    scenarioValidation = scenarioLoader.load(params.scenario, params.map).validation;
  }

  // Merge validation results
  const allIssues = [...mapResult.validation.issues, ...(scenarioValidation?.issues ?? [])];

  const validation: ValidationResult = {
    valid: mapResult.validation.valid && (scenarioValidation?.valid ?? true),
    issues: allIssues,
  };

  // Build world snapshot
  const snapshot = buildWorldSnapshot({
    map: params.map,
    config: params.config,
    spawnAssignments: params.spawnAssignments,
    scenario: params.scenario,
  });

  const run: SimulationRun = {
    runId: `run_${++runCounter}`,
    seed: params.config.seed,
    status: 'idle',
    config: params.config,
    snapshot,
  };

  return { run, validation };
}
