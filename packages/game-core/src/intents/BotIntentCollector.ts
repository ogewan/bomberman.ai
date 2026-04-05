/**
 * BotIntentCollector — rule-based AI for NPC actors, driven by BotBehavior config.
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

import type {
  ActorIntent,
  ActorState,
  BombState,
  WorldSnapshot,
  Direction2D,
  Vec3i,
  BotBehavior,
} from '@bomberman65/shared';
import { CARDINAL_DIRECTIONS, DIRECTION_TO_VECTOR, createDefaultBehavior } from '@bomberman65/shared';
import type { IntentCollector } from './IntentCollector.js';
import { SeededRng } from '@bomberman65/shared';

export class BotIntentCollector implements IntentCollector {
  private actorIds: string[];
  private rng: SeededRng;
  private behaviors: Map<string, BotBehavior>;

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

    for (const actorId of this.actorIds) {
      const actor = snapshot.actors[actorId] as ActorState | undefined;
      if (!actor || actor.state.kind === 'eliminated') {
        intents.push({ kind: 'idle', actorId });
        continue;
      }

      if (actor.state.kind !== 'idle' || actor.stunTicksRemaining > 0) {
        intents.push({ kind: 'idle', actorId });
        continue;
      }

      const behavior = this.behaviors.get(actorId) ?? createDefaultBehavior();
      const intent = this.decideIntent(snapshot, actor, dangerCells, behavior);
      intents.push(intent);
    }

    return intents;
  }

  private decideIntent(
    snapshot: WorldSnapshot,
    actor: ActorState,
    dangerCells: Set<string>,
    behavior: BotBehavior,
  ): ActorIntent {
    const { cell } = actor;
    const posKey = cellKey(cell);
    const inDanger = dangerCells.has(posKey);

    // 1. Flee danger (weighted)
    if (inDanger && behavior.fleeWeight > 0) {
      const threshold = this.rng.next();
      if (threshold < behavior.fleeWeight) {
        const safeDirs = this.findSafeWalkableDirections(snapshot, cell, dangerCells);
        if (safeDirs.length > 0) {
          const dir = safeDirs[Math.floor(this.rng.next() * safeDirs.length)]!;
          return { kind: 'move', actorId: actor.id, direction: dir };
        }
        const anyDirs = this.findWalkableDirections(snapshot, cell);
        if (anyDirs.length > 0) {
          const dir = anyDirs[Math.floor(this.rng.next() * anyDirs.length)]!;
          return { kind: 'move', actorId: actor.id, direction: dir };
        }
        return { kind: 'idle', actorId: actor.id };
      }
    }

    // 2. Chase actors (weighted)
    if (behavior.chaseWeight > 0 && this.rng.next() < behavior.chaseWeight) {
      const chaseDir = this.findDirectionTowardActor(snapshot, actor, dangerCells, behavior.scanRange);
      if (chaseDir) {
        return { kind: 'move', actorId: actor.id, direction: chaseDir };
      }
    }

    // 3. Place bomb near breakables (weighted)
    if (behavior.bombWeight > 0) {
      const breakableDir = this.findAdjacentBreakable(snapshot, cell);
      if (breakableDir && !this.isOnBomb(snapshot, actor) && this.rng.next() < behavior.bombWeight) {
        const ownBombs = Object.values(snapshot.bombs).filter(
          (b) =>
            (b as BombState).ownerActorId === actor.id &&
            (b as BombState).state.kind !== 'removed',
        ).length;
        if (ownBombs < actor.count) {
          const escapeAfterBomb = this.findSafeWalkableDirections(snapshot, cell, dangerCells);
          if (escapeAfterBomb.length > 0) {
            return { kind: 'placeBomb', actorId: actor.id };
          }
        }
      }
    }

    // Standing on own bomb — flee immediately
    if (this.isOnBomb(snapshot, actor)) {
      const safeDirs = this.findSafeWalkableDirections(snapshot, cell, dangerCells);
      if (safeDirs.length > 0) {
        const dir = safeDirs[Math.floor(this.rng.next() * safeDirs.length)]!;
        return { kind: 'move', actorId: actor.id, direction: dir };
      }
    }

    // 4. Pursue items (weighted)
    if (behavior.itemWeight > 0 && this.rng.next() < behavior.itemWeight) {
      const itemDir = this.findDirectionTowardItem(snapshot, cell, dangerCells, behavior.scanRange);
      if (itemDir) {
        return { kind: 'move', actorId: actor.id, direction: itemDir };
      }
    }

    // 5. Roam (weighted)
    if (behavior.roamWeight > 0) {
      const safeDirs = this.findSafeWalkableDirections(snapshot, cell, dangerCells);
      if (safeDirs.length > 0 && this.rng.next() < behavior.roamWeight) {
        // Prefer direction toward a breakable within scan range
        const towardBreakable = safeDirs.filter((d) => {
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

        const candidates = towardBreakable.length > 0 ? towardBreakable : safeDirs;
        const dir = candidates[Math.floor(this.rng.next() * candidates.length)]!;
        return { kind: 'move', actorId: actor.id, direction: dir };
      }
    }

    return { kind: 'idle', actorId: actor.id };
  }

  /** Find a safe direction toward the nearest non-eliminated enemy actor. */
  private findDirectionTowardActor(
    snapshot: WorldSnapshot,
    actor: ActorState,
    dangerCells: Set<string>,
    scanRange: number,
  ): Direction2D | null {
    let bestDir: Direction2D | null = null;
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
        const target: Vec3i = { x: actor.cell.x + vec.dx, y: actor.cell.y + vec.dy, z: actor.cell.z };
        const c = snapshot.cells[target.z]?.[target.y]?.[target.x];
        if (!c || c.terrain !== 'empty' || c.occupant) continue;
        if (dangerCells.has(cellKey(target))) continue;
        const newDist = Math.abs(other.cell.x - target.x) + Math.abs(other.cell.y - target.y);
        if (newDist < dist) {
          bestDir = dir;
          bestDist = dist;
        }
      }
    }

    return bestDir;
  }

  /** Find a safe direction toward the nearest visible item. */
  private findDirectionTowardItem(
    snapshot: WorldSnapshot,
    pos: Vec3i,
    dangerCells: Set<string>,
    scanRange: number,
  ): Direction2D | null {
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
          const first: Vec3i = { x: pos.x + vec.dx, y: pos.y + vec.dy, z: pos.z };
          const fc = snapshot.cells[first.z]?.[first.y]?.[first.x];
          if (fc && fc.terrain === 'empty' && !fc.occupant && !dangerCells.has(cellKey(first))) {
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
      const target: Vec3i = { x: pos.x + vec.dx, y: pos.y + vec.dy, z: pos.z };
      return !dangerCells.has(cellKey(target));
    });
  }

  private findWalkableDirections(snapshot: WorldSnapshot, pos: Vec3i): Direction2D[] {
    const walkable: Direction2D[] = [];
    for (const dir of CARDINAL_DIRECTIONS) {
      const vec = DIRECTION_TO_VECTOR[dir];
      const target: Vec3i = { x: pos.x + vec.dx, y: pos.y + vec.dy, z: pos.z };
      const cell = snapshot.cells[target.z]?.[target.y]?.[target.x];
      if (cell && cell.terrain === 'empty' && !cell.occupant) {
        walkable.push(dir);
      }
    }
    return walkable;
  }

  private findAdjacentBreakable(snapshot: WorldSnapshot, pos: Vec3i): Direction2D | null {
    for (const dir of CARDINAL_DIRECTIONS) {
      const vec = DIRECTION_TO_VECTOR[dir];
      const target: Vec3i = { x: pos.x + vec.dx, y: pos.y + vec.dy, z: pos.z };
      const cell = snapshot.cells[target.z]?.[target.y]?.[target.x];
      if (cell?.terrain === 'breakable') return dir;
    }
    return null;
  }

  private isOnBomb(snapshot: WorldSnapshot, actor: ActorState): boolean {
    return Object.values(snapshot.bombs).some(
      (b) =>
        (b as BombState).cell.x === actor.cell.x &&
        (b as BombState).cell.y === actor.cell.y &&
        (b as BombState).cell.z === actor.cell.z &&
        (b as BombState).state.kind !== 'removed',
    );
  }
}

function cellKey(pos: Vec3i): string {
  return `${pos.x},${pos.y},${pos.z}`;
}
