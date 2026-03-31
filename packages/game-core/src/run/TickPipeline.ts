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
import { applyBombIntents } from '../rules/bombActions.js';
import { resolveThrownTravel } from '../rules/thrownTravelResolution.js';
import { resolveFallingAndBounds } from '../rules/fallingAndBounds.js';
import { transitionExpiredBombs } from '../rules/explosionPropagation.js';
import { applyBlastEffects, cleanup } from '../rules/blastEffects.js';

/** Execute a single tick on the world snapshot, mutating it in place. */
export function executeTick(snapshot: WorldSnapshot, intents: ActorIntent[]): void {
  // Step 1: Intents are already collected and passed in

  // Step 2: Validate intent preconditions
  const validIntents = validateIntents(snapshot, intents);

  // Step 2b: Apply validated intents (start movement, place bombs, kick, etc.)
  applyMoveIntents(snapshot, validIntents);
  applyBombIntents(snapshot, validIntents);

  // Step 3: Advance timers
  advanceTimers(snapshot);

  // Step 4: Resolve completed phase boundaries
  resolveSurfaceTravelPhases(snapshot);
  resolveThrownTravel(snapshot);

  // Step 4b: Falling and out-of-bounds
  resolveFallingAndBounds(snapshot);

  // Step 5: Transition bombs with zero fuse to exploding
  transitionExpiredBombs(snapshot);

  // Steps 6-7: Apply blast effects (breakable destruction, elimination, chain detonation)
  // Note: affectedCells are computed during detonation in step 5
  applyBlastEffects(snapshot);

  // Step 8: Cleanup
  cleanup(snapshot);

  // Advance tick counter
  (snapshot as { tick: number }).tick += 1;
}
