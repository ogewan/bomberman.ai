/**
 * SceneRoot — top-level R3F scene component.
 * Composes camera, lighting, and all visual layers from a RenderModel.
 */

import { Canvas } from '@react-three/fiber';
import type { RenderModel } from '@bomberman65/game-core';
import type { Vec3i } from '@bomberman65/shared';
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
  onSelectActor?: (id: string) => void;
  onSelectBomb?: (id: string) => void;
  onSelectCell?: (pos: Vec3i) => void;
};

export function SceneRoot({
  renderModel,
  showDebugGrid = false,
  showDebugCoordinates = false,
  onSelectActor,
  onSelectBomb,
  onSelectCell,
}: SceneRootProps) {
  return (
    <Canvas style={{ width: '100%', height: '100%' }}>
      <SemiIsometricCamera
        gridWidth={renderModel.gridSize.x}
        gridHeight={renderModel.gridSize.y}
        gridDepth={renderModel.gridSize.z}
      />

      <ambientLight intensity={0.6} />
      <directionalLight position={[10, -10, 15]} intensity={0.8} />

      {/* Ground plane — click to select empty cells */}
      <mesh
        rotation={[0, 0, 0]}
        position={[renderModel.gridSize.x / 2 - 0.5, renderModel.gridSize.y / 2 - 0.5, -0.5]}
        onClick={(e) => {
          const point = e.point;
          const x = Math.round(point.x);
          const y = Math.round(point.y);
          if (x >= 0 && x < renderModel.gridSize.x && y >= 0 && y < renderModel.gridSize.y) {
            onSelectCell?.({ x, y, z: 0 });
          }
        }}
      >
        <planeGeometry args={[renderModel.gridSize.x + 1, renderModel.gridSize.y + 1]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>

      <TerrainLayer terrain={renderModel.terrain} onSelectCell={onSelectCell} />
      <ActorLayer actors={renderModel.actors} onSelectActor={onSelectActor} />
      <BombLayer
        bombs={renderModel.bombs}
        explosionCells={renderModel.explosionCells}
        onSelectBomb={onSelectBomb}
      />
      <ItemLayer items={renderModel.items} />

      <DebugOverlay
        gridSize={renderModel.gridSize}
        showGrid={showDebugGrid}
        showCoordinates={showDebugCoordinates}
      />
    </Canvas>
  );
}
