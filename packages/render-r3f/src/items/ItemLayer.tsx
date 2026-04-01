/**
 * ItemLayer — renders items as billboard sprites that always face the camera.
 * v0 visual language: RGB-coded colored planes.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ItemVisual } from '@bomberman65/game-core';
import * as THREE from 'three';

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
        <BillboardItem key={i} item={item} />
      ))}
    </>
  );
}

function BillboardItem({ item }: { item: ItemVisual }) {
  const groupRef = useRef<THREE.Group>(null);

  // Face the camera every frame
  useFrame(({ camera }) => {
    if (groupRef.current) {
      groupRef.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <group ref={groupRef} position={[item.position.x, item.position.y, item.position.z + 0.3]}>
      <mesh>
        <planeGeometry args={[0.4, 0.4]} />
        <meshStandardMaterial
          color={ITEM_COLORS[item.type] ?? '#ffffff'}
          emissive={ITEM_COLORS[item.type] ?? '#ffffff'}
          emissiveIntensity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
