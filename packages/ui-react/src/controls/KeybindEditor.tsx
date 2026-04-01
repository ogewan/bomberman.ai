/**
 * KeybindEditor — editable keybind configuration.
 * Shows each action with its bound keys, click to rebind.
 */

import { useState } from 'react';
import type { KeybindConfig } from '@bomberman65/shared';

export type KeybindEditorProps = {
  keybinds: KeybindConfig;
  onChange: (keybinds: KeybindConfig) => void;
};

type ActionKey = keyof KeybindConfig;

const ACTION_LABELS: Record<ActionKey, string> = {
  moveUp: 'Move Up',
  moveDown: 'Move Down',
  moveLeft: 'Move Left',
  moveRight: 'Move Right',
  placeBomb: 'Place Bomb',
  pickupPump: 'Pickup / Pump',
  throw: 'Throw',
  kick: 'Kick',
};

const ACTION_ORDER: ActionKey[] = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'placeBomb',
  'pickupPump',
  'throw',
  'kick',
];

export function KeybindEditor({ keybinds, onChange }: KeybindEditorProps) {
  const [listening, setListening] = useState<ActionKey | null>(null);

  const handleKeyCapture = (action: ActionKey) => {
    setListening(action);

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const key = e.key;
      const current = keybinds[action];
      // Toggle: if key already bound, remove it; otherwise add it
      const updated = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      onChange({ ...keybinds, [action]: updated.length > 0 ? updated : current });
      setListening(null);
      document.removeEventListener('keydown', handler);
    };

    document.addEventListener('keydown', handler);
  };

  return (
    <div style={{ fontSize: 11 }}>
      {ACTION_ORDER.map((action) => (
        <div
          key={action}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 3,
            padding: '2px 0',
            borderBottom: '1px solid #2a2a2a',
          }}
        >
          <span>{ACTION_LABELS[action]}</span>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {keybinds[action].map((key) => (
              <span
                key={key}
                style={{
                  padding: '1px 4px',
                  background: '#333',
                  border: '1px solid #555',
                  borderRadius: 2,
                  fontSize: 10,
                  fontFamily: 'monospace',
                }}
              >
                {formatKey(key)}
              </span>
            ))}
            <button
              onClick={() => handleKeyCapture(action)}
              style={{
                padding: '1px 4px',
                fontSize: 9,
                background: listening === action ? '#554' : '#2a2a2a',
                color: listening === action ? '#ff0' : '#888',
                border: '1px solid #555',
                borderRadius: 2,
                cursor: 'pointer',
              }}
            >
              {listening === action ? '...' : '+'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatKey(key: string): string {
  if (key === ' ') return 'Space';
  if (key === 'ArrowUp') return '↑';
  if (key === 'ArrowDown') return '↓';
  if (key === 'ArrowLeft') return '←';
  if (key === 'ArrowRight') return '→';
  return key.toUpperCase();
}
