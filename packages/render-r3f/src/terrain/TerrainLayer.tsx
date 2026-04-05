/**
 * TerrainLayer — renders terrain cells. Walls/breakables as cubes, ramps as oriented wedges.
 * The wedge orientation is derived from the ramp's entry (low side) and exit (high side) directions.
 *
 * Performance: geometry and materials are shared via useMemo to avoid per-cell allocations.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { TerrainInstance } from '@bomberman65/game-core';
import type { Vec3i, Direction2D } from '@bomberman65/shared';
import { DIRECTION_TO_VECTOR } from '@bomberman65/shared';

export type TerrainLayerProps = {
  terrain: TerrainInstance[];
  onSelectCell?: (pos: Vec3i) => void;
};

/**
 * Create a wedge BufferGeometry for ramp rendering.
 * Default orientation: low edge at +y (south), high edge at -y (north).
 */
function createRampGeometry(): THREE.BufferGeometry {
  const h = 0.475;
  const positions = new Float32Array([
    -h, -h, -h, +h, -h, -h, +h, +h, -h, -h, +h, -h, -h, -h, +h, +h, -h, +h,
  ]);
  const indices = [0, 2, 1, 0, 3, 2, 0, 1, 5, 0, 5, 4, 3, 4, 5, 3, 5, 2, 0, 4, 3, 1, 2, 5];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Compute z-axis rotation angle so the wedge low side aligns with the entry direction. */
function rampRotationZ(entry: Direction2D): number {
  const vec = DIRECTION_TO_VECTOR[entry];
  return Math.atan2(-vec.dx, vec.dy);
}

export const TerrainLayer = React.memo(function TerrainLayer({
  terrain,
  onSelectCell,
}: TerrainLayerProps) {
  const boxGeo = useMemo(() => new THREE.BoxGeometry(0.95, 0.95, 0.95), []);
  const rampGeo = useMemo(() => createRampGeometry(), []);
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#888888' }), []);
  const breakableMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cccc44' }), []);
  const rampMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#66aa66' }), []);

  return (
    <>
      {terrain.map((t, i) => {
        const geo = t.type === 'ramp' && t.rampEntry ? rampGeo : boxGeo;
        const mat = t.type === 'wall' ? wallMat : t.type === 'breakable' ? breakableMat : rampMat;
        const rotZ = t.type === 'ramp' && t.rampEntry ? rampRotationZ(t.rampEntry) : 0;

        return (
          <mesh
            key={i}
            position={[t.position.x, t.position.y, t.position.z]}
            rotation={rotZ ? [0, 0, rotZ] : undefined}
            geometry={geo}
            material={mat}
            onClick={(e) => {
              e.stopPropagation();
              onSelectCell?.(t.position);
            }}
          />
        );
      })}
    </>
  );
});
