/**
 * SceneRoot — top-level R3F scene component.
 * Composes camera, lighting, and all visual layers from a RenderModel.
 */

import { Canvas } from '@react-three/fiber';
import type { RenderModel } from '@bomberman65/game-core';
import { SemiIsometricCamera } from '../camera/SemiIsometricCamera.js';
import { TerrainLayer } from '../terrain/TerrainLayer.js';
import { ActorLayer } from '../actors/ActorLayer.js';
import { BombLayer } from '../bombs/BombLayer.js';
import { ItemLayer } from '../items/ItemLayer.js';
import { DebugOverlay } from '../overlays/DebugOverlay.js';

export type SceneRootProps = {
  renderModel: RenderModel;
  showDebugGrid?: boolean;
  showDebugCoordinates?: boolean;
};

export function SceneRoot({
  renderModel,
  showDebugGrid = false,
  showDebugCoordinates = false,
}: SceneRootProps) {
  return (
    <Canvas style={{ width: '100%', height: '100%' }}>
      <SemiIsometricCamera
        gridWidth={renderModel.gridSize.x}
        gridHeight={renderModel.gridSize.y}
        gridDepth={renderModel.gridSize.z}
      />

      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, -10, 15]} intensity={0.8} />

      {/* Ground plane */}
      <mesh
        rotation={[0, 0, 0]}
        position={[renderModel.gridSize.x / 2 - 0.5, renderModel.gridSize.y / 2 - 0.5, -0.5]}
      >
        <planeGeometry args={[renderModel.gridSize.x + 1, renderModel.gridSize.y + 1]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>

      {/* Visual layers */}
      <TerrainLayer terrain={renderModel.terrain} />
      <ActorLayer actors={renderModel.actors} />
      <BombLayer bombs={renderModel.bombs} explosionCells={renderModel.explosionCells} />
      <ItemLayer items={renderModel.items} />

      {/* Debug overlays */}
      <DebugOverlay
        gridSize={renderModel.gridSize}
        showGrid={showDebugGrid}
        showCoordinates={showDebugCoordinates}
      />
    </Canvas>
  );
}
