/**
 * contentIO — serialization utilities for maps and scenarios.
 * All content uses JSON format for v0 portability.
 *
 * Browser-specific file operations (download, file reading) belong
 * in the web/desktop app layer, not in game-core.
 */

import type { MapDefinition, ScenarioDefinition } from '@bomberman65/shared';

/** Serialize a MapDefinition to JSON string. */
export function serializeMap(map: MapDefinition): string {
  return JSON.stringify(map, null, 2);
}

/** Deserialize a MapDefinition from JSON string. */
export function deserializeMap(json: string): MapDefinition {
  const parsed = JSON.parse(json) as MapDefinition;
  if (!parsed.id || !parsed.version || !parsed.size || !parsed.cells) {
    throw new Error('Invalid map: missing required fields (id, version, size, cells)');
  }
  return parsed;
}

/** Serialize a ScenarioDefinition to JSON string. */
export function serializeScenario(scenario: ScenarioDefinition): string {
  return JSON.stringify(scenario, null, 2);
}

/** Deserialize a ScenarioDefinition from JSON string. */
export function deserializeScenario(json: string): ScenarioDefinition {
  const parsed = JSON.parse(json) as ScenarioDefinition;
  if (!parsed.id || !parsed.mapId) {
    throw new Error('Invalid scenario: missing required fields (id, mapId)');
  }
  return parsed;
}
