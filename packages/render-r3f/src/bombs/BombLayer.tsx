/**
 * BombLayer — renders bombs as spheres and explosions as translucent cubes.
 * Clickable for selection.
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

        return (
          <mesh
            key={bomb.id}
            position={[bomb.position.x, bomb.position.y, bomb.position.z + 0.3]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBomb?.(bomb.id);
            }}
          >
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color={color} />
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
