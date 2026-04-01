/**
 * MapEditor — full in-app tile-based map editor.
 * Operates on MapDefinition directly. Uses plain React (no R3F).
 * Features: paint terrain/items, place spawns, edit dimensions/metadata,
 * validate on save, import/export JSON.
 */

import { useCallback, useState } from 'react';
import type { MapDefinition, MapCell, SpawnPoint, Vec3i } from '@bomberman65/shared';

/** Mutable version of MapCell for in-editor manipulation. */
type MutableCell = { -readonly [K in keyof MapCell]: MapCell[K] };
import { validateMap } from '@bomberman65/game-core';
import type { ValidationIssue } from '@bomberman65/shared';
import { TileGrid } from './TileGrid.js';
import { TilePalette, type PaintMode } from './TilePalette.js';
import { DimensionControls } from './DimensionControls.js';
import { MapMetadata } from './MapMetadata.js';
import { SpawnEditor } from './SpawnEditor.js';

export type MapEditorProps = {
  initialMap?: MapDefinition;
  onSave: (map: MapDefinition) => void;
  onClose: () => void;
};

let spawnCounter = 0;

export function MapEditor({ initialMap, onSave, onClose }: MapEditorProps) {
  const [map, setMap] = useState<MapDefinition>(() => initialMap ?? createBlankMap());
  const [activeLayer, setActiveLayer] = useState(0);
  const [paintMode, setPaintMode] = useState<PaintMode>({ kind: 'terrain', terrain: 'wall' });
  const [selectedCell, setSelectedCell] = useState<Vec3i | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([]);

  const updateMap = useCallback((updater: (m: MapDefinition) => MapDefinition) => {
    setMap((prev) => updater(prev));
    setValidationErrors([]);
  }, []);

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      setSelectedCell({ x, y, z: activeLayer });

      updateMap((m) => {
        const cells = deepCloneCells(m.cells);
        const cell = cells[activeLayer]?.[y]?.[x];
        if (!cell) return m;

        if (paintMode.kind === 'terrain') {
          cell.terrain = paintMode.terrain;
          if (paintMode.terrain !== 'breakable') {
            // Remove hiddenInBreakable items when terrain changes
            if (cell.item?.hiddenInBreakable) cell.item = undefined;
          }
        } else if (paintMode.kind === 'item') {
          cell.item = {
            type: paintMode.itemType,
            dropChance: paintMode.dropChance,
            hiddenInBreakable: paintMode.hiddenInBreakable,
          };
        } else if (paintMode.kind === 'eraseItem') {
          cell.item = undefined;
        } else if (paintMode.kind === 'spawn') {
          const newSpawn: SpawnPoint = {
            id: `spawn_${++spawnCounter}`,
            kind: paintMode.spawnKind,
            cell: { x, y, z: activeLayer },
            facing: 'south',
          };
          return { ...m, cells, spawns: [...m.spawns, newSpawn] };
        }

        return { ...m, cells };
      });
    },
    [activeLayer, paintMode, updateMap],
  );

  const handleCellRightClick = useCallback(
    (x: number, y: number) => {
      setSelectedCell({ x, y, z: activeLayer });
      // Right-click selects without painting
    },
    [activeLayer],
  );

  const handleDimensionChange = useCallback(
    (newSize: Vec3i) => {
      updateMap((m) => resizeMap(m, newSize));
    },
    [updateMap],
  );

  const handleRemoveSpawn = useCallback(
    (id: string) => {
      updateMap((m) => ({ ...m, spawns: m.spawns.filter((s) => s.id !== id) }));
    },
    [updateMap],
  );

  const handleValidateAndSave = useCallback(() => {
    const issues = validateMap(map);
    const errors = issues.filter((i) => i.severity === 'error');
    setValidationErrors(issues);
    if (errors.length === 0) {
      onSave(map);
    }
  }, [map, onSave]);

  const currentLayer = map.cells[activeLayer];
  if (!currentLayer) return null;

  return (
    <div style={{ display: 'flex', height: '100%', color: '#e0e0e0' }}>
      {/* Left panel: palette + metadata */}
      <div
        style={{
          width: 220,
          borderRight: '1px solid #333',
          padding: 8,
          overflow: 'auto',
          flexShrink: 0,
        }}
      >
        <MapMetadata
          name={map.name}
          description={map.description ?? ''}
          tags={map.tags ?? []}
          onNameChange={(name) => updateMap((m) => ({ ...m, name }))}
          onDescriptionChange={(description) => updateMap((m) => ({ ...m, description }))}
          onTagsChange={(tags) => updateMap((m) => ({ ...m, tags }))}
        />
        <DimensionControls size={map.size} onChange={handleDimensionChange} />
        <TilePalette paintMode={paintMode} onPaintModeChange={setPaintMode} />
      </div>

      {/* Center: grid */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Layer tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {Array.from({ length: map.size.z }, (_, z) => (
            <button
              key={z}
              onClick={() => setActiveLayer(z)}
              style={{
                padding: '2px 12px',
                fontSize: 12,
                background: activeLayer === z ? '#555' : '#2a2a2a',
                color: '#e0e0e0',
                border: '1px solid #555',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              z={z}
            </button>
          ))}
        </div>

        <TileGrid
          cells={currentLayer}
          spawns={map.spawns}
          layer={activeLayer}
          selectedCell={selectedCell}
          onCellClick={handleCellClick}
          onCellRightClick={handleCellRightClick}
        />

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div style={{ marginTop: 12, maxWidth: 500, fontSize: 11 }}>
            {validationErrors.map((issue, i) => (
              <div
                key={i}
                style={{ color: issue.severity === 'error' ? '#f44' : '#fa4', marginBottom: 2 }}
              >
                [{issue.code}] {issue.message}
                {issue.location &&
                  ` at (${issue.location.x},${issue.location.y},${issue.location.z})`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: spawns + actions */}
      <div
        style={{
          width: 200,
          borderLeft: '1px solid #333',
          padding: 8,
          overflow: 'auto',
          flexShrink: 0,
        }}
      >
        <SpawnEditor spawns={map.spawns} onRemoveSpawn={handleRemoveSpawn} />

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={handleValidateAndSave} style={actionBtnStyle}>
            Validate & Save
          </button>
          <button onClick={onClose} style={{ ...actionBtnStyle, background: '#433' }}>
            Cancel
          </button>
        </div>

        {selectedCell && (
          <div style={{ marginTop: 12, fontSize: 11, color: '#888' }}>
            Selected: ({selectedCell.x}, {selectedCell.y}, {selectedCell.z})
            {(() => {
              const cell = map.cells[selectedCell.z]?.[selectedCell.y]?.[selectedCell.x];
              if (!cell) return null;
              return (
                <>
                  <br />
                  Terrain: {cell.terrain}
                  {cell.item && (
                    <>
                      <br />
                      Item: {cell.item.type} (drop: {cell.item.dropChance ?? 1})
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function createBlankMap(): MapDefinition {
  return {
    id: `map_${Date.now()}`,
    version: 'v0',
    name: 'New Map',
    size: { x: 7, y: 7, z: 1 },
    cells: [createEmptyLayer(7, 7)],
    spawns: [],
    tags: [],
  };
}

function createEmptyLayer(width: number, height: number): MapCell[][] {
  const layer: MapCell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: MapCell[] = [];
    for (let x = 0; x < width; x++) {
      row.push({ terrain: 'empty' });
    }
    layer.push(row);
  }
  return layer;
}

function resizeMap(map: MapDefinition, newSize: Vec3i): MapDefinition {
  const cells: MapCell[][][] = [];
  for (let z = 0; z < newSize.z; z++) {
    const oldLayer = map.cells[z];
    const layer: MapCell[][] = [];
    for (let y = 0; y < newSize.y; y++) {
      const row: MapCell[] = [];
      for (let x = 0; x < newSize.x; x++) {
        const existing = oldLayer?.[y]?.[x];
        row.push(existing ? { ...existing } : { terrain: 'empty' });
      }
      layer.push(row);
    }
    cells.push(layer);
  }

  // Remove spawns that are now out of bounds
  const spawns = map.spawns.filter(
    (s) => s.cell.x < newSize.x && s.cell.y < newSize.y && s.cell.z < newSize.z,
  );

  return { ...map, size: newSize, cells, spawns };
}

function deepCloneCells(cells: MapCell[][][]): MutableCell[][][] {
  return cells.map((layer) =>
    layer.map((row) =>
      row.map((cell) => ({
        ...cell,
        item: cell.item ? { ...cell.item } : undefined,
        ramp: cell.ramp ? { ...cell.ramp } : undefined,
      })),
    ),
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  background: '#343',
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: 3,
  cursor: 'pointer',
};
