import type { ModelManifest } from '@bomberman65/ml-inference';

export type ModelManifestEntry = {
  readonly id: string;
  readonly name: string;
  readonly file: string;
};

export type ModelManifestIndex = {
  readonly models: ModelManifestEntry[];
};

export async function loadModelManifestIndex(): Promise<ModelManifestIndex> {
  const response = await fetch('/models/manifest.json');
  if (!response.ok) {
    throw new Error(`Failed to load model manifest index: ${response.status}`);
  }
  return await response.json() as ModelManifestIndex;
}

export async function loadModelManifest(file: string): Promise<ModelManifest> {
  const response = await fetch(`/models/${file}`);
  if (!response.ok) {
    throw new Error(`Failed to load model manifest '${file}': ${response.status}`);
  }
  return await response.json() as ModelManifest;
}
