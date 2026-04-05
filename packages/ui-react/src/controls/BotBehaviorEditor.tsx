/**
 * BotBehaviorEditor — editor for creating/modifying bot behavior configurations.
 * Supports weight sliders, import/export as JSON, and preset selection.
 */

import React, { useCallback } from 'react';
import type { BotBehavior } from '@bomberman65/shared';
import { BOT_BEHAVIOR_PRESETS } from '@bomberman65/shared';

export type BotBehaviorEditorProps = {
  behavior: BotBehavior;
  onChange: (behavior: BotBehavior) => void;
  onSave: (behavior: BotBehavior) => void;
  onDelete?: (id: string) => void;
};

const WEIGHT_FIELDS: { key: keyof BotBehavior; label: string; max: number }[] = [
  { key: 'fleeWeight', label: 'Flee Danger', max: 2 },
  { key: 'bombWeight', label: 'Place Bombs', max: 2 },
  { key: 'itemWeight', label: 'Pursue Items', max: 2 },
  { key: 'chaseWeight', label: 'Chase Actors', max: 2 },
  { key: 'roamWeight', label: 'Roam / Explore', max: 2 },
];

export function BotBehaviorEditor({ behavior, onChange, onSave, onDelete }: BotBehaviorEditorProps) {
  const update = useCallback(
    (field: string, value: unknown) => {
      onChange({ ...behavior, [field]: value } as BotBehavior);
    },
    [behavior, onChange],
  );

  const handleExport = useCallback(() => {
    const json = JSON.stringify(behavior, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${behavior.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [behavior]);

  return (
    <div style={{ fontSize: 11 }}>
      {/* Name */}
      <label style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
        Name:
        <input
          type="text"
          value={behavior.name}
          onChange={(e) => update('name', e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Preset */}
      <label style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
        Preset:
        <select
          value=""
          onChange={(e) => {
            const preset = BOT_BEHAVIOR_PRESETS[e.target.value];
            if (preset) onChange({ ...preset, id: behavior.id, name: behavior.name });
          }}
          style={inputStyle}
        >
          <option value="">Load preset...</option>
          {Object.values(BOT_BEHAVIOR_PRESETS).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {/* Weight sliders */}
      {WEIGHT_FIELDS.map(({ key, label, max }) => (
        <div key={key} style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{label}</span>
            <span style={{ color: '#888' }}>{(behavior[key] as number).toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={max}
            step={0.1}
            value={behavior[key] as number}
            onChange={(e) => update(key, Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      ))}

      {/* Scan range */}
      <label style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
        Scan Range:
        <input
          type="number"
          min={1}
          max={10}
          value={behavior.scanRange}
          onChange={(e) => update('scanRange', Math.max(1, Math.min(10, Number(e.target.value))))}
          style={{ ...inputStyle, width: 40 }}
        />
      </label>

      {/* Use upgrades */}
      <label style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
        <input
          type="checkbox"
          checked={behavior.useUpgrades}
          onChange={(e) => update('useUpgrades', e.target.checked)}
        />
        Use upgrades (kick/throw/pump)
      </label>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => onSave(behavior)} style={btnStyle}>
          Save
        </button>
        <button onClick={handleExport} style={btnStyle}>
          Export
        </button>
        {onDelete && (
          <button onClick={() => onDelete(behavior.id)} style={{ ...btnStyle, background: '#433' }}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: '#2a2a2a',
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: 3,
  fontSize: 11,
  padding: '2px 4px',
};

const btnStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 10,
  background: '#343',
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: 3,
  cursor: 'pointer',
};
