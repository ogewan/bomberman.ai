/**
 * AppShell — top-level GUI root component.
 * Composes AppLayout with TopBar, LeftSidebar, RightSidebar, BottomBar.
 * The center area is a slot for the R3F SceneRoot (passed as prop since
 * GUI and renderer have separate roots conceptually, but share the same DOM tree).
 */

import React from 'react';
import type { WorldSnapshot } from '@bomberman65/shared';
import { AppLayout } from '../layout/AppLayout.js';
import { TopBar, type TopBarProps } from '../top-bar/TopBar.js';
import { LeftSidebar } from '../left-sidebar/LeftSidebar.js';
import { RightSidebar } from '../right-sidebar/RightSidebar.js';
import { BottomBar } from '../bottom-bar/BottomBar.js';
import type { ActorState } from '@bomberman65/shared';

export type AppShellProps = {
  renderArea: React.ReactNode;
  snapshot?: WorldSnapshot;
  controls?: TopBarProps;
};

export function AppShell({ renderArea, snapshot, controls }: AppShellProps) {
  const actorCount = snapshot
    ? (Object.values(snapshot.actors) as ActorState[]).filter((a) => a.state.kind !== 'eliminated')
        .length
    : undefined;
  const bombCount = snapshot ? Object.keys(snapshot.bombs).length : undefined;

  const runInfo = snapshot ? { runId: '-', mapId: '-', seed: 0, tick: snapshot.tick } : undefined;

  return (
    <AppLayout
      topBar={<TopBar {...controls} />}
      leftSidebar={<LeftSidebar runInfo={runInfo} />}
      rightSidebar={<RightSidebar snapshot={snapshot} />}
      bottomBar={<BottomBar actorCount={actorCount} bombCount={bombCount} />}
      center={renderArea}
    />
  );
}
