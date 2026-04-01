/**
 * BombLayer — renders bombs as spheres and explosions as translucent cubes.
 * Held bombs float above their holder.
 */

import type { BombVisual } from '@bomberman65/game-core';
import type { Vec3i } from '@bomberman65/shared';

export type BombLayerProps = {
  bombs: BombVisual[];
  explosionCells: Vec3i[];
  onSelectBomb?: (id: string) => void;
};

export function BombLayer({ bombs, explosionCells, onSelectBomb }: BombLayerProps) {
  return (
    <>
      {bombs.map((bomb) => {
        if (bomb.isExploding) return null;

        const color = getBombColor(bomb);
        // Held bombs float above the holder
        const zOffset = bomb.isHeld ? 1.4 : 0.3;
        const scale = bomb.isHeld ? 0.7 : 1;

        return (
          <mesh
            key={bomb.id}
            position={[bomb.position.x, bomb.position.y, bomb.position.z + zOffset]}
            scale={[scale, scale, scale]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBomb?.(bomb.id);
            }}
          >
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial
              color={color}
              opacity={bomb.isHeld ? 0.8 : 1}
              transparent={bomb.isHeld}
            />
          </mesh>
        );
      })}

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
    const r = Math.floor(t * 255);
    const b = Math.floor((1 - t) * 255);
    return `rgb(${r},0,${b})`;
  } else {
    const r = Math.floor(t * 255);
    const g = Math.floor((1 - t) * 200);
    return `rgb(${r},${g},0)`;
  }
}
