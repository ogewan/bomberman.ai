/**
 * SpawnEditor — displays and manages spawn point list.
 */

import type { SpawnPoint } from '@bomberman65/shared';

export type SpawnEditorProps = {
  spawns: SpawnPoint[];
  onRemoveSpawn: (id: string) => void;
};

export function SpawnEditor({ spawns, onRemoveSpawn }: SpawnEditorProps) {
  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#aaa' }}>
        Spawns ({spawns.length})
      </div>
      {spawns.length === 0 && <div style={{ color: '#666' }}>No spawns placed</div>}
      {spawns.map((s) => (
        <div
          key={s.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 2,
            borderBottom: '1px solid #333',
            paddingBottom: 2,
          }}
        >
          <span style={{ color: s.kind === 'player' ? '#4af' : '#f84' }}>
            {s.kind === 'player' ? 'P' : 'B'}
          </span>
          <span>{s.id}</span>
          <span style={{ color: '#888' }}>
            ({s.cell.x},{s.cell.y},{s.cell.z})
          </span>
          <button
            onClick={() => onRemoveSpawn(s.id)}
            style={{
              marginLeft: 'auto',
              padding: '0 4px',
              fontSize: 10,
              background: '#433',
              color: '#e88',
              border: '1px solid #655',
              borderRadius: 2,
              cursor: 'pointer',
            }}
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
