/**
 * TilePalette — terrain and item type selector for map editing.
 */

import React from 'react';
import type { TerrainType, ItemType, Direction2D } from '@bomberman65/shared';
import { CARDINAL_DIRECTIONS, OPPOSITE_DIRECTION } from '@bomberman65/shared';

export type PaintMode =
  | { kind: 'terrain'; terrain: TerrainType; rampEntry?: Direction2D; rampExit?: Direction2D }
  | { kind: 'item'; itemType: ItemType; dropChance: number; hiddenInBreakable: boolean }
  | { kind: 'eraseItem' }
  | { kind: 'spawn'; spawnKind: 'player' | 'bot' | 'generic' };

export type TilePaletteProps = {
  paintMode: PaintMode;
  onPaintModeChange: (mode: PaintMode) => void;
};

const TERRAINS: { type: TerrainType; label: string; color: string }[] = [
  { type: 'empty', label: 'Empty', color: '#333' },
  { type: 'wall', label: 'Wall', color: '#888' },
  { type: 'breakable', label: 'Breakable', color: '#cc4' },
  { type: 'ramp', label: 'Ramp', color: '#6a6' },
];

const ITEMS: { type: ItemType; label: string }[] = [
  { type: 'power', label: 'Power' },
  { type: 'count', label: 'Count' },
  { type: 'upgrade-kick', label: 'Kick' },
  { type: 'upgrade-carryPump', label: 'Carry/Pump' },
  { type: 'upgrade-shield', label: 'Shield' },
];

export function TilePalette({ paintMode, onPaintModeChange }: TilePaletteProps) {
  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#aaa' }}>Terrain</div>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 8 }}>
        {TERRAINS.map((t) => (
          <button
            key={t.type}
            onClick={() =>
              onPaintModeChange(
                t.type === 'ramp'
                  ? { kind: 'terrain', terrain: 'ramp', rampEntry: 'south', rampExit: 'north' }
                  : { kind: 'terrain', terrain: t.type },
              )
            }
            style={{
              ...btnStyle,
              background:
                paintMode.kind === 'terrain' && paintMode.terrain === t.type ? t.color : '#2a2a2a',
              color:
                paintMode.kind === 'terrain' && paintMode.terrain === t.type ? '#000' : '#e0e0e0',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {paintMode.kind === 'terrain' && paintMode.terrain === 'ramp' && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}>
            Entry:
            <select
              value={paintMode.rampEntry ?? 'south'}
              onChange={(e) => {
                const entry = e.target.value as Direction2D;
                onPaintModeChange({
                  ...paintMode,
                  rampEntry: entry,
                  rampExit: OPPOSITE_DIRECTION[entry],
                });
              }}
              style={inputStyle}
            >
              {CARDINAL_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            Exit:
            <select
              value={paintMode.rampExit ?? 'north'}
              onChange={(e) =>
                onPaintModeChange({ ...paintMode, rampExit: e.target.value as Direction2D })
              }
              style={inputStyle}
            >
              {CARDINAL_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>
            {paintMode.rampEntry ?? 'south'} (low) → {paintMode.rampExit ?? 'north'} (high)
          </div>
        </div>
      )}

      <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#aaa' }}>Items</div>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 4 }}>
        {ITEMS.map((item) => (
          <button
            key={item.type}
            onClick={() =>
              onPaintModeChange({
                kind: 'item',
                itemType: item.type,
                dropChance: 1,
                hiddenInBreakable: false,
              })
            }
            style={{
              ...btnStyle,
              background:
                paintMode.kind === 'item' && paintMode.itemType === item.type ? '#664' : '#2a2a2a',
            }}
          >
            {item.label}
          </button>
        ))}
        <button
          onClick={() => onPaintModeChange({ kind: 'eraseItem' })}
          style={{
            ...btnStyle,
            background: paintMode.kind === 'eraseItem' ? '#644' : '#2a2a2a',
          }}
        >
          Erase Item
        </button>
      </div>

      {paintMode.kind === 'item' && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            Drop: {Math.round(paintMode.dropChance * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={paintMode.dropChance}
              onChange={(e) =>
                onPaintModeChange({
                  ...paintMode,
                  dropChance: Math.min(1, Math.max(0, Number(e.target.value))),
                })
              }
              style={{ flex: 1 }}
            />
          </label>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
            <input
              type="checkbox"
              checked={paintMode.hiddenInBreakable}
              onChange={(e) =>
                onPaintModeChange({ ...paintMode, hiddenInBreakable: e.target.checked })
              }
            />
            Hidden in breakable
          </label>
        </div>
      )}

      <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#aaa' }}>Spawns</div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
        <button
          onClick={() => onPaintModeChange({ kind: 'spawn', spawnKind: 'player' })}
          style={{
            ...btnStyle,
            background:
              paintMode.kind === 'spawn' && paintMode.spawnKind === 'player' ? '#448' : '#2a2a2a',
          }}
        >
          Player
        </button>
        <button
          onClick={() => onPaintModeChange({ kind: 'spawn', spawnKind: 'bot' })}
          style={{
            ...btnStyle,
            background:
              paintMode.kind === 'spawn' && paintMode.spawnKind === 'bot' ? '#844' : '#2a2a2a',
          }}
        >
          Bot
        </button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '2px 6px',
  fontSize: 10,
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: 3,
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  background: '#2a2a2a',
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: 3,
  fontSize: 11,
  padding: '1px 4px',
};
