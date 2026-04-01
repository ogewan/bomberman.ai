/**
 * AppLayout — stable desktop-first application layout with resizable sidebars.
 */

import React, { useCallback, useState } from 'react';
import { useLayoutStore } from '@bomberman65/app-state';
import { ResizeHandle } from './ResizeHandle.js';

export type AppLayoutProps = {
  topBar: React.ReactNode;
  leftSidebar: React.ReactNode;
  rightSidebar: React.ReactNode;
  bottomBar: React.ReactNode;
  center: React.ReactNode;
};

const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 500;

export function AppLayout({
  topBar,
  leftSidebar,
  rightSidebar,
  bottomBar,
  center,
}: AppLayoutProps) {
  const leftOpen = useLayoutStore((s) => s.leftSidebarOpen);
  const rightOpen = useLayoutStore((s) => s.rightSidebarOpen);
  const [leftWidth, setLeftWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(260);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, w + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((w) => Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, w + delta)));
  }, []);

  return (
    <div style={styles.root}>
      <div style={styles.topBar}>{topBar}</div>
      <div style={styles.middle}>
        {leftOpen && (
          <>
            <div style={{ ...styles.sidebar, width: leftWidth }}>{leftSidebar}</div>
            <ResizeHandle side="left" onResize={handleLeftResize} />
          </>
        )}
        <div style={styles.center}>{center}</div>
        {rightOpen && (
          <>
            <ResizeHandle side="right" onResize={handleRightResize} />
            <div style={{ ...styles.sidebar, width: rightWidth }}>{rightSidebar}</div>
          </>
        )}
      </div>
      <div style={styles.bottomBar}>{bottomBar}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    color: '#e0e0e0',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
  },
  topBar: {
    height: '40px',
    borderBottom: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: '8px',
    flexShrink: 0,
  },
  middle: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    borderRight: '1px solid #333',
    borderLeft: '1px solid #333',
    overflow: 'auto',
    flexShrink: 0,
  },
  center: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  bottomBar: {
    height: '28px',
    borderTop: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: '12px',
    flexShrink: 0,
    fontSize: '11px',
  },
};
