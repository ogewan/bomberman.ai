/**
 * RightSidebar — inspector, selected entity details, validation, summaries.
 * Tab content adapts to game state and current selection.
 */

import { useState } from 'react';
import { useSessionStore, useSelectionStore } from '@bomberman65/app-state';
import type { ActorState, BombState, WorldSnapshot } from '@bomberman65/shared';

export type RightSidebarProps = {
  snapshot?: WorldSnapshot;
};

export function RightSidebar({ snapshot }: RightSidebarProps) {
  const gameState = useSessionStore((s) => s.gameState);
  const selection = useSelectionStore((s) => s.selection);
  const tabs = getTabsForState(gameState);
  const [activeTab, setActiveTab] = useState(tabs[0] ?? 'inspector');

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              background: activeTab === tab ? '#444' : '#2a2a2a',
              color: '#e0e0e0',
              border: '1px solid #555',
              borderRadius: '3px 3px 0 0',
              cursor: 'pointer',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'inspector' && <InspectorPanel selection={selection} snapshot={snapshot} />}

      {activeTab === 'actors' && snapshot && <ActorListPanel snapshot={snapshot} />}

      {activeTab === 'bombs' && snapshot && <BombListPanel snapshot={snapshot} />}
    </div>
  );
}

function InspectorPanel({
  selection,
  snapshot,
}: {
  selection: { kind: string; id?: string };
  snapshot?: WorldSnapshot;
}) {
  if (selection.kind === 'none') {
    return <div style={{ fontSize: 11, color: '#888' }}>No selection</div>;
  }

  if (selection.kind === 'actor' && snapshot && 'id' in selection) {
    const actor = snapshot.actors[selection.id as string] as ActorState | undefined;
    if (!actor) return <div style={{ fontSize: 11 }}>Actor not found</div>;
    return (
      <div style={{ fontSize: 11 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Actor: {actor.id}</div>
        <div>
          Position: ({actor.cell.x}, {actor.cell.y}, {actor.cell.z})
        </div>
        <div>Facing: {actor.facing}</div>
        <div>State: {actor.state.kind}</div>
        <div>
          Power: {actor.power} | Count: {actor.count}
        </div>
        <div>Upgrade: {actor.upgrade}</div>
        {actor.stunTicksRemaining > 0 && <div>Stunned: {actor.stunTicksRemaining} ticks</div>}
        {actor.shieldTicksRemaining > 0 && <div>Shield: {actor.shieldTicksRemaining} ticks</div>}
      </div>
    );
  }

  if (selection.kind === 'bomb' && snapshot && 'id' in selection) {
    const bomb = snapshot.bombs[selection.id as string] as BombState | undefined;
    if (!bomb) return <div style={{ fontSize: 11 }}>Bomb not found</div>;
    return (
      <div style={{ fontSize: 11 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Bomb: {bomb.id}</div>
        <div>
          Position: ({bomb.cell.x}, {bomb.cell.y}, {bomb.cell.z})
        </div>
        <div>Type: {bomb.bombType}</div>
        <div>Power: {bomb.power}</div>
        <div>Fuse: {bomb.fuseTicksRemaining}</div>
        <div>State: {bomb.state.kind}</div>
      </div>
    );
  }

  return <div style={{ fontSize: 11 }}>Selected: {selection.kind}</div>;
}

function ActorListPanel({ snapshot }: { snapshot: WorldSnapshot }) {
  const select = useSelectionStore((s) => s.select);
  const actors = Object.values(snapshot.actors) as ActorState[];

  return (
    <div style={{ fontSize: 11 }}>
      {actors.map((actor) => (
        <div
          key={actor.id}
          onClick={() => select({ kind: 'actor', id: actor.id })}
          style={{ padding: '2px 0', cursor: 'pointer', borderBottom: '1px solid #333' }}
        >
          {actor.id} — {actor.state.kind} ({actor.cell.x},{actor.cell.y},{actor.cell.z})
        </div>
      ))}
    </div>
  );
}

function BombListPanel({ snapshot }: { snapshot: WorldSnapshot }) {
  const select = useSelectionStore((s) => s.select);
  const bombs = Object.values(snapshot.bombs) as BombState[];

  return (
    <div style={{ fontSize: 11 }}>
      {bombs.length === 0 && <div style={{ color: '#888' }}>No bombs</div>}
      {bombs.map((bomb) => (
        <div
          key={bomb.id}
          onClick={() => select({ kind: 'bomb', id: bomb.id })}
          style={{ padding: '2px 0', cursor: 'pointer', borderBottom: '1px solid #333' }}
        >
          {bomb.id} — {bomb.bombType} fuse:{bomb.fuseTicksRemaining} ({bomb.cell.x},{bomb.cell.y},
          {bomb.cell.z})
        </div>
      ))}
    </div>
  );
}

function getTabsForState(state: string): string[] {
  switch (state) {
    case 'setup':
      return ['summary', 'validation', 'details'];
    case 'playing':
    case 'paused':
      return ['inspector', 'actors', 'bombs', 'cell'];
    case 'replay':
      return ['inspector', 'result', 'validation'];
    case 'results':
      return ['summary', 'stats', 'notes'];
    default:
      return ['inspector'];
  }
}
