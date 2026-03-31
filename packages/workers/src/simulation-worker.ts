/**
 * simulation-worker — Web Worker entry point for the simulation.
 *
 * One worker implementation path for v0:
 * - Active visible simulation
 * - Headless/batch simulation
 * - Replay playback
 *
 * Receives WorkerCommands via postMessage, emits WorkerEvents back.
 */

import type { WorkerCommand, WorkerEvent } from '@bomberman65/shared';
import { SimulationBridge } from '@bomberman65/game-core';

const bridge = new SimulationBridge((event: WorkerEvent) => {
  self.postMessage(event);
});

self.onmessage = (e: MessageEvent<WorkerCommand>) => {
  bridge.handleCommand(e.data);
};
