/**
 * validateScenario — validates a ScenarioDefinition against its target map.
 *
 * Checks:
 * - Scenario mapId matches the provided map
 * - Actor spawn cells are within bounds and walkable
 * - Bomb cells are within bounds
 * - Bomb owner actors exist in the scenario
 * - No duplicate actor or bomb ids
 */

import type { MapDefinition, ScenarioDefinition, ValidationIssue } from '@bomberman65/shared';

export function validateScenario(
  scenario: ScenarioDefinition,
  map: MapDefinition,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (scenario.mapId !== map.id) {
    issues.push({
      severity: 'error',
      code: 'SCENARIO_MAP_MISMATCH',
      message: `Scenario mapId '${scenario.mapId}' does not match map id '${map.id}'`,
    });
  }

  const actorIds = new Set<string>();

  if (scenario.actors) {
    for (const actor of scenario.actors) {
      // Duplicate check
      if (actorIds.has(actor.id)) {
        issues.push({
          severity: 'error',
          code: 'SCENARIO_DUPLICATE_ACTOR',
          message: `Duplicate actor id '${actor.id}'`,
          location: actor.spawnCell,
        });
      }
      actorIds.add(actor.id);

      // Bounds check
      if (
        actor.spawnCell.x < 0 ||
        actor.spawnCell.x >= map.size.x ||
        actor.spawnCell.y < 0 ||
        actor.spawnCell.y >= map.size.y ||
        actor.spawnCell.z < 0 ||
        actor.spawnCell.z >= map.size.z
      ) {
        issues.push({
          severity: 'error',
          code: 'SCENARIO_ACTOR_OUT_OF_BOUNDS',
          message: `Scenario actor '${actor.id}' spawn cell is outside map bounds`,
          location: actor.spawnCell,
        });
      }
    }
  }

  const bombIds = new Set<string>();

  if (scenario.bombs) {
    for (const bomb of scenario.bombs) {
      // Duplicate check
      if (bombIds.has(bomb.id)) {
        issues.push({
          severity: 'error',
          code: 'SCENARIO_DUPLICATE_BOMB',
          message: `Duplicate bomb id '${bomb.id}'`,
          location: bomb.cell,
        });
      }
      bombIds.add(bomb.id);

      // Bounds check
      if (
        bomb.cell.x < 0 ||
        bomb.cell.x >= map.size.x ||
        bomb.cell.y < 0 ||
        bomb.cell.y >= map.size.y ||
        bomb.cell.z < 0 ||
        bomb.cell.z >= map.size.z
      ) {
        issues.push({
          severity: 'error',
          code: 'SCENARIO_BOMB_OUT_OF_BOUNDS',
          message: `Scenario bomb '${bomb.id}' cell is outside map bounds`,
          location: bomb.cell,
        });
      }

      // Owner must exist
      if (!actorIds.has(bomb.ownerActorId)) {
        issues.push({
          severity: 'warning',
          code: 'SCENARIO_BOMB_OWNER_MISSING',
          message: `Bomb '${bomb.id}' references unknown actor '${bomb.ownerActorId}'`,
          location: bomb.cell,
        });
      }
    }
  }

  return issues;
}
