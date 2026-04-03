/**
 * MatchConfigEditor — form for editing MatchConfig timing fields.
 * Groups fields by category. Only shows overrides; defaults shown as placeholders.
 */

import React from 'react';
import type { MatchConfig } from '@bomberman65/shared';
import { DEFAULT_MATCH_CONFIG } from '@bomberman65/shared';

const defaults = { ...DEFAULT_MATCH_CONFIG, mapId: '', seed: 0 } as MatchConfig;

export type MatchConfigEditorProps = {
  overrides: Partial<MatchConfig>;
  onChange: (overrides: Partial<MatchConfig>) => void;
};

type FieldDef = {
  key: keyof MatchConfig;
  label: string;
  type: 'number' | 'upgrade';
};

const MOVEMENT_FIELDS: FieldDef[] = [
  { key: 'actorMoveTicks', label: 'Actor Move Ticks', type: 'number' },
  { key: 'boostedActorMoveTicks', label: 'Boosted Move Ticks', type: 'number' },
  { key: 'thrownTravelTicks', label: 'Thrown Travel Ticks', type: 'number' },
  { key: 'kickedBombTravelTicks', label: 'Kicked Bomb Ticks', type: 'number' },
  { key: 'throwDistance', label: 'Throw Distance', type: 'number' },
];

const BOMB_FIELDS: FieldDef[] = [
  { key: 'regularBombFuseTicks', label: 'Regular Fuse Ticks', type: 'number' },
  { key: 'pumpedBombFuseTicks', label: 'Pumped Fuse Ticks', type: 'number' },
  { key: 'explosionDurationTicks', label: 'Explosion Duration', type: 'number' },
];

const COMBAT_FIELDS: FieldDef[] = [
  { key: 'stunTicks', label: 'Stun Duration', type: 'number' },
  { key: 'shieldTicks', label: 'Shield Duration', type: 'number' },
];

const ACTOR_FIELDS: FieldDef[] = [
  { key: 'defaultActorCount', label: 'Default Bomb Count', type: 'number' },
  { key: 'defaultActorPower', label: 'Default Power', type: 'number' },
  { key: 'defaultActorUpgrade', label: 'Default Upgrade', type: 'upgrade' },
];

const GAME_FIELDS: FieldDef[] = [
  { key: 'maxTicks', label: 'Max Ticks (0=none)', type: 'number' },
  { key: 'stepSize', label: 'Step Size (ticks)', type: 'number' },
];

export function MatchConfigEditor({ overrides, onChange }: MatchConfigEditorProps) {
  const setField = (key: keyof MatchConfig, value: number | string | undefined) => {
    const next = { ...overrides };
    if (value === undefined || value === '') {
      delete next[key];
    } else {
      (next as Record<string, unknown>)[key] = value;
    }
    onChange(next);
  };

  return (
    <div style={{ fontSize: 11 }}>
      <FieldGroup
        title="Movement"
        fields={MOVEMENT_FIELDS}
        overrides={overrides}
        setField={setField}
      />
      <FieldGroup title="Bombs" fields={BOMB_FIELDS} overrides={overrides} setField={setField} />
      <FieldGroup title="Combat" fields={COMBAT_FIELDS} overrides={overrides} setField={setField} />
      <FieldGroup title="Actors" fields={ACTOR_FIELDS} overrides={overrides} setField={setField} />
      <FieldGroup title="Game" fields={GAME_FIELDS} overrides={overrides} setField={setField} />
      <button
        onClick={() => onChange({})}
        style={{
          marginTop: 8,
          padding: '2px 8px',
          fontSize: 11,
          background: '#333',
          color: '#e0e0e0',
          border: '1px solid #555',
          borderRadius: 3,
          cursor: 'pointer',
        }}
      >
        Reset to Defaults
      </button>
    </div>
  );
}

function FieldGroup({
  title,
  fields,
  overrides,
  setField,
}: {
  title: string;
  fields: FieldDef[];
  overrides: Partial<MatchConfig>;
  setField: (key: keyof MatchConfig, value: number | string | undefined) => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 2, color: '#aaa' }}>{title}</div>
      {fields.map((f) => (
        <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <label style={{ flex: 1 }}>{f.label}</label>
          {f.type === 'number' ? (
            <input
              type="number"
              value={(overrides[f.key] as number) ?? ''}
              placeholder={String(defaults[f.key] ?? '')}
              onChange={(e) => setField(f.key, e.target.value ? Number(e.target.value) : undefined)}
              style={inputStyle}
            />
          ) : (
            <select
              value={(overrides[f.key] as string) ?? ''}
              onChange={(e) => setField(f.key, e.target.value || undefined)}
              style={inputStyle}
            >
              <option value="">Default ({String(defaults[f.key])})</option>
              <option value="none">none</option>
              <option value="kick">kick</option>
              <option value="carryPump">carryPump</option>
              <option value="shield">shield</option>
            </select>
          )}
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: 60,
  background: '#2a2a2a',
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: 3,
  fontSize: 11,
  padding: '1px 4px',
};
