/**
 * BombLayer — renders bombs as spheres and explosions as translucent cubes.
 * Held bombs float above holder. Pumped bombs render larger. Interpolates motion.
 *
 * Performance: geometry and explosion material shared via useMemo.
 * Bomb body materials vary per fuse progress so they remain inline.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { BombVisual } from '@bomberman65/game-core';
import type { Vec3i } from '@bomberman65/shared';

export type BombLayerProps = {
  bombs: BombVisual[];
  explosionCells: Vec3i[];
  onSelectBomb?: (id: string) => void;
};

export const BombLayer = React.memo(function BombLayer({
  bombs,
  explosionCells,
  onSelectBomb,
}: BombLayerProps) {
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.3, 16, 16), []);
  const explosionGeo = useMemo(() => new THREE.BoxGeometry(0.9, 0.9, 0.9), []);
  const explosionMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ff4400', opacity: 0.6, transparent: true }),
    [],
  );

  return (
    <>
      {bombs.map((bomb) => {
        if (bomb.isExploding) return null;

        const color = getBombColor(bomb);
        const pos = interpolateBombPosition(bomb);
        const zOffset = bomb.isHeld ? 1.4 : 0.3;
        const sizeScale = bomb.isHeld ? 0.7 : bomb.type === 'pumped' ? 1.3 : 1;

        return (
          <mesh
            key={bomb.id}
            position={[pos.x, pos.y, pos.z + zOffset]}
            scale={[sizeScale, sizeScale, sizeScale]}
            geometry={sphereGeo}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBomb?.(bomb.id);
            }}
          >
            <meshStandardMaterial
              color={color}
              opacity={bomb.isHeld ? 0.8 : 1}
              transparent={bomb.isHeld}
            />
          </mesh>
        );
      })}

      {explosionCells.map((cell, i) => (
        <mesh
          key={`exp_${i}`}
          position={[cell.x, cell.y, cell.z + 0.5]}
          geometry={explosionGeo}
          material={explosionMat}
        />
      ))}
    </>
  );
});

function interpolateBombPosition(bomb: BombVisual) {
  if (!bomb.motionFrom || !bomb.motionTo || bomb.motionProgress === 0) {
    return bomb.position;
  }
  const t = bomb.motionProgress;
  return {
    x: bomb.motionFrom.x + (bomb.motionTo.x - bomb.motionFrom.x) * t,
    y: bomb.motionFrom.y + (bomb.motionTo.y - bomb.motionFrom.y) * t,
    z: bomb.motionFrom.z + (bomb.motionTo.z - bomb.motionFrom.z) * t,
  };
}

function getBombColor(bomb: BombVisual): string {
  const t = Math.max(0, Math.min(1, bomb.fuseProgress));
  if (bomb.type === 'regular') {
    const r = Math.floor(t * 255);
    const b = Math.floor((1 - t) * 255);
    return `rgb(${r},0,${b})`;
  } else {
    const r = Math.floor(t * 255);
    const g = Math.floor((1 - t) * 200);
    return `rgb(${r},${g},0)`;
  }
}
