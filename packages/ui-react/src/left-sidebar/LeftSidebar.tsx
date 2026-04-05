/**
 * LeftSidebar — navigation, tools, browsers.
 * All sections shown as accordions. Sections are greyed out when not
 * applicable to the current game state.
 */

import { useSessionStore } from '@bomberman65/app-state';
import type { MatchConfig, KeybindConfig, BotBehavior, MapDefinition } from '@bomberman65/shared';
import { Accordion } from '../layout/Accordion.js';
import { MatchConfigEditor } from '../controls/MatchConfigEditor.js';
import { KeybindEditor } from '../controls/KeybindEditor.js';
import { AgentSetup, type BotSlot } from '../controls/AgentSetup.js';
import type { MapSelectorProps } from '../app-shell/AppShell.js';

export type LeftSidebarProps = {
  runInfo?: { runId: string; mapId: string; seed: number; tick: number };
  mapSelector?: MapSelectorProps;
  configOverrides?: Partial<MatchConfig>;
  onConfigChange?: (overrides: Partial<MatchConfig>) => void;
  keybinds?: KeybindConfig;
  onKeybindsChange?: (keybinds: KeybindConfig) => void;
  bots?: BotSlot[];
  onBotsChange?: (bots: BotSlot[]) => void;
  behaviors?: BotBehavior[];
  onBehaviorsChange?: (behaviors: BotBehavior[]) => void;
  currentMap?: MapDefinition | null;
};

export function LeftSidebar({
  runInfo,
  mapSelector,
  configOverrides,
  onConfigChange,
  keybinds,
  onKeybindsChange,
  bots,
  onBotsChange,
  behaviors,
  onBehaviorsChange,
  currentMap,
}: LeftSidebarProps) {
  const gameState = useSessionStore((s) => s.gameState);

  const isSetup = gameState === 'setup' || gameState === 'editor';
  const isRunning = gameState === 'playing' || gameState === 'paused';

  return (
    <div style={{ padding: 4 }}>
      {/* Content / Map Browser */}
      <Accordion title="Content" enabled={isSetup} defaultOpen={isSetup}>
        {mapSelector ? (
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
              }}
            >
              {mapSelector.maps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#888' }}>No maps loaded</div>
        )}
      </Accordion>

      {/* Config */}
      <Accordion title="Config" enabled={isSetup} defaultOpen={false}>
        {configOverrides !== undefined && onConfigChange ? (
          <MatchConfigEditor overrides={configOverrides} onChange={onConfigChange} />
        ) : (
          <div style={{ fontSize: 11, color: '#888' }}>No config available</div>
        )}
      </Accordion>

      {/* Keybinds — under config, always enabled */}
      <Accordion title="Keybinds" enabled={true} defaultOpen={false}>
        {keybinds && onKeybindsChange ? (
          <KeybindEditor keybinds={keybinds} onChange={onKeybindsChange} />
        ) : (
          <div style={{ fontSize: 11, color: '#888' }}>No keybind config</div>
        )}
      </Accordion>

      {/* Agents */}
      <Accordion title="Agents" enabled={isSetup} defaultOpen={isSetup}>
        {bots && onBotsChange && behaviors && onBehaviorsChange ? (
          <AgentSetup
            bots={bots}
            onBotsChange={onBotsChange}
            behaviors={behaviors}
            onBehaviorsChange={onBehaviorsChange}
            currentMap={currentMap ?? null}
          />
        ) : (
          <div style={{ fontSize: 11, color: '#888' }}>Agent assignment not available.</div>
        )}
      </Accordion>

      {/* Run Info */}
      <Accordion title="Run" enabled={isRunning} defaultOpen={isRunning}>
        {runInfo ? (
          <div style={{ fontSize: 11 }}>
            <div>Run: {runInfo.runId}</div>
            <div>Map: {runInfo.mapId}</div>
            <div>Seed: {runInfo.seed}</div>
            <div>Tick: {runInfo.tick}</div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#888' }}>No active run</div>
        )}
      </Accordion>

      {/* Overlays */}
      <Accordion title="Overlays" enabled={isRunning} defaultOpen={false}>
        <div style={{ fontSize: 11, color: '#888' }}>Overlay controls in top bar.</div>
      </Accordion>

      {/* Replay */}
      <Accordion title="Replay" enabled={gameState === 'replay'} defaultOpen={false}>
        <div style={{ fontSize: 11, color: '#888' }}>Replay controls (future).</div>
      </Accordion>

      {/* Batch */}
      <Accordion title="Batch" enabled={gameState === 'batch'} defaultOpen={false}>
        <div style={{ fontSize: 11, color: '#888' }}>Batch job management (future).</div>
      </Accordion>
    </div>
  );
}
