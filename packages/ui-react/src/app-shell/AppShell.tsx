/**
 * AppShell — top-level GUI root component.
 * Composes AppLayout with TopBar, LeftSidebar, RightSidebar, BottomBar.
 */

import React from 'react';
import type { WorldSnapshot, MatchConfig, KeybindConfig } from '@bomberman65/shared';
import type { ActorState } from '@bomberman65/shared';
import { AppLayout } from '../layout/AppLayout.js';
import { TopBar, type TopBarProps } from '../top-bar/TopBar.js';
import { LeftSidebar, type LeftSidebarProps } from '../left-sidebar/LeftSidebar.js';
import { RightSidebar } from '../right-sidebar/RightSidebar.js';
import { BottomBar } from '../bottom-bar/BottomBar.js';

export type MapSelectorProps = {
  maps: { id: string; name: string }[];
  selectedMapId: string;
  onSelectMap: (id: string) => void;
};

export type AppShellProps = {
  renderArea: React.ReactNode;
  snapshot?: WorldSnapshot;
  controls?: TopBarProps;
  mapSelector?: MapSelectorProps;
  configOverrides?: Partial<MatchConfig>;
  onConfigChange?: (overrides: Partial<MatchConfig>) => void;
  keybinds?: KeybindConfig;
  onKeybindsChange?: (keybinds: KeybindConfig) => void;
  onModifyActor?: (actorId: string, field: string, value: number) => void;
  agentSetup?: Pick<LeftSidebarProps, 'bots' | 'onBotsChange' | 'behaviors' | 'onBehaviorsChange' | 'currentMap'>;
};

export function AppShell({
  renderArea,
  snapshot,
  controls,
  mapSelector,
  configOverrides,
  onConfigChange,
  keybinds,
  onKeybindsChange,
  onModifyActor,
  agentSetup,
}: AppShellProps) {
  const actorCount = snapshot
    ? (Object.values(snapshot.actors) as ActorState[]).filter((a) => a.state.kind !== 'eliminated')
        .length
    : undefined;
  const bombCount = snapshot ? Object.keys(snapshot.bombs).length : undefined;

  const runInfo = snapshot ? { runId: '-', mapId: '-', seed: 0, tick: snapshot.tick } : undefined;

  return (
    <AppLayout
      topBar={<TopBar {...controls} />}
      leftSidebar={
        <LeftSidebar
          runInfo={runInfo}
          mapSelector={mapSelector}
          configOverrides={configOverrides}
          onConfigChange={onConfigChange}
          keybinds={keybinds}
          onKeybindsChange={onKeybindsChange}
          {...agentSetup}
        />
      }
      rightSidebar={<RightSidebar snapshot={snapshot} onModifyActor={onModifyActor} />}
      bottomBar={<BottomBar actorCount={actorCount} bombCount={bombCount} />}
      center={renderArea}
    />
  );
}
