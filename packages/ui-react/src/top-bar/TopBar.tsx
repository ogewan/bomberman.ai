/**
 * TopBar — run controls, mode controls, overlay toggles.
 * Adapts to current game state.
 */

import React from 'react';
import { useSessionStore, useLayoutStore } from '@bomberman65/app-state';
import type { GameState } from '@bomberman65/app-state';

export type TopBarProps = {
  onPlay?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onStepTick?: () => void;
  onRestart?: () => void;
  onExportMap?: () => void;
  onImportMap?: () => void;
  onEditMap?: () => void;
  onNewMap?: () => void;
};

export function TopBar(props: TopBarProps) {
  const gameState = useSessionStore((s) => s.gameState);
  const playbackSpeed = useSessionStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useSessionStore((s) => s.setPlaybackSpeed);
  const toggleDebugGrid = useLayoutStore((s) => s.toggleDebugGrid);
  const showDebugGrid = useLayoutStore((s) => s.showDebugGrid);
  const toggleLeftSidebar = useLayoutStore((s) => s.toggleLeftSidebar);
  const toggleRightSidebar = useLayoutStore((s) => s.toggleRightSidebar);

  return (
    <>
      <span style={{ fontWeight: 'bold', marginRight: 8 }}>Bomberman 65</span>
      <span style={{ color: '#888', marginRight: 12 }}>{formatGameState(gameState)}</span>

      <div style={{ display: 'flex', gap: 4 }}>{renderControls(gameState, props)}</div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
        <label style={{ fontSize: 11 }}>
          Speed:
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            style={selectStyle}
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </label>
        <Btn onClick={toggleDebugGrid}>{showDebugGrid ? 'Grid: ON' : 'Grid: OFF'}</Btn>
        <Btn onClick={toggleLeftSidebar}>L</Btn>
        <Btn onClick={toggleRightSidebar}>R</Btn>
      </div>
    </>
  );
}

function renderControls(state: GameState, handlers: TopBarProps) {
  switch (state) {
    case 'setup':
      return (
        <>
          <Btn onClick={handlers.onPlay}>Start</Btn>
          <Btn onClick={handlers.onEditMap}>Edit Map</Btn>
          <Btn onClick={handlers.onNewMap}>New Map</Btn>
          <Btn onClick={handlers.onImportMap}>Import</Btn>
          <Btn onClick={handlers.onExportMap}>Export</Btn>
        </>
      );
    case 'playing':
      return (
        <>
          <Btn onClick={handlers.onPause}>Pause</Btn>
          <Btn onClick={handlers.onStop}>Back to Setup</Btn>
        </>
      );
    case 'paused':
      return (
        <>
          <Btn onClick={handlers.onResume}>Resume</Btn>
          <Btn onClick={handlers.onStepTick}>Step</Btn>
          <Btn onClick={handlers.onStop}>Back to Setup</Btn>
        </>
      );
    case 'results':
      return (
        <>
          <Btn onClick={handlers.onRestart}>Restart</Btn>
          <Btn onClick={handlers.onStop}>Back to Setup</Btn>
        </>
      );
    default:
      return null;
  }
}

function Btn({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={btnStyle}>
      {children}
    </button>
  );
}

function formatGameState(state: GameState): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

const btnStyle: React.CSSProperties = {
  padding: '2px 10px',
  fontSize: '12px',
  background: '#333',
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: '3px',
  cursor: 'pointer',
};

const selectStyle: React.CSSProperties = {
  marginLeft: 4,
  background: '#333',
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: '3px',
  fontSize: '11px',
};
