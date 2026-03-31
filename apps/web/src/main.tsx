/**
 * Web app entry point — mounts the GUI root with embedded R3F render area.
 *
 * Architecture note: The spec calls for separate GUI and R3F roots.
 * In practice, the R3F Canvas is rendered as a child within the GUI layout's
 * center slot. They share a React tree but maintain clean separation:
 * - GUI components consume Zustand stores (UI/session state only)
 * - R3F components consume a RenderModel (derived from WorldSnapshot)
 * - Neither owns simulation state
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { WorldSnapshot, MapDefinition } from '@bomberman65/shared';
import { DEFAULT_MATCH_CONFIG } from '@bomberman65/shared';
import {
  createSimulationRun,
  SimulationRunner,
  KeyboardIntentCollector,
  BotIntentCollector,
  CompositeIntentCollector,
  buildRenderModel,
} from '@bomberman65/game-core';
import type { RenderModel } from '@bomberman65/game-core';
import { SceneRoot } from '@bomberman65/render-r3f';
import { AppShell } from '@bomberman65/ui-react';
import { useSessionStore, useLayoutStore } from '@bomberman65/app-state';

/** Demo 7x7 arena for initial testing. */
const DEMO_MAP: MapDefinition = {
  id: 'demo',
  version: 'v0',
  name: 'Demo Arena',
  size: { x: 7, y: 7, z: 1 },
  cells: [
    [
      [
        { terrain: 'wall' },
        { terrain: 'wall' },
        { terrain: 'wall' },
        { terrain: 'wall' },
        { terrain: 'wall' },
        { terrain: 'wall' },
        { terrain: 'wall' },
      ],
      [
        { terrain: 'wall' },
        { terrain: 'empty' },
        { terrain: 'empty' },
        { terrain: 'breakable', item: { type: 'power', hiddenInBreakable: true, dropChance: 1 } },
        { terrain: 'empty' },
        { terrain: 'empty' },
        { terrain: 'wall' },
      ],
      [
        { terrain: 'wall' },
        { terrain: 'empty' },
        { terrain: 'wall' },
        { terrain: 'empty' },
        { terrain: 'wall' },
        { terrain: 'empty' },
        { terrain: 'wall' },
      ],
      [
        { terrain: 'wall' },
        { terrain: 'breakable' },
        { terrain: 'empty' },
        { terrain: 'empty' },
        { terrain: 'empty' },
        { terrain: 'breakable' },
        { terrain: 'wall' },
      ],
      [
        { terrain: 'wall' },
        { terrain: 'empty' },
        { terrain: 'wall' },
        { terrain: 'empty' },
        { terrain: 'wall' },
        { terrain: 'empty' },
        { terrain: 'wall' },
      ],
      [
        { terrain: 'wall' },
        { terrain: 'empty' },
        { terrain: 'empty' },
        { terrain: 'breakable', item: { type: 'count', hiddenInBreakable: true, dropChance: 1 } },
        { terrain: 'empty' },
        { terrain: 'empty' },
        { terrain: 'wall' },
      ],
      [
        { terrain: 'wall' },
        { terrain: 'wall' },
        { terrain: 'wall' },
        { terrain: 'wall' },
        { terrain: 'wall' },
        { terrain: 'wall' },
        { terrain: 'wall' },
      ],
    ],
  ],
  spawns: [
    { id: 'p1', kind: 'player', cell: { x: 1, y: 1, z: 0 }, facing: 'south' },
    { id: 'b1', kind: 'bot', cell: { x: 5, y: 5, z: 0 }, facing: 'north' },
  ],
};

function App() {
  const [runner, setRunner] = useState<SimulationRunner | null>(null);
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [renderModel, setRenderModel] = useState<RenderModel | null>(null);
  const intervalRef = useRef<number | null>(null);
  const keyboardRef = useRef<KeyboardIntentCollector | null>(null);

  const gameState = useSessionStore((s) => s.gameState);
  const setGameState = useSessionStore((s) => s.setGameState);
  const setCurrentTick = useSessionStore((s) => s.setCurrentTick);
  const playbackSpeed = useSessionStore((s) => s.playbackSpeed);
  const showDebugGrid = useLayoutStore((s) => s.showDebugGrid);
  const showDebugCoords = useLayoutStore((s) => s.showDebugCoordinates);

  const updateView = useCallback(
    (snap: WorldSnapshot) => {
      setSnapshot(snap);
      setRenderModel(buildRenderModel(snap));
      setCurrentTick(snap.tick);
    },
    [setCurrentTick],
  );

  const handlePlay = useCallback(() => {
    // Cleanup previous keyboard listener
    if (keyboardRef.current) keyboardRef.current.detach();

    const seed = Date.now();
    const config = { ...DEFAULT_MATCH_CONFIG, mapId: 'demo', seed } as Parameters<
      typeof createSimulationRun
    >[0]['config'];

    const { run } = createSimulationRun({
      map: DEMO_MAP,
      config,
      spawnAssignments: [
        { spawnId: 'p1', actorId: 'player1', controller: 'player' },
        { spawnId: 'b1', actorId: 'bot1', controller: 'bot' },
      ],
    });

    // Player controls via keyboard
    const keyboard = new KeyboardIntentCollector('player1');
    keyboard.attach();
    keyboardRef.current = keyboard;

    // Bot AI
    const bot = new BotIntentCollector(['bot1'], seed);

    // Combine player + bot intents
    const composite = new CompositeIntentCollector([keyboard, bot]);

    const r = new SimulationRunner(run, composite);
    r.start();
    setRunner(r);
    setGameState('playing');
    updateView(run.snapshot);
  }, [setGameState, updateView]);

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
    setGameState('results');
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (keyboardRef.current) {
      keyboardRef.current.detach();
      keyboardRef.current = null;
    }
  }, [runner, setGameState]);

  const handleStepTick = useCallback(() => {
    if (!runner) return;
    runner.stepTick();
    const run = runner.getRun();
    updateView(run.snapshot);
    if (run.status === 'finished') setGameState('results');
  }, [runner, updateView, setGameState]);

  // Auto-step loop when playing
  useEffect(() => {
    if (gameState === 'playing' && runner) {
      const ms = Math.max(16, Math.floor(50 / playbackSpeed));
      intervalRef.current = window.setInterval(() => {
        runner.stepTick();
        const run = runner.getRun();
        updateView(run.snapshot);
        if (run.status === 'finished') {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (keyboardRef.current) keyboardRef.current.detach();
    };
  }, []);

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
      }}
      renderArea={
        renderModel ? (
          <SceneRoot
            renderModel={renderModel}
            showDebugGrid={showDebugGrid}
            showDebugCoordinates={showDebugCoords}
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
            <div>Press Start to begin</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
              Controls: WASD/Arrows = Move | Space = Bomb | E = Pickup/Pump | Q = Throw | F = Kick
            </div>
          </div>
        )
      }
    />
  );
}

createRoot(document.getElementById('root')!).render(<App />);
