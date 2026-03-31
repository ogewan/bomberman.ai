/**
 * MapContentLoader — loads and validates a MapDefinition from raw JSON data.
 * Applies validation pipeline before returning the map.
 */

import type { MapDefinition, ValidationMode, ValidationResult } from '@bomberman65/shared';
import { ValidationPipeline } from '../validation/ValidationPipeline.js';

export class MapContentLoader {
  private pipeline: ValidationPipeline;

  constructor(mode: ValidationMode = 'strict') {
    this.pipeline = new ValidationPipeline(mode);
  }

  /**
   * Load and validate a map definition.
   * In strict mode, throws ValidationError if the map has errors.
   * In lenient mode, returns the map with warnings.
   */
  load(rawMap: MapDefinition): { map: MapDefinition; validation: ValidationResult } {
    const validation = this.pipeline.validateMap(rawMap);
    return { map: rawMap, validation };
  }
}
