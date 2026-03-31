/** @module @bomberman65/workers — Simulation worker, message contracts, and worker runner. */

export { WorkerRunManager, type WorkerEventListener } from './WorkerRunManager.js';

// Note: simulation-worker.ts is a Web Worker entry point, not a library export.
// It is loaded via `new Worker(new URL('./simulation-worker.ts', import.meta.url))`.
