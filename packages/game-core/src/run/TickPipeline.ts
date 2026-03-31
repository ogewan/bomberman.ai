/**
 * TickPipeline — the authoritative tick update pipeline.
 *
 * From the Architecture Spec, each tick runs these steps:
 *   1. Collect actor intents (passed in from outside)
 *   2. Validate intent preconditions
 *   3. Advance timers by 1 tick
 *   4. Resolve completed phase boundaries
 *   5. Transition bombs whose fuse reached zero into exploding
 *   6. Recompute affectedCells for all exploding bombs
 *   7. Apply blast effects
 *   8. Cleanup
 */

import type { ActorIntent, WorldSnapshot } from '@bomberman65/shared';
import { validateIntents } from '../rules/intentValidation.js';
import { advanceTimers } from '../rules/timerAdvancement.js';
import { applyMoveIntents, resolveSurfaceTravelPhases } from '../rules/movementResolution.js';
import { resolveThrownTravel } from '../rules/thrownTravelResolution.js';
import { resolveFallingAndBounds } from '../rules/fallingAndBounds.js';

/** Execute a single tick on the world snapshot, mutating it in place. */
export function executeTick(snapshot: WorldSnapshot, intents: ActorIntent[]): void {
  // Step 1: Intents are already collected and passed in

  // Step 2: Validate intent preconditions
  const validIntents = validateIntents(snapshot, intents);

  // Step 2b: Apply validated move intents (start surface travel)
  applyMoveIntents(snapshot, validIntents);

  // Step 3: Advance timers
  advanceTimers(snapshot);

  // Step 4: Resolve completed phase boundaries
  resolveSurfaceTravelPhases(snapshot);
  resolveThrownTravel(snapshot);

  // Step 4b: Falling and out-of-bounds
  resolveFallingAndBounds(snapshot);

  // Step 5: Transition bombs with zero fuse to exploding (Phase 5)
  transitionExpiredBombs(snapshot);

  // Step 6: Recompute affected cells for exploding bombs (Phase 5)
  recomputeExplosionCells(snapshot);

  // Step 7: Apply blast effects (Phase 5)
  applyBlastEffects(snapshot);

  // Step 8: Cleanup (Phase 5)
  cleanup(snapshot);

  // Advance tick counter
  (snapshot as { tick: number }).tick += 1;
}

// --- Stub implementations for Phase 5 ---

function transitionExpiredBombs(_snapshot: WorldSnapshot): void {
  // Phase 5: bombs with fuseTicksRemaining === 0 → exploding
}

function recomputeExplosionCells(_snapshot: WorldSnapshot): void {
  // Phase 5: regular square propagation, pumped cube propagation
}

function applyBlastEffects(_snapshot: WorldSnapshot): void {
  // Phase 5: stun/elimination, shield consume, breakable destruction, chain detonation
}

function cleanup(_snapshot: WorldSnapshot): void {
  // Phase 5: remove expired explosions, removed bombs, finalize eliminated actors
}
