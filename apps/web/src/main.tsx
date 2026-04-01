/**
 * Web app entry point — mounts the GUI root with embedded R3F render area.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { WorldSnapshot, MapDefinition, MatchConfig } from '@bomberman65/shared';
import { DEFAULT_MATCH_CONFIG } from '@bomberman65/shared';
import {
  createSimulationRun,
  SimulationRunner,
  KeyboardIntentCollector,
  BotIntentCollector,
  CompositeIntentCollector,
  buildRenderModel,
  serializeMap,
} from '@bomberman65/game-core';
import type { RenderModel } from '@bomberman65/game-core';
import { SceneRoot } from '@bomberman65/render-r3f';
import { AppShell, MapEditor } from '@bomberman65/ui-react';
import { useSessionStore, useLayoutStore, useSelectionStore } from '@bomberman65/app-state';
import {
  loadManifest,
  loadMap,
  downloadAsFile,
  readFileAsText,
  type ContentManifest,
} from './contentLoader.js';

function App() {
  const [runner, setRunner] = useState<SimulationRunner | null>(null);
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [renderModel, setRenderModel] = useState<RenderModel | null>(null);
  const intervalRef = useRef<number | null>(null);
  const keyboardRef = useRef<KeyboardIntentCollector | null>(null);

  // Content state
  const [manifest, setManifest] = useState<ContentManifest | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string>('training');
  const [currentMap, setCurrentMap] = useState<MapDefinition | null>(null);
  const [configOverrides, setConfigOverrides] = useState<Partial<MatchConfig>>({});

  const gameState = useSessionStore((s) => s.gameState);
  const setGameState = useSessionStore((s) => s.setGameState);
  const setCurrentTick = useSessionStore((s) => s.setCurrentTick);
  const playbackSpeed = useSessionStore((s) => s.playbackSpeed);
  const showDebugGrid = useLayoutStore((s) => s.showDebugGrid);
  const showDebugCoords = useLayoutStore((s) => s.showDebugCoordinates);
  const select = useSelectionStore((s) => s.select);

  const handleSelectActor = useCallback((id: string) => select({ kind: 'actor', id }), [select]);
  const handleSelectBomb = useCallback((id: string) => select({ kind: 'bomb', id }), [select]);

  // Load manifest on mount
  useEffect(() => {
    loadManifest().then(setManifest).catch(console.error);
  }, []);

  // Load selected map when selection changes
  useEffect(() => {
    if (!manifest) return;
    const entry = manifest.maps.find((m) => m.id === selectedMapId);
    if (!entry) return;
    loadMap(entry.file).then(setCurrentMap).catch(console.error);
  }, [manifest, selectedMapId]);

  const updateView = useCallback(
    (snap: WorldSnapshot) => {
      setSnapshot(snap);
      setRenderModel(buildRenderModel(snap));
      setCurrentTick(snap.tick);
    },
    [setCurrentTick],
  );

  const handlePlay = useCallback(() => {
    if (!currentMap) return;
    if (keyboardRef.current) keyboardRef.current.detach();

    const seed = Date.now();
    const config = {
      ...DEFAULT_MATCH_CONFIG,
      ...configOverrides,
      mapId: currentMap.id,
      seed,
    } as MatchConfig;

    // First player spawn → keyboard, rest → bots
    const spawnAssignments = currentMap.spawns.map((s, i) => ({
      spawnId: s.id,
      actorId: `actor_${s.id}`,
      controller: (i === 0 ? 'player' : 'bot') as 'player' | 'bot',
    }));

    const { run } = createSimulationRun({ map: currentMap, config, spawnAssignments });

    const keyboard = new KeyboardIntentCollector(spawnAssignments[0]!.actorId);
    keyboard.attach();
    keyboardRef.current = keyboard;

    const botActorIds = spawnAssignments.slice(1).map((s) => s.actorId);
    const bot = new BotIntentCollector(botActorIds, seed);
    const composite = new CompositeIntentCollector([keyboard, bot]);

    const r = new SimulationRunner(run, composite);
    r.start();
    setRunner(r);
    setGameState('playing');
    updateView(run.snapshot);
  }, [currentMap, configOverrides, setGameState, updateView]);

  const handlePause = useCallback(() => {
    runner?.pause();
    setGameState('paused');
  }, [runner, setGameState]);
  const handleResume = useCallback(() => {
    runner?.resume();
    setGameState('playing');
  }, [runner, setGameState]);
  const handleStop = useCallback(() => {
    runner?.stop();
    setGameState('setup');
    setRunner(null);
    setSnapshot(null);
    setRenderModel(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (keyboardRef.current) {
      keyboardRef.current.detach();
      keyboardRef.current = null;
    }
  }, [runner, setGameState]);

  const handleStepTick = useCallback(() => {
    if (!runner) return;
    runner.stepTick();
    updateView(runner.getRun().snapshot);
    if (runner.getRun().status === 'finished') setGameState('results');
  }, [runner, updateView, setGameState]);

  const handleExportMap = useCallback(() => {
    if (!currentMap) return;
    downloadAsFile(serializeMap(currentMap), `${currentMap.id}.json`);
  }, [currentMap]);

  const handleImportMap = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const json = await readFileAsText(file);
        const map = JSON.parse(json) as MapDefinition;
        setCurrentMap(map);
        setSelectedMapId(map.id);
      } catch (e) {
        console.error('Failed to import map:', e);
      }
    };
    input.click();
  }, []);

  const handleEditMap = useCallback(() => {
    setGameState('editor');
  }, [setGameState]);

  const handleNewMap = useCallback(() => {
    setCurrentMap(null);
    setGameState('editor');
  }, [setGameState]);

  const handleEditorSave = useCallback(
    (map: MapDefinition) => {
      setCurrentMap(map);
      setSelectedMapId(map.id);
      setGameState('setup');
      downloadAsFile(serializeMap(map), `${map.id}.json`);
    },
    [setGameState],
  );

  const handleEditorClose = useCallback(() => {
    setGameState('setup');
  }, [setGameState]);

  // Auto-step loop when playing
  useEffect(() => {
    if (gameState === 'playing' && runner) {
      const ms = Math.max(16, Math.floor(50 / playbackSpeed));
      intervalRef.current = window.setInterval(() => {
        runner.stepTick();
        updateView(runner.getRun().snapshot);
        if (runner.getRun().status === 'finished') {
          setGameState('results');
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (keyboardRef.current) {
            keyboardRef.current.detach();
            keyboardRef.current = null;
          }
        }
      }, ms);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [gameState, runner, playbackSpeed, updateView, setGameState]);

  useEffect(
    () => () => {
      if (keyboardRef.current) keyboardRef.current.detach();
    },
    [],
  );

  return (
    <AppShell
      snapshot={snapshot ?? undefined}
      controls={{
        onPlay: handlePlay,
        onPause: handlePause,
        onResume: handleResume,
        onStop: handleStop,
        onStepTick: handleStepTick,
        onRestart: handlePlay,
        onExportMap: handleExportMap,
        onImportMap: handleImportMap,
        onEditMap: handleEditMap,
        onNewMap: handleNewMap,
      }}
      mapSelector={{
        maps: manifest?.maps ?? [],
        selectedMapId,
        onSelectMap: setSelectedMapId,
      }}
      configOverrides={configOverrides}
      onConfigChange={setConfigOverrides}
      renderArea={
        gameState === 'editor' ? (
          <MapEditor
            initialMap={currentMap ?? undefined}
            onSave={handleEditorSave}
            onClose={handleEditorClose}
          />
        ) : renderModel ? (
          <SceneRoot
            renderModel={renderModel}
            showDebugGrid={showDebugGrid}
            showDebugCoordinates={showDebugCoords}
            onSelectActor={handleSelectActor}
            onSelectBomb={handleSelectBomb}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#888',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 18 }}>Bomberman 65</div>
            <div>{currentMap ? `Map: ${currentMap.name}` : 'Loading maps...'}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
              WASD/Arrows = Move | Space = Bomb | E = Pickup/Pump | Q = Throw | F = Kick
            </div>
          </div>
        )
      }
    />
  );
}

createRoot(document.getElementById('root')!).render(<App />);
