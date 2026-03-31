/**
 * workerStatusStore — Zustand store for worker/batch status summaries.
 */

import { create } from 'zustand';

export type WorkerStatusState = {
  workerActive: boolean;
  workerError: string | null;
  batchJobsQueued: number;
  batchJobsRunning: number;
  batchJobsCompleted: number;
  batchJobsFailed: number;
};

export type WorkerStatusActions = {
  setWorkerActive: (active: boolean) => void;
  setWorkerError: (error: string | null) => void;
  updateBatchCounts: (
    counts: Partial<
      Pick<
        WorkerStatusState,
        'batchJobsQueued' | 'batchJobsRunning' | 'batchJobsCompleted' | 'batchJobsFailed'
      >
    >,
  ) => void;
};

export const useWorkerStatusStore = create<WorkerStatusState & WorkerStatusActions>((set) => ({
  workerActive: false,
  workerError: null,
  batchJobsQueued: 0,
  batchJobsRunning: 0,
  batchJobsCompleted: 0,
  batchJobsFailed: 0,
  setWorkerActive: (workerActive) => set({ workerActive }),
  setWorkerError: (workerError) => set({ workerError }),
  updateBatchCounts: (counts) => set((s) => ({ ...s, ...counts })),
}));
