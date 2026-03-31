/**
 * sessionStore — Zustand store for session/app-level state.
 * Cross-cutting shell state: current mode, playback speed, loaded replay, worker status.
 */

import { create } from 'zustand';

export type GameState =
  | 'setup'
  | 'playing'
  | 'paused'
  | 'inspection'
  | 'replay'
  | 'batch'
  | 'results';

export type SessionState = {
  gameState: GameState;
  playbackSpeed: number;
  currentTick: number;
  totalTicks: number | null;
  runId: string | null;
  mapId: string | null;
  seed: number | null;
};

export type SessionActions = {
  setGameState: (state: GameState) => void;
  setPlaybackSpeed: (speed: number) => void;
  setCurrentTick: (tick: number) => void;
  setTotalTicks: (total: number | null) => void;
  setRunId: (id: string | null) => void;
  setMapId: (id: string | null) => void;
  setSeed: (seed: number | null) => void;
  reset: () => void;
};

const initialState: SessionState = {
  gameState: 'setup',
  playbackSpeed: 1,
  currentTick: 0,
  totalTicks: null,
  runId: null,
  mapId: null,
  seed: null,
};

export const useSessionStore = create<SessionState & SessionActions>((set) => ({
  ...initialState,
  setGameState: (gameState) => set({ gameState }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setCurrentTick: (currentTick) => set({ currentTick }),
  setTotalTicks: (totalTicks) => set({ totalTicks }),
  setRunId: (runId) => set({ runId }),
  setMapId: (mapId) => set({ mapId }),
  setSeed: (seed) => set({ seed }),
  reset: () => set(initialState),
}));
