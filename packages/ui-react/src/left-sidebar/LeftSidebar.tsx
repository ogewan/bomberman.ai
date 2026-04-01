/**
 * LeftSidebar — navigation, tools, browsers.
 * Uses tabs when content is dense. Tab content adapts to game state.
 */

import { useState } from 'react';
import { useSessionStore } from '@bomberman65/app-state';
import type { MatchConfig } from '@bomberman65/shared';
import { MatchConfigEditor } from '../controls/MatchConfigEditor.js';
import type { MapSelectorProps } from '../app-shell/AppShell.js';

export type LeftSidebarProps = {
  runInfo?: { runId: string; mapId: string; seed: number; tick: number };
  mapSelector?: MapSelectorProps;
  configOverrides?: Partial<MatchConfig>;
  onConfigChange?: (overrides: Partial<MatchConfig>) => void;
};

export function LeftSidebar({
  runInfo,
  mapSelector,
  configOverrides,
  onConfigChange,
}: LeftSidebarProps) {
  const gameState = useSessionStore((s) => s.gameState);
  const tabs = getTabsForState(gameState);
  const [activeTab, setActiveTab] = useState(tabs[0] ?? 'run');

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: 'flex', gap: 2, marginBottom: 8, flexWrap: 'wrap' }}>
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

      {activeTab === 'content' && mapSelector && (
        <div style={{ fontSize: 11 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Select Map</div>
          <select
            value={mapSelector.selectedMapId}
            onChange={(e) => mapSelector.onSelectMap(e.target.value)}
            style={{
              width: '100%',
              background: '#2a2a2a',
              color: '#e0e0e0',
              border: '1px solid #555',
              borderRadius: 3,
              fontSize: 12,
              padding: '4px',
              marginBottom: 8,
            }}
          >
            {mapSelector.maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeTab === 'config' && configOverrides !== undefined && onConfigChange && (
        <MatchConfigEditor overrides={configOverrides} onChange={onConfigChange} />
      )}

      {activeTab === 'run' && runInfo && (
        <div style={{ fontSize: 11 }}>
          <div>Run: {runInfo.runId}</div>
          <div>Map: {runInfo.mapId}</div>
          <div>Seed: {runInfo.seed}</div>
          <div>Tick: {runInfo.tick}</div>
        </div>
      )}

      {activeTab === 'overlays' && (
        <div style={{ fontSize: 11, color: '#888' }}>Overlay controls available in top bar.</div>
      )}

      {activeTab === 'agents' && (
        <div style={{ fontSize: 11, color: '#888' }}>Agent assignment (future).</div>
      )}
    </div>
  );
}

function getTabsForState(state: string): string[] {
  switch (state) {
    case 'setup':
      return ['content', 'config', 'agents'];
    case 'playing':
    case 'paused':
      return ['run', 'overlays', 'tools'];
    case 'replay':
      return ['replay', 'events', 'runs'];
    case 'batch':
      return ['queue', 'running', 'done'];
    case 'results':
      return ['history', 'compare', 'exports'];
    default:
      return ['run'];
  }
}
