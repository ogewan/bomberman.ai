/**
 * ScenarioLoader — loads and validates a ScenarioDefinition against its target map.
 */

import type {
  MapDefinition,
  ScenarioDefinition,
  ValidationMode,
  ValidationResult,
} from '@bomberman65/shared';
import { ValidationPipeline } from '../validation/ValidationPipeline.js';

export class ScenarioLoader {
  private pipeline: ValidationPipeline;

  constructor(mode: ValidationMode = 'strict') {
    this.pipeline = new ValidationPipeline(mode);
  }

  /**
   * Load and validate a scenario definition against its target map.
   * In strict mode, throws ValidationError if the scenario has errors.
   */
  load(
    scenario: ScenarioDefinition,
    map: MapDefinition,
  ): { scenario: ScenarioDefinition; validation: ValidationResult } {
    const validation = this.pipeline.validateScenario(scenario, map);
    return { scenario, validation };
  }
}
