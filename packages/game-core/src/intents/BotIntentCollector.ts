/**
 * BotIntentCollector — simple rule-based AI for NPC actors.
 *
 * Behavior:
 * 1. If standing in a danger zone (bomb blast radius or active explosion), flee
 * 2. If adjacent to a breakable and in a safe position, place bomb and flee
 * 3. Otherwise, walk toward nearest breakable or roam randomly
 *
 * Danger awareness: the bot predicts blast radii of all non-removed bombs
 * (not just active explosions) to avoid walking into future explosions.
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

      const intent = this.decideIntent(snapshot, actor, dangerCells);
      intents.push(intent);
    }

    return intents;
  }

  private decideIntent(
    snapshot: WorldSnapshot,
    actor: ActorState,
    dangerCells: Set<string>,
  ): ActorIntent {
    const { cell } = actor;
    const posKey = cellKey(cell);
    const inDanger = dangerCells.has(posKey);

    // 1. If in danger, flee to a safe walkable cell
    if (inDanger) {
      const safeDirs = this.findSafeWalkableDirections(snapshot, cell, dangerCells);
      if (safeDirs.length > 0) {
        const dir = safeDirs[Math.floor(this.rng.next() * safeDirs.length)]!;
        return { kind: 'move', actorId: actor.id, direction: dir };
      }
      // No safe direction — try any walkable direction as last resort
      const anyDirs = this.findWalkableDirections(snapshot, cell);
      if (anyDirs.length > 0) {
        const dir = anyDirs[Math.floor(this.rng.next() * anyDirs.length)]!;
        return { kind: 'move', actorId: actor.id, direction: dir };
      }
      return { kind: 'idle', actorId: actor.id };
    }

    // 2. If adjacent to a breakable and NOT standing on a bomb, place bomb
    const breakableDir = this.findAdjacentBreakable(snapshot, cell);
    if (breakableDir && !this.isOnBomb(snapshot, actor)) {
      const ownBombs = Object.values(snapshot.bombs).filter(
        (b) =>
          (b as BombState).ownerActorId === actor.id && (b as BombState).state.kind !== 'removed',
      ).length;
      if (ownBombs < actor.count) {
        // Only place if there's a safe escape route after placing
        const escapeAfterBomb = this.findSafeWalkableDirections(snapshot, cell, dangerCells);
        if (escapeAfterBomb.length > 0) {
          return { kind: 'placeBomb', actorId: actor.id };
        }
      }
    }

    // 3. Standing on own bomb — flee immediately
    if (this.isOnBomb(snapshot, actor)) {
      const safeDirs = this.findSafeWalkableDirections(snapshot, cell, dangerCells);
      if (safeDirs.length > 0) {
        const dir = safeDirs[Math.floor(this.rng.next() * safeDirs.length)]!;
        return { kind: 'move', actorId: actor.id, direction: dir };
      }
    }

    // 4. Walk toward a breakable or roam (only to safe cells)
    const safeDirs = this.findSafeWalkableDirections(snapshot, cell, dangerCells);
    if (safeDirs.length > 0) {
      // Prefer direction toward a breakable
      const towardBreakable = safeDirs.filter((d) => {
        const vec = DIRECTION_TO_VECTOR[d];
        for (let dist = 1; dist <= 3; dist++) {
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

    return { kind: 'idle', actorId: actor.id };
  }

  /**
   * Build a set of all cells that are in the blast radius of any bomb
   * (active explosions + predicted blast of idle/ticking bombs).
   */
  private buildDangerZone(snapshot: WorldSnapshot): Set<string> {
    const danger = new Set<string>();

    for (const bomb of Object.values(snapshot.bombs) as BombState[]) {
      if (bomb.state.kind === 'removed') continue;

      // Active explosions — directly dangerous
      if (bomb.state.kind === 'exploding') {
        for (const cell of bomb.state.affectedCells) {
          danger.add(cellKey(cell));
        }
        continue;
      }

      // Predict blast radius of non-exploding bombs
      // Regular: cardinal directions up to power
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
