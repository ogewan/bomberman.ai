/**
 * RightSidebar — inspector, selected entity details, validation, summaries.
 * All sections shown as accordions. Sections are greyed out when not
 * applicable to the current game state.
 */

import React from 'react';
import { useSessionStore, useSelectionStore } from '@bomberman65/app-state';
import type { ActorState, BombState, WorldSnapshot } from '@bomberman65/shared';
import { Accordion } from '../layout/Accordion.js';

export type RightSidebarProps = {
  snapshot?: WorldSnapshot;
  onModifyActor?: (actorId: string, field: string, value: number) => void;
};

export function RightSidebar({ snapshot, onModifyActor }: RightSidebarProps) {
  const gameState = useSessionStore((s) => s.gameState);
  const selection = useSelectionStore((s) => s.selection);

  const isRunning = gameState === 'playing' || gameState === 'paused';
  const hasSnapshot = !!snapshot;

  return (
    <div style={{ padding: 4 }}>
      {/* Inspector */}
      <Accordion title="Inspector" enabled={hasSnapshot} defaultOpen={true}>
        <InspectorPanel selection={selection} snapshot={snapshot} onModifyActor={onModifyActor} />
      </Accordion>

      {/* Actors */}
      <Accordion title="Actors" enabled={hasSnapshot} defaultOpen={isRunning}>
        {snapshot ? <ActorListPanel snapshot={snapshot} /> : <Empty />}
      </Accordion>

      {/* Bombs */}
      <Accordion title="Bombs" enabled={hasSnapshot} defaultOpen={false}>
        {snapshot ? <BombListPanel snapshot={snapshot} /> : <Empty />}
      </Accordion>

      {/* Summary / Setup */}
      <Accordion title="Summary" enabled={gameState === 'setup'} defaultOpen={false}>
        <div style={{ fontSize: 11, color: '#888' }}>Map and scenario summary.</div>
      </Accordion>

      {/* Validation */}
      <Accordion title="Validation" enabled={gameState === 'setup'} defaultOpen={false}>
        <div style={{ fontSize: 11, color: '#888' }}>Validation output (future).</div>
      </Accordion>

      {/* Result */}
      <Accordion
        title="Result"
        enabled={gameState === 'results'}
        defaultOpen={gameState === 'results'}
      >
        <div style={{ fontSize: 11, color: '#888' }}>Match result summary.</div>
      </Accordion>
    </div>
  );
}

function Empty() {
  return <div style={{ fontSize: 11, color: '#888' }}>No data</div>;
}

function InspectorPanel({
  selection,
  snapshot,
  onModifyActor,
}: {
  selection: { kind: string; id?: string };
  snapshot?: WorldSnapshot;
  onModifyActor?: (actorId: string, field: string, value: number) => void;
}) {
  if (selection.kind === 'none') {
    return <div style={{ fontSize: 11, color: '#888' }}>Click an entity to inspect</div>;
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
        {onModifyActor && (
          <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {actor.stunTicksRemaining <= 0 ? (
              <button style={debugBtnStyle} onClick={() => onModifyActor(actor.id, 'stunTicksRemaining', 60)}>
                Apply Stun
              </button>
            ) : (
              <button style={debugBtnStyle} onClick={() => onModifyActor(actor.id, 'stunTicksRemaining', 0)}>
                Clear Stun
              </button>
            )}
            {actor.shieldTicksRemaining <= 0 ? (
              <button style={debugBtnStyle} onClick={() => onModifyActor(actor.id, 'shieldTicksRemaining', 300)}>
                Apply Shield
              </button>
            ) : (
              <button style={debugBtnStyle} onClick={() => onModifyActor(actor.id, 'shieldTicksRemaining', 0)}>
                Clear Shield
              </button>
            )}
          </div>
        )}
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

  if (selection.kind === 'cell' && snapshot && 'position' in selection) {
    const pos = (selection as { position: { x: number; y: number; z: number } }).position;
    const cell = snapshot.cells[pos.z]?.[pos.y]?.[pos.x];
    return (
      <div style={{ fontSize: 11 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
          Cell ({pos.x}, {pos.y}, {pos.z})
        </div>
        <div>Terrain: {cell?.terrain ?? 'out of bounds'}</div>
        {cell?.ramp && (
          <div>
            Ramp: {cell.ramp.entry} → {cell.ramp.exit} (dz={cell.ramp.deltaZ})
          </div>
        )}
        {cell?.item && <div>Item: {cell.item}</div>}
        {cell?.occupant && (
          <div>
            Occupant: {cell.occupant.kind} ({cell.occupant.id})
          </div>
        )}
        {!cell?.occupant && <div>Occupant: none</div>}
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
          style={{
            padding: '2px 0',
            cursor: 'pointer',
            borderBottom: '1px solid #333',
          }}
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
          style={{
            padding: '2px 0',
            cursor: 'pointer',
            borderBottom: '1px solid #333',
          }}
        >
          {bomb.id} — {bomb.bombType} fuse:{bomb.fuseTicksRemaining} ({bomb.cell.x},{bomb.cell.y},
          {bomb.cell.z})
        </div>
      ))}
    </div>
  );
}

const debugBtnStyle: React.CSSProperties = {
  padding: '2px 6px',
  fontSize: 10,
  background: '#333',
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: 3,
  cursor: 'pointer',
};
