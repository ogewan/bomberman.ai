/**
 * Platform Demo — end-to-end demonstration of the Emulator ML Platform.
 *
 * Runs a RandomAgent on the Bomberman 26 environment through the
 * ExperimentRunner, displaying live metrics, episode rewards, and
 * session data. Proves the full platform pipeline works:
 *
 *   Agent → GameEnvironment → ExperimentSession → Metrics
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { MapDefinition } from '@bomberman65/shared';
import { deserializeMap } from '@bomberman65/game-core';

import { Bomberman26Environment, type B26EnvConfig } from '@bomberman65/env-bomberman26';
import {
  ExperimentRunner,
  RandomAgent,
  type ExperimentSession,
  type Observation,
} from '@bomberman65/platform-core';

// --- Types ---

type DemoState = 'idle' | 'running' | 'completed';

type LiveMetrics = {
  currentStep: number;
  currentEpisode: number;
  currentEpisodeReward: number;
  episodeRewards: number[];
  episodeLengths: number[];
  stepsPerSecond: number;
};

// --- Demo App ---

function PlatformDemo() {
  const [demoState, setDemoState] = useState<DemoState>('idle');
  const [maps, setMaps] = useState<{ id: string; name: string }[]>([]);
  const [selectedMap, setSelectedMap] = useState('training');
  const [episodes, setEpisodes] = useState(10);
  const [maxSteps, setMaxSteps] = useState(500);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    currentStep: 0,
    currentEpisode: 0,
    currentEpisodeReward: 0,
    episodeRewards: [],
    episodeLengths: [],
    stepsPerSecond: 0,
  });
  const [session, setSession] = useState<ExperimentSession | null>(null);
  const runnerRef = useRef<ExperimentRunner | null>(null);
  const stepCounterRef = useRef(0);
  const lastMetricsUpdateRef = useRef(0);
  const episodeRewardRef = useRef(0);

  // Load map list
  useEffect(() => {
    fetch('/content/manifest.json')
      .then((r) => r.json())
      .then((m: { maps: { id: string; name: string }[] }) => setMaps(m.maps))
      .catch(console.error);
  }, []);

  const handleStart = useCallback(async () => {
    setDemoState('running');
    setMetrics({
      currentStep: 0,
      currentEpisode: 0,
      currentEpisodeReward: 0,
      episodeRewards: [],
      episodeLengths: [],
      stepsPerSecond: 0,
    });
    stepCounterRef.current = 0;
    lastMetricsUpdateRef.current = Date.now();
    episodeRewardRef.current = 0;

    // Load map
    const res = await fetch(`/content/maps/${selectedMap}.json`);
    const mapJson = await res.text();
    const map: MapDefinition = deserializeMap(mapJson);

    // Create environment
    const env = new Bomberman26Environment();
    const envConfig: B26EnvConfig = {
      map,
      spawnAssignments: map.spawns.map((s) => ({
        spawnId: s.id,
        actorId: `actor_${s.id}`,
        controller: 'bot' as const,
      })),
      agentActorId: `actor_${map.spawns[0]!.id}`,
    };

    await env.init({
      envType: 'bomberman26',
      envConfig: envConfig as unknown as Record<string, unknown>,
      seed: Date.now(),
      maxSteps,
    });

    // Create agent
    const agent = new RandomAgent('demo_random', 'Random Agent (Demo)');

    // Create runner with callbacks
    const runner = new ExperimentRunner(
      env,
      agent,
      {
        episodes,
        maxStepsPerEpisode: maxSteps,
        checkpointInterval: 100,
      },
      {
        onStep: (step: number, _obs: Observation, reward: number) => {
          stepCounterRef.current++;
          episodeRewardRef.current += reward;

          // Throttle UI updates to every 100ms
          const now = Date.now();
          if (now - lastMetricsUpdateRef.current > 100) {
            const elapsed = (now - lastMetricsUpdateRef.current) / 1000;
            const sps = stepCounterRef.current / elapsed;
            stepCounterRef.current = 0;
            lastMetricsUpdateRef.current = now;

            setMetrics((prev) => ({
              ...prev,
              currentStep: step,
              currentEpisodeReward: episodeRewardRef.current,
              stepsPerSecond: Math.round(sps),
            }));
          }
        },
        onEpisodeStart: (episode: number) => {
          episodeRewardRef.current = 0;
          setMetrics((prev) => ({
            ...prev,
            currentEpisode: episode,
            currentEpisodeReward: 0,
          }));
        },
        onEpisodeEnd: (_episode: number, totalSteps: number, totalReward: number) => {
          setMetrics((prev) => ({
            ...prev,
            episodeRewards: [...prev.episodeRewards, totalReward],
            episodeLengths: [...prev.episodeLengths, totalSteps],
          }));
        },
        onRunComplete: () => {
          setDemoState('completed');
        },
        onError: (error: Error) => {
          console.error('Experiment error:', error);
          setDemoState('completed');
        },
      },
    );

    runnerRef.current = runner;

    // Run asynchronously
    const completedSession = await runner.run();
    setSession(completedSession);
    env.dispose();
  }, [selectedMap, episodes, maxSteps]);

  const handleStop = useCallback(() => {
    runnerRef.current?.stop();
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4, color: '#64b5f6' }}>
        Emulator ML Platform — Demo
      </h1>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 13 }}>
        Runs a RandomAgent on Bomberman 26 via GameEnvironment + ExperimentRunner
      </p>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Map
          <select
            value={selectedMap}
            onChange={(e) => setSelectedMap(e.target.value)}
            disabled={demoState === 'running'}
            style={{ padding: '4px 8px', background: '#2a2a4a', color: '#e0e0e0', border: '1px solid #444' }}
          >
            {maps.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Episodes
          <input
            type="number"
            value={episodes}
            onChange={(e) => setEpisodes(parseInt(e.target.value, 10) || 1)}
            disabled={demoState === 'running'}
            min={1}
            max={1000}
            style={{ width: 80, padding: '4px 8px', background: '#2a2a4a', color: '#e0e0e0', border: '1px solid #444' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Max Steps/Episode
          <input
            type="number"
            value={maxSteps}
            onChange={(e) => setMaxSteps(parseInt(e.target.value, 10) || 100)}
            disabled={demoState === 'running'}
            min={10}
            max={10000}
            style={{ width: 100, padding: '4px 8px', background: '#2a2a4a', color: '#e0e0e0', border: '1px solid #444' }}
          />
        </label>

        {demoState !== 'running' ? (
          <button
            onClick={handleStart}
            style={{
              padding: '6px 20px',
              background: '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {demoState === 'completed' ? 'Run Again' : 'Run Experiment'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            style={{
              padding: '6px 20px',
              background: '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Stop
          </button>
        )}
      </div>

      {/* Live Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <MetricCard label="Episode" value={`${metrics.currentEpisode + 1} / ${episodes}`} />
        <MetricCard label="Step" value={metrics.currentStep.toLocaleString()} />
        <MetricCard label="Steps/sec" value={metrics.stepsPerSecond.toLocaleString()} />
        <MetricCard label="Episode Reward" value={metrics.currentEpisodeReward.toFixed(2)} />
      </div>

      {/* Episode History */}
      {metrics.episodeRewards.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8, color: '#aaa' }}>Episode Results</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {metrics.episodeRewards.map((reward, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  background: '#2a2a4a',
                  borderRadius: 4,
                  fontSize: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Episode {i + 1}</span>
                <span>
                  R={reward.toFixed(2)} | {metrics.episodeLengths[i]} steps
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Summary */}
      {session && demoState === 'completed' && (
        <div style={{ padding: 16, background: '#1e3a5f', borderRadius: 8, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12, color: '#64b5f6' }}>Session Summary</h3>
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            <div>Session ID: {session.id}</div>
            <div>Status: {session.status}</div>
            <div>Total Steps: {session.totalSteps.toLocaleString()}</div>
            <div>Episodes: {session.getEpisodes().length}</div>
            <div>Checkpoints: {session.getCheckpoints().length}</div>
            <div>
              Avg Reward:{' '}
              {session.getEpisodes().length > 0
                ? (
                    session.getEpisodes().reduce((s, e) => s + e.totalReward, 0) /
                    session.getEpisodes().length
                  ).toFixed(3)
                : 'N/A'}
            </div>
            <div>
              Avg Episode Length:{' '}
              {session.getEpisodes().length > 0
                ? Math.round(
                    session.getEpisodes().reduce((s, e) => s + e.totalSteps, 0) /
                    session.getEpisodes().length,
                  )
                : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Architecture Info */}
      <div style={{ padding: 16, background: '#222240', borderRadius: 8, fontSize: 11, color: '#777', lineHeight: 1.6 }}>
        <strong style={{ color: '#999' }}>Platform Pipeline:</strong>{' '}
        RandomAgent → Bomberman26Environment (GameEnvironment) → ExperimentRunner → ExperimentSession
        <br />
        <strong style={{ color: '#999' }}>What this proves:</strong>{' '}
        Agent selects actions, environment steps via adapter, session records all steps/checkpoints/metrics.
        Swap RandomAgent for InferenceAgent (TF.js) or swap env for N64WasmEnvironment — same pipeline.
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 16px', background: '#2a2a4a', borderRadius: 6, textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#e0e0e0' }}>{value}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<PlatformDemo />);
