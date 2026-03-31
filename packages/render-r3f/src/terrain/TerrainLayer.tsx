/**
 * TerrainLayer — renders terrain cells as cubes.
 * v0 visual language: cubes for walls, yellow cubes for breakables.
 */

import type { TerrainInstance } from '@bomberman65/game-core';

const TERRAIN_COLORS: Record<string, string> = {
  wall: '#888888',
  breakable: '#cccc44',
  ramp: '#66aa66',
};

export type TerrainLayerProps = {
  terrain: TerrainInstance[];
};

export function TerrainLayer({ terrain }: TerrainLayerProps) {
  return (
    <>
      {terrain.map((t, i) => (
        <mesh key={i} position={[t.position.x, t.position.y, t.position.z]}>
          <boxGeometry args={[0.95, 0.95, 0.95]} />
          <meshStandardMaterial color={TERRAIN_COLORS[t.type] ?? '#aaaaaa'} />
        </mesh>
      ))}
    </>
  );
}
