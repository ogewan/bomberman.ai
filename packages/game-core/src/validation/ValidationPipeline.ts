/**
 * ValidationPipeline — runs map and scenario validation with hard-fail or override behavior.
 *
 * In strict mode (default): any error makes the result invalid and throws.
 * In lenient mode: errors are collected as warnings; invalid content may be removed.
 */

import type {
  MapDefinition,
  ScenarioDefinition,
  ValidationIssue,
  ValidationMode,
  ValidationResult,
} from '@bomberman65/shared';
import { validateMap } from './validateMap.js';
import { validateScenario } from './validateScenario.js';

export class ValidationPipeline {
  private mode: ValidationMode;

  constructor(mode: ValidationMode = 'strict') {
    this.mode = mode;
  }

  /** Validate a map definition. Throws in strict mode if errors are found. */
  validateMap(map: MapDefinition): ValidationResult {
    const issues = validateMap(map);
    return this.processResult(issues);
  }

  /** Validate a scenario against its map. Throws in strict mode if errors are found. */
  validateScenario(scenario: ScenarioDefinition, map: MapDefinition): ValidationResult {
    const issues = validateScenario(scenario, map);
    return this.processResult(issues);
  }

  /** Validate both map and scenario together. */
  validateAll(map: MapDefinition, scenario?: ScenarioDefinition): ValidationResult {
    const mapIssues = validateMap(map);
    const scenarioIssues = scenario ? validateScenario(scenario, map) : [];
    return this.processResult([...mapIssues, ...scenarioIssues]);
  }

  private processResult(issues: ValidationIssue[]): ValidationResult {
    const errors = issues.filter((i) => i.severity === 'error');
    const hasErrors = errors.length > 0;

    if (hasErrors && this.mode === 'strict') {
      const errorSummary = errors.map((e) => `[${e.code}] ${e.message}`).join('\n');
      throw new ValidationError(
        `Validation failed with ${errors.length} error(s):\n${errorSummary}`,
        issues,
      );
    }

    // In lenient mode, errors are downgraded to warnings
    const finalIssues: ValidationIssue[] =
      this.mode === 'lenient'
        ? issues.map((i) => (i.severity === 'error' ? { ...i, severity: 'warning' as const } : i))
        : issues;

    return {
      valid: !hasErrors,
      issues: finalIssues,
    };
  }
}

/** Error thrown when strict validation fails. */
export class ValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(message: string, issues: readonly ValidationIssue[]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}
