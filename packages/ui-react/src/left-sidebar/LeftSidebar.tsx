/**
 * LeftSidebar — navigation, tools, browsers.
 * Uses tabs when content is dense. Tab content adapts to game state.
 */

import { useState } from 'react';
import { useSessionStore } from '@bomberman65/app-state';

export type LeftSidebarProps = {
  runInfo?: { runId: string; mapId: string; seed: number; tick: number };
};

export function LeftSidebar({ runInfo }: LeftSidebarProps) {
  const gameState = useSessionStore((s) => s.gameState);
  const tabs = getTabsForState(gameState);
  const [activeTab, setActiveTab] = useState(tabs[0] ?? 'run');

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

      {activeTab === 'content' && (
        <div style={{ fontSize: 11, color: '#888' }}>Map and scenario browser (Phase 9).</div>
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
