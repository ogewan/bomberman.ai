/**
 * Accordion — expandable section with header. When disabled, appears greyed
 * out and contents are non-interactive.
 */

import { useState } from 'react';
import type React from 'react';

export type AccordionProps = {
  title: string;
  enabled: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function Accordion({ title, enabled, defaultOpen = false, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ marginBottom: 2, border: '1px solid #333', borderRadius: 3 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          padding: '4px 8px',
          fontSize: 11,
          fontWeight: 'bold',
          background: open ? '#3a3a3a' : '#2a2a2a',
          color: enabled ? '#e0e0e0' : '#666',
          border: 'none',
          borderBottom: open ? '1px solid #333' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 8 }}>{open ? '▼' : '▶'}</span>
        {title}
        {!enabled && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#555' }}>—</span>}
      </button>
      {open && (
        <div
          style={{
            padding: 8,
            opacity: enabled ? 1 : 0.4,
            pointerEvents: enabled ? 'auto' : 'none',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
