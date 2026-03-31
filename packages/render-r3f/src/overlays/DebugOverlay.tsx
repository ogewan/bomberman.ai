/**
 * DebugOverlay — optional debug visualization overlays.
 * Toggled by UI. Renders grid lines as thin boxes.
 */

import type { Vec3i } from '@bomberman65/shared';

export type DebugOverlayProps = {
  gridSize: Vec3i;
  showGrid: boolean;
  showCoordinates: boolean;
};

export function DebugOverlay({ gridSize, showGrid }: DebugOverlayProps) {
  if (!showGrid) return null;

  const lines: { position: [number, number, number]; scale: [number, number, number] }[] = [];

  // Horizontal grid lines (along x-axis)
  for (let y = 0; y <= gridSize.y; y++) {
    lines.push({
      position: [gridSize.x / 2 - 0.5, y - 0.5, 0.01],
      scale: [gridSize.x, 0.02, 0.02],
    });
  }

  // Vertical grid lines (along y-axis)
  for (let x = 0; x <= gridSize.x; x++) {
    lines.push({
      position: [x - 0.5, gridSize.y / 2 - 0.5, 0.01],
      scale: [0.02, gridSize.y, 0.02],
    });
  }

  return (
    <>
      {lines.map((line, i) => (
        <mesh key={i} position={line.position} scale={line.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#666666" opacity={0.3} transparent />
        </mesh>
      ))}
    </>
  );
}
