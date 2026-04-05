/**
 * Web app entry point — mounts the GUI root with embedded R3F render area.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { WorldSnapshot, MapDefinition, MatchConfig, KeybindConfig, BotBehavior } from '@bomberman65/shared';
import { DEFAULT_MATCH_CONFIG, DEFAULT_KEYBINDS, BOT_BEHAVIOR_PRESETS } from '@bomberman65/shared';
import {
  createSimulationRun,
  resetSessionCounters,
  SimulationRunner,
  KeyboardIntentCollector,
  BotIntentCollector,
  CompositeIntentCollector,
  buildRenderModel,
  buildTerrainModel,
  serializeMap,
} from '@bomberman65/game-core';
import type { RenderModel } from '@bomberman65/game-core';
import { SceneRoot } from '@bomberman65/render-r3f';
import { AppShell, MapEditor, type BotSlot } from '@bomberman65/ui-react';
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
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const keyboardRef = useRef<KeyboardIntentCollector | null>(null);
  const terrainCacheRef = useRef<{ terrain: ReturnType<typeof buildTerrainModel>; count: number } | null>(null);

  // Content state
  const [manifest, setManifest] = useState<ContentManifest | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string>('training');
  const [currentMap, setCurrentMap] = useState<MapDefinition | null>(null);
  const [configOverrides, setConfigOverrides] = useState<Partial<MatchConfig>>({});
  const [keybinds, setKeybinds] = useState<KeybindConfig>(DEFAULT_KEYBINDS);
  const [bots, setBots] = useState<BotSlot[]>([{ id: 'bot_1', behaviorId: 'default' }]);
  const [customBehaviors, setCustomBehaviors] = useState<BotBehavior[]>([]);
  const [importedMaps, setImportedMaps] = useState<MapDefinition[]>([]);

  const gameState = useSessionStore((s) => s.gameState);
  const setGameState = useSessionStore((s) => s.setGameState);
  const setCurrentTick = useSessionStore((s) => s.setCurrentTick);
  const playbackSpeed = useSessionStore((s) => s.playbackSpeed);
  const showDebugGrid = useLayoutStore((s) => s.showDebugGrid);
  const showDebugCoords = useLayoutStore((s) => s.showDebugCoordinates);
  const select = useSelectionStore((s) => s.select);

  const handleSelectActor = useCallback((id: string) => select({ kind: 'actor', id }), [select]);
  const handleSelectBomb = useCallback((id: string) => select({ kind: 'bomb', id }), [select]);
  const handleSelectCell = useCallback(
    (pos: { x: number; y: number; z: number }) => select({ kind: 'cell', position: pos }),
    [select],
  );

  // Load manifest on mount
  useEffect(() => {
    loadManifest().then(setManifest).catch(console.error);
  }, []);

  // Load selected map when selection changes — check imported maps first
  useEffect(() => {
    const imported = importedMaps.find((m) => m.id === selectedMapId);
    if (imported) {
      setCurrentMap(imported);
      return;
    }
    if (!manifest) return;
    const entry = manifest.maps.find((m) => m.id === selectedMapId);
    if (!entry) return;
    loadMap(entry.file).then(setCurrentMap).catch(console.error);
  }, [manifest, selectedMapId, importedMaps]);

  const updateView = useCallback(
    (snap: WorldSnapshot) => {
      setSnapshot(snap);

      // Reuse cached terrain array when terrain hasn't changed (breakable count stable).
      // Counting non-empty cells is cheaper than building the full TerrainInstance array.
      let terrainCount = 0;
      for (let z = 0; z < snap.size.z; z++)
        for (let y = 0; y < snap.size.y; y++)
          for (let x = 0; x < snap.size.x; x++)
            if (snap.cells[z]?.[y]?.[x]?.terrain !== 'empty') terrainCount++;

      let terrain = terrainCacheRef.current?.terrain;
      if (!terrain || terrainCount !== terrainCacheRef.current!.count) {
        terrain = buildTerrainModel(snap);
        terrainCacheRef.current = { terrain, count: terrainCount };
      }

      setRenderModel(buildRenderModel(snap, terrain));
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

    // Player gets the first player/generic spawn
    const playerSpawn = currentMap.spawns.find((s) => s.kind === 'player' || s.kind === 'generic');
    const botSpawns = currentMap.spawns.filter(
      (s) => (s.kind === 'bot' || s.kind === 'generic') && s.id !== playerSpawn?.id,
    );

    // Enforce: only as many bots as there are bot spawns
    const activeBots = bots.slice(0, botSpawns.length);

    const spawnAssignments: { spawnId: string; actorId: string; controller: 'player' | 'bot' }[] = [];

    if (playerSpawn) {
      spawnAssignments.push({
        spawnId: playerSpawn.id,
        actorId: `actor_${playerSpawn.id}`,
        controller: 'player',
      });
    }

    // Build behavior lookup for bot actors
    const allBehaviors = [
      ...Object.values(BOT_BEHAVIOR_PRESETS),
      ...customBehaviors,
    ];
    const botBehaviorMap = new Map<string, BotBehavior>();

    for (let i = 0; i < activeBots.length; i++) {
      const spawn = botSpawns[i]!;
      const actorId = `actor_${spawn.id}`;
      spawnAssignments.push({ spawnId: spawn.id, actorId, controller: 'bot' });

      const behavior = allBehaviors.find((b) => b.id === activeBots[i]!.behaviorId)
        ?? allBehaviors[0]!;
      botBehaviorMap.set(actorId, behavior);
    }

    resetSessionCounters();
    const { run } = createSimulationRun({ map: currentMap, config, spawnAssignments });

    const collectors = [];

    if (playerSpawn) {
      const keyboard = new KeyboardIntentCollector(
        `actor_${playerSpawn.id}`,
        keybinds,
      );
      keyboard.attach();
      keyboardRef.current = keyboard;
      collectors.push(keyboard);
    }

    if (activeBots.length > 0) {
      const botActorIds = activeBots.map((_, i) => `actor_${botSpawns[i]!.id}`);
      const bot = new BotIntentCollector(botActorIds, seed, botBehaviorMap);
      collectors.push(bot);
    }

    const composite = new CompositeIntentCollector(collectors);

    const r = new SimulationRunner(run, composite);
    r.start();
    setRunner(r);
    setGameState('playing');
    updateView(run.snapshot);
  }, [currentMap, configOverrides, keybinds, bots, customBehaviors, setGameState, updateView]);

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
    terrainCacheRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (keyboardRef.current) {
      keyboardRef.current.detach();
      keyboardRef.current = null;
    }
  }, [runner, setGameState]);

  const handleStepTick = useCallback(() => {
    if (!runner) return;
    const stepCount = configOverrides.stepSize ?? DEFAULT_MATCH_CONFIG.stepSize ?? 1;
    runner.stepTicks(stepCount);
    updateView(runner.getRun().snapshot);
    if (runner.getRun().status === 'finished') setGameState('results');
  }, [runner, updateView, setGameState, configOverrides]);

  const handleStepBack = useCallback(() => {
    if (!runner) return;
    const stepCount = configOverrides.stepSize ?? DEFAULT_MATCH_CONFIG.stepSize ?? 1;
    runner.stepBack(stepCount);
    updateView(runner.getRun().snapshot);
  }, [runner, updateView, configOverrides]);

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
        // Add to imported maps if not already present
        setImportedMaps((prev) =>
          prev.some((m) => m.id === map.id) ? prev.map((m) => (m.id === map.id ? map : m)) : [...prev, map],
        );
      } catch (e) {
        console.error('Failed to import map:', e);
      }
    };
    input.click();
  }, []);

  const handleKeybindsChange = useCallback((newKeybinds: KeybindConfig) => {
    setKeybinds(newKeybinds);
    // Update live keyboard collector if running
    if (keyboardRef.current) {
      keyboardRef.current.setKeybinds(newKeybinds);
    }
  }, []);

  const handleEditMap = useCallback(() => {
    setGameState('editor');
  }, [setGameState]);

  const handleNewMap = useCallback(() => {
    setCurrentMap(null);
    setGameState('editor');
  }, [setGameState]);

  const handleModifyActor = useCallback(
    (actorId: string, field: string, value: number) => {
      if (!snapshot) return;
      const actor = snapshot.actors[actorId] as Record<string, unknown> | undefined;
      if (!actor) return;
      actor[field] = value;
    },
    [snapshot],
  );

  const handleEditorSave = useCallback(
    (map: MapDefinition) => {
      setCurrentMap(map);
      setSelectedMapId(map.id);
      setGameState('setup');
      downloadAsFile(serializeMap(map), `${map.id}.json`);
      // Add to imported maps so it appears in the selector
      setImportedMaps((prev) =>
        prev.some((m) => m.id === map.id) ? prev.map((m) => (m.id === map.id ? map : m)) : [...prev, map],
      );
    },
    [setGameState],
  );

  const handleEditorClose = useCallback(() => {
    setGameState('setup');
  }, [setGameState]);

  // Auto-step loop when playing — rAF-based with tick batching
  useEffect(() => {
    if (gameState === 'playing' && runner) {
      const BASE_MS_PER_TICK = 50;
      let tickAccumulator = 0;

      const loop = (timestamp: number) => {
        const elapsed = lastFrameRef.current ? timestamp - lastFrameRef.current : 0;
        lastFrameRef.current = timestamp;

        tickAccumulator += elapsed * playbackSpeed;
        const ticksToRun = Math.min(Math.floor(tickAccumulator / BASE_MS_PER_TICK), 10);
        tickAccumulator -= ticksToRun * BASE_MS_PER_TICK;

        for (let i = 0; i < ticksToRun; i++) {
          runner.stepTick();
          if (runner.getRun().status === 'finished') break;
        }

        if (ticksToRun > 0) {
          updateView(runner.getRun().snapshot);
        }

        if (runner.getRun().status === 'finished') {
          setGameState('results');
          if (keyboardRef.current) {
            keyboardRef.current.detach();
            keyboardRef.current = null;
          }
          return;
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      lastFrameRef.current = 0;
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
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
        onStepBack: handleStepBack,
        onRestart: handlePlay,
        onExportMap: handleExportMap,
        onImportMap: handleImportMap,
        onEditMap: handleEditMap,
        onNewMap: handleNewMap,
      }}
      mapSelector={{
        maps: [
          ...(manifest?.maps ?? []),
          ...importedMaps.map((m) => ({ id: m.id, name: `${m.name} (imported)` })),
        ],
        selectedMapId,
        onSelectMap: setSelectedMapId,
      }}
      configOverrides={configOverrides}
      onConfigChange={setConfigOverrides}
      keybinds={keybinds}
      onKeybindsChange={handleKeybindsChange}
      onModifyActor={handleModifyActor}
      agentSetup={{
        bots,
        onBotsChange: setBots,
        behaviors: customBehaviors,
        onBehaviorsChange: setCustomBehaviors,
        currentMap,
      }}
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
            onSelectCell={handleSelectCell}
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
