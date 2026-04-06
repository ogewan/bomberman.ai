/**
 * BotIntentCollector — rule-based AI for NPC actors, driven by BotBehavior
 * config.
 *
 * Behavior priorities (weighted by BotBehavior):
 * 1. Flee danger zones (fleeWeight)
 * 2. Chase nearby actors (chaseWeight)
 * 3. Place bombs near breakables (bombWeight)
 * 4. Pursue items on the ground (itemWeight)
 * 5. Roam / explore (roamWeight)
 *
 * Danger awareness: predicts blast radii of all non-removed bombs.
 */

import type {ActorIntent, ActorState, BombState, WorldSnapshot, Direction2D, Vec3i, BotBehavior,} from '@bomberman65/shared';
import {CARDINAL_DIRECTIONS, DIRECTION_TO_VECTOR, OPPOSITE_DIRECTION, createDefaultBehavior} from '@bomberman65/shared';
import type {IntentCollector} from './IntentCollector.js';
import {SeededRng} from '@bomberman65/shared';

export class BotIntentCollector implements IntentCollector {
  private actorIds: string[];
  private rng: SeededRng;
  private behaviors: Map<string, BotBehavior>;

  /** Tracks last logged intent key per actor for duplicate suppression. */
  private lastLogKey: Map<string, string> = new Map();
  private lastLogCount: Map<string, number> = new Map();
  private static readonly LOG_SUPPRESS_AFTER = 5;

  /** Last move direction per actor (for direction bias and reversal cooldown). */
  private lastMoveDir: Map<string, Direction2D> = new Map();
  /** Remaining reversal cooldown ticks per actor. */
  private reversalCooldownTicks: Map<string, number> = new Map();

  constructor(
      actorIds: string[],
      seed: number = 12345,
      behaviors?: Map<string, BotBehavior>,
  ) {
    this.actorIds = actorIds;
    this.rng = new SeededRng(seed);
    this.behaviors = behaviors ?? new Map();
  }

  collectIntents(snapshot: WorldSnapshot): ActorIntent[] {
    const intents: ActorIntent[] = [];
    const dangerCells = this.buildDangerZone(snapshot);
    const activeExplosions = this.buildActiveExplosionCells(snapshot);

    // Decrement reversal cooldowns each tick
    for (const actorId of this.actorIds) {
      const remaining = this.reversalCooldownTicks.get(actorId) ?? 0;
      if (remaining > 0) this.reversalCooldownTicks.set(actorId, remaining - 1);
    }

    for (const actorId of this.actorIds) {
      const actor = snapshot.actors[actorId] as ActorState | undefined;
      if (!actor || actor.state.kind === 'eliminated') {
        intents.push({kind: 'idle', actorId});
        continue;
      }

      if (actor.state.kind !== 'idle' || actor.stunTicksRemaining > 0) {
        intents.push({kind: 'idle', actorId});
        continue;
      }

      const behavior = this.behaviors.get(actorId) ?? createDefaultBehavior();
      const intent = this.decideIntent(snapshot, actor, dangerCells, activeExplosions, behavior);
      if (intent.kind === 'move') {
        this.lastMoveDir.set(actorId, intent.direction);
        this.reversalCooldownTicks.set(actorId, behavior.reversalCooldown);
      }
      intents.push(intent);
    }

    return intents;
  }

  private decideIntent(
      snapshot: WorldSnapshot,
      actor: ActorState,
      dangerCells: Set<string>,
      activeExplosions: Set<string>,
      behavior: BotBehavior,
      ): ActorIntent {
    const {cell} = actor;
    const posKey = cellKey(cell);
    const inDanger = dangerCells.has(posKey);

    // 1. Flee danger (weighted)
    if (inDanger && behavior.fleeWeight > 0) {
      const threshold = this.rng.next();
      if (threshold < behavior.fleeWeight) {
        const safeDirs =
            this.findSafeWalkableDirections(snapshot, cell, dangerCells);
        if (safeDirs.length > 0) {
          const dir = safeDirs[Math.floor(this.rng.next() * safeDirs.length)]!;
          this.logIntent(actor.id, 'flee-safe', dir, {
            fleeWeight: behavior.fleeWeight,
            roll: threshold,
            inDanger,
            safeOptions: safeDirs.length,
          });
          return {kind: 'move', actorId: actor.id, direction: dir};
        }
        // Desperate: allow predicted-danger cells but never active explosions
        const anyDirs = this.findWalkableDirections(snapshot, cell, activeExplosions);
        if (anyDirs.length > 0) {
          const dir = anyDirs[Math.floor(this.rng.next() * anyDirs.length)]!;
          this.logIntent(actor.id, 'flee-desperate', dir, {
            fleeWeight: behavior.fleeWeight,
            roll: threshold,
            inDanger,
            noSafeDirs: true,
            anyOptions: anyDirs.length,
          });
          return {kind: 'move', actorId: actor.id, direction: dir};
        }
        this.logIntent(actor.id, 'flee-trapped', null, {
          fleeWeight: behavior.fleeWeight,
          roll: threshold,
          inDanger,
          noEscape: true,
        });
        return {kind: 'idle', actorId: actor.id};
      }
      // Bot ignored danger — roll exceeded weight
      this.logIntent(actor.id, 'ignore-danger', null, {
        fleeWeight: behavior.fleeWeight,
        roll: threshold,
        inDanger,
        ignored: true,
      });
    }

    let chaseDir;
    if (behavior.chaseWeight > 0 || behavior.bombWeight > 0) {
      chaseDir = this.findDirectionTowardActor(
          snapshot, actor, dangerCells, behavior.chaseScanRange);
    }
    // 2. Chase actors (weighted)
    if (behavior.chaseWeight > 0) {
      const chaseRoll = this.rng.next();
      if (chaseRoll < behavior.chaseWeight) {
        if (chaseDir?.dir && chaseDir.dist > 0) {
          // Aggressive bots can run near predicted danger, but never into an active explosion
          const chaseTarget = this.dirTarget(cell, chaseDir.dir);
          if (!activeExplosions.has(cellKey(chaseTarget))) {
            this.logIntent(actor.id, 'chase', chaseDir.dir, {
              chaseWeight: behavior.chaseWeight,
              roll: chaseRoll,
              chaseScanRange: behavior.chaseScanRange,
            });
            return {kind: 'move', actorId: actor.id, direction: chaseDir.dir};
          }
          this.logIntent(actor.id, 'chase-blocked-explosion', chaseDir.dir, {
            chaseWeight: behavior.chaseWeight,
            roll: chaseRoll,
          });
        }
      }
    }

    // 3. Place bomb near entities/breakables (weighted)
    if (behavior.bombWeight > 0) {
      const breakableDir = this.findAdjacentBreakable(snapshot, cell);
      if ((chaseDir!.dist <= 1 || breakableDir) &&
          !this.isOnBomb(snapshot, actor)) {
        const bombRoll = this.rng.next();
        if (bombRoll < behavior.bombWeight) {
          const ownBombs =
              Object.values(snapshot.bombs)
                  .filter(
                      (b) => (b as BombState).ownerActorId === actor.id &&
                          (b as BombState).state.kind !== 'removed',
                      )
                  .length;
          if (ownBombs < actor.count) {
            const escapeAfterBomb =
                this.findSafeWalkableDirections(snapshot, cell, dangerCells);
            if (escapeAfterBomb.length > 0) {
              this.logIntent(actor.id, 'placeBomb', breakableDir, {
                bombWeight: behavior.bombWeight,
                roll: bombRoll,
                breakableDir,
                ownBombs,
                maxBombs: actor.count,
                escapeRoutes: escapeAfterBomb.length,
              });
              return {kind: 'placeBomb', actorId: actor.id};
            }
          }
        }
      }
    }

    // Standing on own bomb — flee immediately
    if (this.isOnBomb(snapshot, actor)) {
      const safeDirs =
          this.findSafeWalkableDirections(snapshot, cell, dangerCells);
      if (safeDirs.length > 0) {
        const dir = safeDirs[Math.floor(this.rng.next() * safeDirs.length)]!;
        this.logIntent(actor.id, 'flee-own-bomb', dir, {
          safeOptions: safeDirs.length,
        });
        return {kind: 'move', actorId: actor.id, direction: dir};
      }
    }

    // 4. Pursue items (weighted)
    if (behavior.itemWeight > 0) {
      const itemRoll = this.rng.next();
      if (itemRoll < behavior.itemWeight) {
        const itemDir = this.findDirectionTowardItem(
            snapshot, cell, dangerCells, behavior.scanRange);
        if (itemDir) {
          this.logIntent(actor.id, 'pursue-item', itemDir, {
            itemWeight: behavior.itemWeight,
            roll: itemRoll,
            scanRange: behavior.scanRange,
          });
          return {kind: 'move', actorId: actor.id, direction: itemDir};
        }
      }
    }

    // 5. Roam (weighted)
    if (behavior.roamWeight > 0) {
      const safeDirs =
          this.findSafeWalkableDirections(snapshot, cell, dangerCells);
      const roamRoll = this.rng.next();
      if (safeDirs.length > 0 && roamRoll < behavior.roamWeight) {
        const dir = this.pickRoamDirection(
            snapshot, actor, safeDirs, dangerCells, behavior);
        const label = this.lastRoamLabel;
        this.logIntent(actor.id, label, dir, {
          roamWeight: behavior.roamWeight,
          roll: roamRoll,
          roamAggression: behavior.roamAggression,
          roamDirectionBias: behavior.roamDirectionBias,
          inDanger,
          safeOptions: safeDirs.length,
        });
        return {kind: 'move', actorId: actor.id, direction: dir};
      }
    }

    this.logIntent(actor.id, 'idle-fallthrough', null, {inDanger});
    return {kind: 'idle', actorId: actor.id};
  }

  /** Label from the most recent pickRoamDirection call (avoids returning tuples). */
  private lastRoamLabel = 'roam';

  /**
   * Pick a roam direction considering: reversal cooldown, direction bias,
   * enemy aggression slider, and breakable preference.
   */
  private pickRoamDirection(
      snapshot: WorldSnapshot,
      actor: ActorState,
      safeDirs: Direction2D[],
      _dangerCells: Set<string>,
      behavior: BotBehavior,
      ): Direction2D {
    const {cell} = actor;
    let candidates = safeDirs;

    // --- Reversal cooldown: exclude opposite of last direction ---
    const lastDir = this.lastMoveDir.get(actor.id);
    const cooldownActive = (this.reversalCooldownTicks.get(actor.id) ?? 0) > 0;
    if (lastDir && cooldownActive && candidates.length > 1) {
      const opposite = OPPOSITE_DIRECTION[lastDir];
      const filtered = candidates.filter((d) => d !== opposite);
      if (filtered.length > 0) candidates = filtered;
    }

    // --- Direction bias: prefer continuing last direction ---
    if (lastDir && candidates.includes(lastDir) && this.rng.next() < behavior.roamDirectionBias) {
      this.lastRoamLabel = 'roam-continue';
      return lastDir;
    }

    // --- Enemy awareness via roamAggression ---
    const towardEnemy: Direction2D[] = [];
    const awayFromEnemy: Direction2D[] = [];
    for (const d of candidates) {
      if (this.dirHasEnemyInRange(snapshot, actor, d, behavior.scanRange)) {
        towardEnemy.push(d);
      } else {
        awayFromEnemy.push(d);
      }
    }

    const aggressionRoll = this.rng.next();
    let enemyFiltered: Direction2D[] | null = null;
    if (aggressionRoll < behavior.roamAggression && towardEnemy.length > 0) {
      enemyFiltered = towardEnemy;
      this.lastRoamLabel = 'roam-toward-enemy';
    } else if (aggressionRoll >= (1 - behavior.roamAggression) && awayFromEnemy.length > 0) {
      enemyFiltered = awayFromEnemy;
      this.lastRoamLabel = 'roam-away-enemy';
    }

    const pool = enemyFiltered ?? candidates;

    // --- Breakable preference within chosen pool ---
    const towardBreakable = pool.filter((d) => {
      const vec = DIRECTION_TO_VECTOR[d];
      for (let dist = 1; dist <= behavior.scanRange; dist++) {
        const check: Vec3i = {
          x: cell.x + vec.dx * dist,
          y: cell.y + vec.dy * dist,
          z: cell.z,
        };
        const c = snapshot.cells[check.z]?.[check.y]?.[check.x];
        if (c?.terrain === 'breakable') return true;
        if (c?.terrain === 'wall') break;
      }
      return false;
    });

    if (towardBreakable.length > 0) {
      if (!enemyFiltered) this.lastRoamLabel = 'roam-toward-breakable';
      return towardBreakable[Math.floor(this.rng.next() * towardBreakable.length)]!;
    }

    if (!enemyFiltered) this.lastRoamLabel = 'roam';
    return pool[Math.floor(this.rng.next() * pool.length)]!;
  }

  /** Check if a direction from the actor's cell has a non-eliminated enemy within range. */
  private dirHasEnemyInRange(
      snapshot: WorldSnapshot,
      actor: ActorState,
      dir: Direction2D,
      scanRange: number,
      ): boolean {
    const vec = DIRECTION_TO_VECTOR[dir];
    for (let dist = 1; dist <= scanRange; dist++) {
      const check: Vec3i = {
        x: actor.cell.x + vec.dx * dist,
        y: actor.cell.y + vec.dy * dist,
        z: actor.cell.z,
      };
      const c = snapshot.cells[check.z]?.[check.y]?.[check.x];
      if (!c) break;
      if (c.terrain === 'wall' || c.terrain === 'breakable') break;
      if (c.occupant) {
        const occ = snapshot.actors[c.occupant.id];
        if (occ && occ.id !== actor.id && occ.state.kind !== 'eliminated') {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Log a bot intent decision. Suppresses duplicate logs after 5 consecutive
   * identical decisions per actor.
   */
  private logIntent(
      actorId: string,
      decision: string,
      direction: string|null,
      scores: Record<string, unknown>,
      ): void {
    const logKey = `${decision}|${direction ?? 'none'}`;
    const prev = this.lastLogKey.get(actorId);
    const count =
        prev === logKey ? (this.lastLogCount.get(actorId) ?? 0) + 1 : 1;

    this.lastLogKey.set(actorId, logKey);
    this.lastLogCount.set(actorId, count);

    if (count > BotIntentCollector.LOG_SUPPRESS_AFTER) return;

    if (count === BotIntentCollector.LOG_SUPPRESS_AFTER) {
      console.log(
          `[Bot:${actorId}] ${decision} (suppressing further duplicates)`);
      return;
    }

    const dirStr = direction ? ` → ${direction}` : '';
    const scoreStr =
        Object.entries(scores)
            .map(
                ([k, v]) => `${k}=${
                    typeof v === 'number' ? (v as number).toFixed(2) : v}`)
            .join(', ');
    console.log(`[Bot:${actorId}] ${decision}${dirStr} | ${scoreStr}`);
  }

  private dirTarget(pos: Vec3i, dir: Direction2D): Vec3i {
    const vec = DIRECTION_TO_VECTOR[dir];
    return {x: pos.x + vec.dx, y: pos.y + vec.dy, z: pos.z};
  }

  /** Find the best direction toward the nearest non-eliminated enemy actor. */
  private findDirectionTowardActor(
      snapshot: WorldSnapshot,
      actor: ActorState,
      dangerCells: Set<string>,
      scanRange: number,
      ): {dir: Direction2D|null, dist: number} {
    let bestDir: Direction2D|null = null;
    let bestDist = Infinity;

    for (const other of Object.values(snapshot.actors) as ActorState[]) {
      if (other.id === actor.id || other.state.kind === 'eliminated') continue;
      const dx = other.cell.x - actor.cell.x;
      const dy = other.cell.y - actor.cell.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > scanRange || dist >= bestDist) continue;

      // Pick the cardinal direction that reduces distance most
      for (const dir of CARDINAL_DIRECTIONS) {
        const vec = DIRECTION_TO_VECTOR[dir];
        const target: Vec3i = {
          x: actor.cell.x + vec.dx,
          y: actor.cell.y + vec.dy,
          z: actor.cell.z
        };
        const c = snapshot.cells[target.z]?.[target.y]?.[target.x];
        if (c?.occupant?.id === other.id) {
          return {dir, dist: 0};  // other is adjacent in this direction
        }
        if (!c || c.terrain !== 'empty') continue;
        if (dangerCells.has(cellKey(target))) continue;
        const newDist = Math.abs(other.cell.x - target.x) +
            Math.abs(other.cell.y - target.y);
        if (newDist < dist) {
          bestDir = dir;
          bestDist = newDist;
        }
      }
    }

    return {dir: bestDir, dist: bestDist};
  }

  /** Find a safe direction toward the nearest visible item. */
  private findDirectionTowardItem(
      snapshot: WorldSnapshot,
      pos: Vec3i,
      dangerCells: Set<string>,
      scanRange: number,
      ): Direction2D|null {
    for (const dir of CARDINAL_DIRECTIONS) {
      const vec = DIRECTION_TO_VECTOR[dir];
      for (let dist = 1; dist <= scanRange; dist++) {
        const check: Vec3i = {
          x: pos.x + vec.dx * dist,
          y: pos.y + vec.dy * dist,
          z: pos.z,
        };
        const c = snapshot.cells[check.z]?.[check.y]?.[check.x];
        if (!c) break;
        if (c.terrain === 'wall' || c.terrain === 'breakable') break;
        if (c.item) {
          // Check first step toward item is safe
          const first: Vec3i = {x: pos.x + vec.dx, y: pos.y + vec.dy, z: pos.z};
          const fc = snapshot.cells[first.z]?.[first.y]?.[first.x];
          if (fc && fc.terrain === 'empty' && !fc.occupant &&
              !dangerCells.has(cellKey(first))) {
            return dir;
          }
        }
      }
    }
    return null;
  }

  /**
   * Build a set of all cells that are in the blast radius of any bomb
   * (active explosions + predicted blast of idle/ticking bombs).
   */
  private buildDangerZone(snapshot: WorldSnapshot): Set<string> {
    const danger = new Set<string>();

    for (const bomb of Object.values(snapshot.bombs) as BombState[]) {
      if (bomb.state.kind === 'removed') continue;

      if (bomb.state.kind === 'exploding') {
        for (const cell of bomb.state.affectedCells) {
          danger.add(cellKey(cell));
        }
        continue;
      }

      danger.add(cellKey(bomb.cell));
      for (const dir of CARDINAL_DIRECTIONS) {
        const vec = DIRECTION_TO_VECTOR[dir];
        for (let i = 1; i <= bomb.power; i++) {
          const pos: Vec3i = {
            x: bomb.cell.x + vec.dx * i,
            y: bomb.cell.y + vec.dy * i,
            z: bomb.cell.z,
          };
          const cell = snapshot.cells[pos.z]?.[pos.y]?.[pos.x];
          if (!cell) break;
          if (cell.terrain === 'wall') break;
          danger.add(cellKey(pos));
          if (cell.terrain === 'breakable') break;
        }
      }
    }

    return danger;
  }

  private findSafeWalkableDirections(
      snapshot: WorldSnapshot,
      pos: Vec3i,
      dangerCells: Set<string>,
      ): Direction2D[] {
    return this.findWalkableDirections(snapshot, pos).filter((d) => {
      const vec = DIRECTION_TO_VECTOR[d];
      const target: Vec3i = {x: pos.x + vec.dx, y: pos.y + vec.dy, z: pos.z};
      return !dangerCells.has(cellKey(target));
    });
  }

  private findWalkableDirections(
      snapshot: WorldSnapshot,
      pos: Vec3i,
      excludeCells?: Set<string>,
      ): Direction2D[] {
    const walkable: Direction2D[] = [];
    for (const dir of CARDINAL_DIRECTIONS) {
      const vec = DIRECTION_TO_VECTOR[dir];
      const target: Vec3i = {x: pos.x + vec.dx, y: pos.y + vec.dy, z: pos.z};
      const cell = snapshot.cells[target.z]?.[target.y]?.[target.x];
      if (cell && cell.terrain === 'empty' && !cell.occupant) {
        if (excludeCells && excludeCells.has(cellKey(target))) continue;
        walkable.push(dir);
      }
    }
    return walkable;
  }

  private findAdjacentBreakable(snapshot: WorldSnapshot, pos: Vec3i):
      Direction2D|null {
    for (const dir of CARDINAL_DIRECTIONS) {
      const vec = DIRECTION_TO_VECTOR[dir];
      const target: Vec3i = {x: pos.x + vec.dx, y: pos.y + vec.dy, z: pos.z};
      const cell = snapshot.cells[target.z]?.[target.y]?.[target.x];
      if (cell?.terrain === 'breakable') return dir;
    }
    return null;
  }

  /** Returns cells that are currently exploding (not just predicted danger). */
  private buildActiveExplosionCells(snapshot: WorldSnapshot): Set<string> {
    const active = new Set<string>();
    for (const bomb of Object.values(snapshot.bombs) as BombState[]) {
      if (bomb.state.kind === 'exploding') {
        for (const cell of bomb.state.affectedCells) {
          active.add(cellKey(cell));
        }
      }
    }
    return active;
  }

  private isOnBomb(snapshot: WorldSnapshot, actor: ActorState): boolean {
    return Object.values(snapshot.bombs)
        .some(
            (b) => (b as BombState).cell.x === actor.cell.x &&
                (b as BombState).cell.y === actor.cell.y &&
                (b as BombState).cell.z === actor.cell.z &&
                (b as BombState).state.kind !== 'removed',
        );
  }
}

function cellKey(pos: Vec3i): string {
  return `${pos.x},${pos.y},${pos.z}`;
}
