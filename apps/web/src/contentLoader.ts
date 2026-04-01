/**
 * contentLoader — browser-side helpers for loading maps, scenarios, and manifests.
 * Also handles file download and import via browser APIs.
 */

import type { MapDefinition, ScenarioDefinition } from '@bomberman65/shared';
import { deserializeMap, deserializeScenario } from '@bomberman65/game-core';

export type ManifestEntry = {
  id: string;
  name: string;
  file: string;
  mapId?: string;
};

export type ContentManifest = {
  maps: ManifestEntry[];
  scenarios: ManifestEntry[];
};

const CONTENT_BASE = '/content/';

/** Load the content manifest. */
export async function loadManifest(): Promise<ContentManifest> {
  const res = await fetch(`${CONTENT_BASE}manifest.json`);
  return res.json() as Promise<ContentManifest>;
}

/** Load a map definition by manifest file path. */
export async function loadMap(filePath: string): Promise<MapDefinition> {
  const res = await fetch(`${CONTENT_BASE}${filePath}`);
  const json = await res.text();
  return deserializeMap(json);
}

/** Load a scenario definition by manifest file path. */
export async function loadScenario(filePath: string): Promise<ScenarioDefinition> {
  const res = await fetch(`${CONTENT_BASE}${filePath}`);
  const json = await res.text();
  return deserializeScenario(json);
}

/** Download a string as a JSON file via browser save dialog. */
export function downloadAsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Read a File object as text (for import). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
