/**
 * BombLayer — renders bombs as spheres and explosions as translucent cubes.
 * v0 visual language:
 *   regular bomb: blue → red timer shift
 *   pumped bomb: green → red timer shift
 */

import type { BombVisual } from '@bomberman65/game-core';
import type { Vec3i } from '@bomberman65/shared';

export type BombLayerProps = {
  bombs: BombVisual[];
  explosionCells: Vec3i[];
};

export function BombLayer({ bombs, explosionCells }: BombLayerProps) {
  return (
    <>
      {/* Render bomb spheres */}
      {bombs.map((bomb) => {
        if (bomb.isExploding) return null;

        const color = getBombColor(bomb);

        return (
          <mesh key={bomb.id} position={[bomb.position.x, bomb.position.y, bomb.position.z + 0.3]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}

      {/* Render explosion cells */}
      {explosionCells.map((cell, i) => (
        <mesh key={`exp_${i}`} position={[cell.x, cell.y, cell.z + 0.5]}>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshStandardMaterial color="#ff4400" opacity={0.6} transparent />
        </mesh>
      ))}
    </>
  );
}

function getBombColor(bomb: BombVisual): string {
  const t = bomb.fuseProgress;
  if (bomb.type === 'regular') {
    // Blue (0,0,255) → Red (255,0,0)
    const r = Math.floor(t * 255);
    const b = Math.floor((1 - t) * 255);
    return `rgb(${r},0,${b})`;
  } else {
    // Green (0,200,0) → Red (255,0,0)
    const r = Math.floor(t * 255);
    const g = Math.floor((1 - t) * 200);
    return `rgb(${r},${g},0)`;
  }
}
