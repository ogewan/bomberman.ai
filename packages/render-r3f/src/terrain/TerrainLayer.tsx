/**
 * TerrainLayer — renders terrain cells as cubes. Clickable for cell selection.
 */

import type { TerrainInstance } from '@bomberman65/game-core';
import type { Vec3i } from '@bomberman65/shared';

const TERRAIN_COLORS: Record<string, string> = {
  wall: '#888888',
  breakable: '#cccc44',
  ramp: '#66aa66',
};

export type TerrainLayerProps = {
  terrain: TerrainInstance[];
  onSelectCell?: (pos: Vec3i) => void;
};

export function TerrainLayer({ terrain, onSelectCell }: TerrainLayerProps) {
  return (
    <>
      {terrain.map((t, i) => (
        <mesh
          key={i}
          position={[t.position.x, t.position.y, t.position.z]}
          onClick={(e) => {
            e.stopPropagation();
            onSelectCell?.(t.position);
          }}
        >
          <boxGeometry args={[0.95, 0.95, 0.95]} />
          <meshStandardMaterial color={TERRAIN_COLORS[t.type] ?? '#aaaaaa'} />
        </mesh>
      ))}
    </>
  );
}
