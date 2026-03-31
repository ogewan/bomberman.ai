/**
 * ItemLayer — renders items as billboard 2D sprites (colored planes for v0).
 * v0 visual language: RGB-coded item colors.
 */

import type { ItemVisual } from '@bomberman65/game-core';

const ITEM_COLORS: Record<string, string> = {
  power: '#ff4444',
  count: '#4444ff',
  'upgrade-kick': '#44ff44',
  'upgrade-carryPump': '#ffaa00',
  'upgrade-shield': '#aa44ff',
};

export type ItemLayerProps = {
  items: ItemVisual[];
};

export function ItemLayer({ items }: ItemLayerProps) {
  return (
    <>
      {items.map((item, i) => (
        <mesh key={i} position={[item.position.x, item.position.y, item.position.z + 0.3]}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshStandardMaterial
            color={ITEM_COLORS[item.type] ?? '#ffffff'}
            side={2} // DoubleSide
            emissive={ITEM_COLORS[item.type] ?? '#ffffff'}
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
    </>
  );
}
