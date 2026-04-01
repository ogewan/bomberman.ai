/**
 * TilePalette — terrain and item type selector for map editing.
 */

import React from 'react';
import type { TerrainType, ItemType } from '@bomberman65/shared';

export type PaintMode =
  | { kind: 'terrain'; terrain: TerrainType }
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
            onClick={() => onPaintModeChange({ kind: 'terrain', terrain: t.type })}
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
            Drop %:
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={paintMode.dropChance}
              onChange={(e) =>
                onPaintModeChange({ ...paintMode, dropChance: Number(e.target.value) })
              }
              style={{ width: 50, ...inputStyle }}
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
