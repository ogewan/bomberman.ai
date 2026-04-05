/**
 * TileGrid — 2D top-down tile grid for map editing.
 * Click to paint terrain, items, or spawns on cells.
 */

import type { MapCell, SpawnPoint, Vec3i } from '@bomberman65/shared';

const TERRAIN_COLORS: Record<string, string> = {
  empty: '#333',
  wall: '#888',
  breakable: '#cc4',
  ramp: '#6a6',
};

/** Unicode arrow showing ramp slope direction (entry→exit, low→high). */
const RAMP_ARROWS: Record<string, string> = {
  north: '\u2191',
  south: '\u2193',
  east: '\u2192',
  west: '\u2190',
};

const ITEM_MARKERS: Record<string, string> = {
  power: 'P',
  count: 'C',
  'upgrade-kick': 'K',
  'upgrade-carryPump': 'U',
  'upgrade-shield': 'S',
};

const CELL_SIZE = 36;

export type TileGridProps = {
  cells: MapCell[][];
  spawns: SpawnPoint[];
  layer: number;
  selectedCell: Vec3i | null;
  onCellClick: (x: number, y: number) => void;
  onCellRightClick: (x: number, y: number) => void;
};

export function TileGrid({
  cells,
  spawns,
  layer,
  selectedCell,
  onCellClick,
  onCellRightClick,
}: TileGridProps) {
  const layerSpawns = spawns.filter((s) => s.cell.z === layer);

  return (
    <div style={{ display: 'inline-block', border: '1px solid #555', lineHeight: 0 }}>
      {cells.map((row, y) => (
        <div key={y} style={{ display: 'flex' }}>
          {row.map((cell, x) => {
            const isSelected =
              selectedCell?.x === x && selectedCell?.y === y && selectedCell?.z === layer;
            const spawn = layerSpawns.find((s) => s.cell.x === x && s.cell.y === y);
            const itemMarker = cell.item ? (ITEM_MARKERS[cell.item.type] ?? '?') : null;

            return (
              <div
                key={x}
                onClick={() => onCellClick(x, y)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onCellRightClick(x, y);
                }}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  background: TERRAIN_COLORS[cell.terrain] ?? '#333',
                  border: isSelected ? '2px solid #fff' : '1px solid #222',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: '#fff',
                  position: 'relative',
                  boxSizing: 'border-box',
                }}
                title={`(${x},${y},${layer}) ${cell.terrain}${cell.ramp ? ` ${cell.ramp.entry}→${cell.ramp.exit}` : ''}${cell.item ? ` [${cell.item.type}]` : ''}${spawn ? ` spawn:${spawn.id}` : ''}`}
              >
                {spawn && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 1,
                      left: 1,
                      fontSize: 8,
                      color: spawn.kind === 'player' ? '#4af' : '#f84',
                      fontWeight: 'bold',
                    }}
                  >
                    {spawn.kind === 'player' ? 'P' : 'B'}
                  </div>
                )}
                {cell.terrain === 'ramp' && cell.ramp && (
                  <span style={{ color: '#fff', fontSize: 16, opacity: 0.7 }}>
                    {RAMP_ARROWS[cell.ramp.exit] ?? '?'}
                  </span>
                )}
                {itemMarker && <span style={{ color: '#ff0', fontSize: 12 }}>{itemMarker}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
