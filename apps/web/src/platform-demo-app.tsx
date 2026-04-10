/**
 * Platform Demo — browser-visible experiment runner for the Emulator ML Platform.
 *
 * Supports both a random baseline and a TF.js-backed inference path that loads
 * a checked-in model manifest. This closes the Phase C demo gap while keeping
 * the same ExperimentRunner pipeline used by later training/evaluation flows.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { MapDefinition } from '@bomberman65/shared';
import { deserializeMap } from '@bomberman65/game-core';
import {
  InferenceAgent,
  type ModelManifest,
} from '@bomberman65/ml-inference';

import { Bomberman26Environment, type B26EnvConfig } from '@bomberman65/env-bomberman26';
import {
  ExperimentRunner,
  RandomAgent,
  type Agent,
  type ExperimentSession,
  type Observation,
} from '@bomberman65/platform-core';
import {
  loadModelManifest,
  loadModelManifestIndex,
  type ModelManifestEntry,
} from './modelManifestLoader.js';

type DemoState = 'idle' | 'running' | 'completed';
type AgentMode = 'random' | 'inference';

type LiveMetrics = {
  currentStep: number;
  currentEpisode: number;
  currentEpisodeReward: number;
  episodeRewards: number[];
  episodeLengths: number[];
  stepsPerSecond: number;
};

function PlatformDemoApp() {
  const [demoState, setDemoState] = useState<DemoState>('idle');
  const [maps, setMaps] = useState<{ id: string; name: string }[]>([]);
  const [models, setModels] = useState<ModelManifestEntry[]>([]);
  const [selectedMap, setSelectedMap] = useState('training');
  const [agentMode, setAgentMode] = useState<AgentMode>('inference');
  const [selectedModelId, setSelectedModelId] = useState('b26-demo-pass-through-v1');
  const [loadedModelManifest, setLoadedModelManifest] = useState<ModelManifest | null>(null);
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

  useEffect(() => {
    fetch('/content/manifest.json')
      .then((r) => r.json())
      .then((m: { maps: { id: string; name: string }[] }) => setMaps(m.maps))
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadModelManifestIndex()
      .then((manifestIndex) => setModels(manifestIndex.models))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const entry = models.find((model) => model.id === selectedModelId);
    if (!entry) return;

    loadModelManifest(entry.file)
      .then(setLoadedModelManifest)
      .catch(console.error);
  }, [models, selectedModelId]);

  const handleStart = useCallback(async () => {
    setDemoState('running');
    setSession(null);
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

    const res = await fetch(`/content/maps/${selectedMap}.json`);
    const mapJson = await res.text();
    const map: MapDefinition = deserializeMap(mapJson);

    const env = new Bomberman26Environment();
    const envConfig: B26EnvConfig = {
      map,
      spawnAssignments: map.spawns.map((spawn) => ({
        spawnId: spawn.id,
        actorId: `actor_${spawn.id}`,
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

    let agent: Agent;
    if (agentMode === 'inference') {
      if (!loadedModelManifest) {
        throw new Error('Selected model manifest is not loaded yet.');
      }

      agent = new InferenceAgent({
        name: loadedModelManifest.name,
        modelPath: loadedModelManifest.modelPath,
        builtinModelId: loadedModelManifest.builtinModelId,
        outputMode: loadedModelManifest.outputMode,
        actionSelection: loadedModelManifest.actionSelection,
        epsilon: loadedModelManifest.epsilon,
        observationPipeline: loadedModelManifest.observationPipeline,
        stateProjection: loadedModelManifest.stateProjection,
      });
    } else {
      agent = new RandomAgent('demo_random', 'Random Agent (Demo)');
    }

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

    try {
      const completedSession = await runner.run();
      setSession(completedSession);
    } finally {
      agent.dispose?.();
      env.dispose();
    }
  }, [selectedMap, episodes, maxSteps, agentMode, loadedModelManifest]);

  const handleStop = useCallback(() => {
    runnerRef.current?.stop();
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4, color: '#64b5f6' }}>
        Emulator ML Platform - Demo
      </h1>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 13 }}>
        Runs Bomberman 26 through the shared GameEnvironment and ExperimentRunner pipeline, including a browser TF.js inference path.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Map
          <select
            value={selectedMap}
            onChange={(e) => setSelectedMap(e.target.value)}
            disabled={demoState === 'running'}
            style={{ padding: '4px 8px', background: '#2a2a4a', color: '#e0e0e0', border: '1px solid #444' }}
          >
            {maps.map((map) => (
              <option key={map.id} value={map.id}>{map.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Agent Mode
          <select
            value={agentMode}
            onChange={(e) => setAgentMode(e.target.value as AgentMode)}
            disabled={demoState === 'running'}
            style={{ padding: '4px 8px', background: '#2a2a4a', color: '#e0e0e0', border: '1px solid #444' }}
          >
            <option value="inference">InferenceAgent</option>
            <option value="random">RandomAgent</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Model
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            disabled={demoState === 'running' || agentMode !== 'inference'}
            style={{ minWidth: 220, padding: '4px 8px', background: '#2a2a4a', color: '#e0e0e0', border: '1px solid #444' }}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Episodes
          <input
            type="number"
            value={episodes}
            onChange={(e) => setEpisodes(Number.parseInt(e.target.value, 10) || 1)}
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
            onChange={(e) => setMaxSteps(Number.parseInt(e.target.value, 10) || 100)}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12, marginBottom: 24 }}>
        <MetricCard label="Agent" value={agentMode === 'inference' ? 'Inference' : 'Random'} />
        <MetricCard label="Model" value={agentMode === 'inference' ? (loadedModelManifest?.id ?? 'loading') : 'n/a'} />
        <MetricCard label="Episode" value={`${metrics.currentEpisode + 1} / ${episodes}`} />
        <MetricCard label="Step" value={metrics.currentStep.toLocaleString()} />
        <MetricCard label="Steps/sec" value={metrics.stepsPerSecond.toLocaleString()} />
        <MetricCard label="Episode Reward" value={metrics.currentEpisodeReward.toFixed(2)} />
      </div>

      {loadedModelManifest && agentMode === 'inference' && (
        <div style={{ padding: 16, background: '#222240', borderRadius: 8, marginBottom: 24, fontSize: 12, lineHeight: 1.7 }}>
          <div><strong style={{ color: '#999' }}>Loaded Model:</strong> {loadedModelManifest.name}</div>
          <div><strong style={{ color: '#999' }}>Manifest ID:</strong> {loadedModelManifest.id}</div>
          <div><strong style={{ color: '#999' }}>Observation Mode:</strong> {loadedModelManifest.observationMode}</div>
          <div><strong style={{ color: '#999' }}>State Projection:</strong> {loadedModelManifest.stateProjection?.path ?? 'n/a'}</div>
        </div>
      )}

      {metrics.episodeRewards.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8, color: '#aaa' }}>Episode Results</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {metrics.episodeRewards.map((reward, index) => (
              <div
                key={index}
                style={{
                  padding: '8px 12px',
                  background: '#2a2a4a',
                  borderRadius: 4,
                  fontSize: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Episode {index + 1}</span>
                <span>
                  R={reward.toFixed(2)} | {metrics.episodeLengths[index]} steps
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {session && demoState === 'completed' && (
        <div style={{ padding: 16, background: '#1e3a5f', borderRadius: 8, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12, color: '#64b5f6' }}>Session Summary</h3>
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            <div>Agent Mode: {agentMode}</div>
            <div>Model: {agentMode === 'inference' ? (loadedModelManifest?.name ?? 'Unknown') : 'Random baseline'}</div>
            <div>Session ID: {session.id}</div>
            <div>Status: {session.status}</div>
            <div>Total Steps: {session.totalSteps.toLocaleString()}</div>
            <div>Episodes: {session.getEpisodes().length}</div>
            <div>Checkpoints: {session.getCheckpoints().length}</div>
            <div>
              Avg Reward:{' '}
              {session.getEpisodes().length > 0
                ? (
                    session.getEpisodes().reduce((sum, episode) => sum + episode.totalReward, 0) /
                    session.getEpisodes().length
                  ).toFixed(3)
                : 'N/A'}
            </div>
            <div>
              Avg Episode Length:{' '}
              {session.getEpisodes().length > 0
                ? Math.round(
                    session.getEpisodes().reduce((sum, episode) => sum + episode.totalSteps, 0) /
                    session.getEpisodes().length,
                  )
                : 'N/A'}
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: 16, background: '#222240', borderRadius: 8, fontSize: 11, color: '#777', lineHeight: 1.6 }}>
        <strong style={{ color: '#999' }}>Platform Pipeline:</strong>{' '}
        {agentMode === 'inference' ? 'InferenceAgent' : 'RandomAgent'} {'->'} Bomberman26Environment (GameEnvironment) {'->'} ExperimentRunner {'->'} ExperimentSession
        <br />
        <strong style={{ color: '#999' }}>What this proves:</strong>{' '}
        The browser demo can load a checked-in model manifest, run TF.js inference over a stable structured-state projection, and record metrics/checkpoints through the same platform runner used for later training workflows.
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

createRoot(document.getElementById('root')!).render(<PlatformDemoApp />);
