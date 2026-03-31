/**
 * ReplayController — manages replay playback, seeking, and frame reconstruction.
 *
 * Responsibilities:
 * - Load replay metadata
 * - Seek to tick (using nearest checkpoint)
 * - Reconstruct local playback state
 * - Expose timeline markers
 * - Expose current playback frame to renderer/UI
 */

import type { WorldSnapshot, ActorIntent } from '@bomberman65/shared';
import { deepClone } from '@bomberman65/shared';
import type { ReplayLog, ReplayCheckpoint } from './ReplayRecorder.js';
import { executeTick } from '../run/TickPipeline.js';

export class ReplayController {
  private log: ReplayLog;
  private currentSnapshot: WorldSnapshot;
  private currentTick: number;

  constructor(log: ReplayLog) {
    this.log = log;
    this.currentSnapshot = deepClone(log.initialSnapshot);
    this.currentTick = 0;
  }

  /** Get the replay log metadata. */
  getLog(): ReplayLog {
    return this.log;
  }

  /** Get the current reconstructed snapshot. */
  getSnapshot(): WorldSnapshot {
    return this.currentSnapshot;
  }

  /** Get the current playback tick. */
  getCurrentTick(): number {
    return this.currentTick;
  }

  /** Get total ticks in the replay. */
  getTotalTicks(): number {
    return this.log.entries.length;
  }

  /** Get all checkpoint ticks for timeline markers. */
  getCheckpointTicks(): number[] {
    return this.log.checkpoints.map((c) => c.tick);
  }

  /**
   * Seek to a specific tick.
   * Uses the nearest checkpoint before the target tick and replays forward.
   */
  seekToTick(targetTick: number): void {
    const clampedTick = Math.max(0, Math.min(targetTick, this.log.entries.length));

    // Find nearest checkpoint at or before target
    const checkpoint = this.findNearestCheckpoint(clampedTick);

    if (checkpoint) {
      this.currentSnapshot = deepClone(checkpoint.snapshot);
      this.currentTick = checkpoint.tick;
    } else {
      // No checkpoint — replay from initial state
      this.currentSnapshot = deepClone(this.log.initialSnapshot);
      this.currentTick = 0;
    }

    // Replay forward from checkpoint to target
    while (this.currentTick < clampedTick) {
      const entry = this.log.entries[this.currentTick];
      if (!entry) break;
      executeTick(this.currentSnapshot, entry.intents as ActorIntent[]);
      this.currentTick++;
    }
  }

  /** Step forward by one tick. Returns false if at end. */
  stepForward(): boolean {
    if (this.currentTick >= this.log.entries.length) return false;

    const entry = this.log.entries[this.currentTick];
    if (!entry) return false;

    executeTick(this.currentSnapshot, entry.intents as ActorIntent[]);
    this.currentTick++;
    return true;
  }

  /** Step backward by one tick. Uses seek (reconstructs from checkpoint). */
  stepBackward(): boolean {
    if (this.currentTick <= 0) return false;
    this.seekToTick(this.currentTick - 1);
    return true;
  }

  /** Reset to the beginning. */
  reset(): void {
    this.currentSnapshot = deepClone(this.log.initialSnapshot);
    this.currentTick = 0;
  }

  private findNearestCheckpoint(beforeTick: number): ReplayCheckpoint | null {
    let best: ReplayCheckpoint | null = null;
    for (const cp of this.log.checkpoints) {
      if (cp.tick <= beforeTick) {
        if (!best || cp.tick > best.tick) {
          best = cp;
        }
      }
    }
    return best;
  }
}
