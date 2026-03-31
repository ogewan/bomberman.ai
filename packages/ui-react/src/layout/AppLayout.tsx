/**
 * AppLayout — stable desktop-first application layout.
 * Top bar, left sidebar, center (render area), right sidebar, bottom bar.
 * Renderer is the priority area (>=50% width when sidebars open).
 */

import React from 'react';
import { useLayoutStore } from '@bomberman65/app-state';

export type AppLayoutProps = {
  topBar: React.ReactNode;
  leftSidebar: React.ReactNode;
  rightSidebar: React.ReactNode;
  bottomBar: React.ReactNode;
  center: React.ReactNode;
};

export function AppLayout({
  topBar,
  leftSidebar,
  rightSidebar,
  bottomBar,
  center,
}: AppLayoutProps) {
  const leftOpen = useLayoutStore((s) => s.leftSidebarOpen);
  const rightOpen = useLayoutStore((s) => s.rightSidebarOpen);

  return (
    <div style={styles.root}>
      <div style={styles.topBar}>{topBar}</div>
      <div style={styles.middle}>
        {leftOpen && <div style={styles.leftSidebar}>{leftSidebar}</div>}
        <div style={styles.center}>{center}</div>
        {rightOpen && <div style={styles.rightSidebar}>{rightSidebar}</div>}
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
  leftSidebar: {
    width: '240px',
    borderRight: '1px solid #333',
    overflow: 'auto',
    flexShrink: 0,
  },
  center: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  rightSidebar: {
    width: '260px',
    borderLeft: '1px solid #333',
    overflow: 'auto',
    flexShrink: 0,
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
