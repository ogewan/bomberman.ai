/**
 * SemiIsometricCamera — static forward-view semi-isometric camera.
 * Matches Bomberman 64 multiplayer-style readability priorities.
 */

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';

export type SemiIsometricCameraProps = {
  gridWidth: number;
  gridHeight: number;
  gridDepth: number;
};

export function SemiIsometricCamera({
  gridWidth,
  gridHeight,
  gridDepth,
}: SemiIsometricCameraProps) {
  const { camera } = useThree();

  useEffect(() => {
    const centerX = gridWidth / 2;
    const centerY = gridHeight / 2;
    const maxDim = Math.max(gridWidth, gridHeight);

    // Position camera above and behind, looking down at an angle
    camera.position.set(centerX, -maxDim * 0.6, maxDim * 1.2 + gridDepth);
    camera.lookAt(new THREE.Vector3(centerX, centerY, 0));
    camera.up.set(0, 0, 1);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 45;
      camera.updateProjectionMatrix();
    }
  }, [camera, gridWidth, gridHeight, gridDepth]);

  return null;
}
