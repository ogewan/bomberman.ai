import type { Vec3i } from './primitives.js';

/** Severity level for validation issues. */
export type ValidationSeverity = 'error' | 'warning';

/** A single validation issue found during content loading. */
export type ValidationIssue = {
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
  readonly location?: Vec3i;
  readonly context?: string;
};

/** Aggregated validation result from a validation pass. */
export type ValidationResult = {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
};

/** Validation mode controlling how illegal content is handled. */
export type ValidationMode = 'strict' | 'lenient';
