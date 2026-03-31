/**
 * BotIntentCollector — simple rule-based AI for NPC actors.
 *
 * Behavior:
 * 1. If adjacent to an active explosion, flee (move away)
 * 2. If adjacent to a breakable, place bomb and flee
 * 3. Otherwise, random walk toward nearest breakable or roam randomly
 *
 * This is a v0 placeholder bot — not the TensorFlow ML bot planned for later.
 */

import type {
  ActorIntent,
  ActorState,
  BombState,
  WorldSnapshot,
  Direction2D,
  Vec3i,
} from '@bomberman65/shared';
import { CARDINAL_DIRECTIONS, DIRECTION_TO_VECTOR } from '@bomberman65/shared';
import type { IntentCollector } from './IntentCollector.js';
import { SeededRng } from '@bomberman65/shared';

export class BotIntentCollector implements IntentCollector {
  private actorIds: string[];
  private rng: SeededRng;

  constructor(actorIds: string[], seed: number = 12345) {
    this.actorIds = actorIds;
    this.rng = new SeededRng(seed);
  }

  collectIntents(snapshot: WorldSnapshot): ActorIntent[] {
    const intents: ActorIntent[] = [];

    for (const actorId of this.actorIds) {
      const actor = snapshot.actors[actorId] as ActorState | undefined;
      if (!actor || actor.state.kind === 'eliminated') {
        intents.push({ kind: 'idle', actorId });
        continue;
      }

      // Can only act when idle
      if (actor.state.kind !== 'idle' || actor.stunTicksRemaining > 0) {
        intents.push({ kind: 'idle', actorId });
        continue;
      }

      const intent = this.decideIntent(snapshot, actor);
      intents.push(intent);
    }

    return intents;
  }

  private decideIntent(snapshot: WorldSnapshot, actor: ActorState): ActorIntent {
    const { cell } = actor;

    // 1. Flee if near an active explosion
    const dangerDirs = this.findDangerDirections(snapshot, cell);
    if (dangerDirs.length > 0) {
      const safeDirs = this.findSafeDirections(snapshot, cell, dangerDirs);
      if (safeDirs.length > 0) {
        const dir = safeDirs[Math.floor(this.rng.next() * safeDirs.length)]!;
        return { kind: 'move', actorId: actor.id, direction: dir };
      }
    }

    // 2. Check if standing on own bomb — flee
    const onBomb = this.isOnBomb(snapshot, actor);
    if (onBomb) {
      const escapeDirs = this.findWalkableDirections(snapshot, cell);
      if (escapeDirs.length > 0) {
        const dir = escapeDirs[Math.floor(this.rng.next() * escapeDirs.length)]!;
        return { kind: 'move', actorId: actor.id, direction: dir };
      }
    }

    // 3. If adjacent to a breakable and no own bomb nearby, place bomb
    const breakableDir = this.findAdjacentBreakable(snapshot, cell);
    if (breakableDir && !onBomb) {
      const ownBombs = Object.values(snapshot.bombs).filter(
        (b) =>
          (b as BombState).ownerActorId === actor.id && (b as BombState).state.kind !== 'removed',
      ).length;
      if (ownBombs < actor.count) {
        return { kind: 'placeBomb', actorId: actor.id };
      }
    }

    // 4. Random walk toward a breakable or roam
    const walkable = this.findWalkableDirections(snapshot, cell);
    if (walkable.length > 0) {
      // Prefer direction toward a breakable
      const towardBreakable = walkable.filter((d) => {
        const vec = DIRECTION_TO_VECTOR[d];
        for (let dist = 1; dist <= 3; dist++) {
          const check: Vec3i = { x: cell.x + vec.dx * dist, y: cell.y + vec.dy * dist, z: cell.z };
          const c = snapshot.cells[check.z]?.[check.y]?.[check.x];
          if (c?.terrain === 'breakable') return true;
          if (c?.terrain === 'wall') break;
        }
        return false;
      });

      const candidates = towardBreakable.length > 0 ? towardBreakable : walkable;
      const dir = candidates[Math.floor(this.rng.next() * candidates.length)]!;
      return { kind: 'move', actorId: actor.id, direction: dir };
    }

    return { kind: 'idle', actorId: actor.id };
  }

  private findDangerDirections(snapshot: WorldSnapshot, pos: Vec3i): Direction2D[] {
    const danger: Direction2D[] = [];
    for (const bomb of Object.values(snapshot.bombs) as BombState[]) {
      if (bomb.state.kind !== 'exploding') continue;
      for (const affected of bomb.state.affectedCells) {
        if (affected.x === pos.x && affected.y === pos.y && affected.z === pos.z) {
          // We're in danger — all directions are potentially unsafe
          return CARDINAL_DIRECTIONS.slice() as Direction2D[];
        }
        // Check adjacent
        for (const dir of CARDINAL_DIRECTIONS) {
          const vec = DIRECTION_TO_VECTOR[dir];
          if (
            affected.x === pos.x + vec.dx &&
            affected.y === pos.y + vec.dy &&
            affected.z === pos.z
          ) {
            danger.push(dir);
          }
        }
      }
    }
    return danger;
  }

  private findSafeDirections(
    snapshot: WorldSnapshot,
    pos: Vec3i,
    dangerDirs: Direction2D[],
  ): Direction2D[] {
    const dangerSet = new Set(dangerDirs);
    return this.findWalkableDirections(snapshot, pos).filter((d) => !dangerSet.has(d));
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
