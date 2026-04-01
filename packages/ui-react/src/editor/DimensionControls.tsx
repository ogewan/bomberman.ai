/**
 * DimensionControls — width, height, depth inputs for map dimensions.
 */

import React from 'react';
import type { Vec3i } from '@bomberman65/shared';

export type DimensionControlsProps = {
  size: Vec3i;
  onChange: (size: Vec3i) => void;
};

export function DimensionControls({ size, onChange }: DimensionControlsProps) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 11, marginBottom: 8 }}>
      <label>
        W:{' '}
        <input
          type="number"
          min={3}
          max={21}
          value={size.x}
          onChange={(e) => onChange({ ...size, x: Math.max(3, Number(e.target.value)) })}
          style={inputStyle}
        />
      </label>
      <label>
        H:{' '}
        <input
          type="number"
          min={3}
          max={21}
          value={size.y}
          onChange={(e) => onChange({ ...size, y: Math.max(3, Number(e.target.value)) })}
          style={inputStyle}
        />
      </label>
      <label>
        D:{' '}
        <input
          type="number"
          min={1}
          max={3}
          value={size.z}
          onChange={(e) =>
            onChange({ ...size, z: Math.max(1, Math.min(3, Number(e.target.value))) })
          }
          style={inputStyle}
        />
      </label>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: 40,
  background: '#2a2a2a',
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: 3,
  fontSize: 11,
  padding: '1px 4px',
};
