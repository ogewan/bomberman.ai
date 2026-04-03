/**
 * RenderModelAdapter — transforms a WorldSnapshot into a RenderModel
 * containing only the data the renderer needs.
 */

import type { WorldSnapshot, Vec3i, ActorState, BombState } from '@bomberman65/shared';

/** Visual representation of a terrain cell. */
export type TerrainInstance = {
  readonly position: Vec3i;
  readonly type: 'wall' | 'breakable' | 'ramp' | 'empty';
};

/** Visual representation of an actor. */
export type ActorVisual = {
  readonly id: string;
  readonly position: Vec3i;
  readonly facing: string;
  readonly color: string;
  readonly isEliminated: boolean;
  readonly isStunned: boolean;
  readonly isShielded: boolean;
  readonly isHeld: boolean;
  readonly holderId?: string;
  readonly motionProgress: number;
  readonly motionFrom?: Vec3i;
  readonly motionTo?: Vec3i;
};

/** Visual representation of a bomb. */
export type BombVisual = {
  readonly id: string;
  readonly position: Vec3i;
  readonly type: 'regular' | 'pumped';
  readonly fuseProgress: number;
  readonly isExploding: boolean;
  readonly isHeld: boolean;
  readonly holderId?: string;
  readonly affectedCells?: Vec3i[];
  readonly motionProgress: number;
  readonly motionFrom?: Vec3i;
  readonly motionTo?: Vec3i;
};

/** Visual representation of an item. */
export type ItemVisual = {
  readonly position: Vec3i;
  readonly type: string;
};

/** Complete render model consumed by R3F scene. */
export type RenderModel = {
  readonly terrain: TerrainInstance[];
  readonly actors: ActorVisual[];
  readonly bombs: BombVisual[];
  readonly items: ItemVisual[];
  readonly explosionCells: Vec3i[];
  readonly gridSize: Vec3i;
};

const ACTOR_COLORS = ['#4488ff', '#ff4444', '#44cc44', '#ffaa00', '#cc44cc', '#44cccc'];

/** Build a RenderModel from a WorldSnapshot. */
export function buildRenderModel(snapshot: WorldSnapshot): RenderModel {
  const terrain: TerrainInstance[] = [];
  const items: ItemVisual[] = [];

  for (let z = 0; z < snapshot.size.z; z++) {
    for (let y = 0; y < snapshot.size.y; y++) {
      for (let x = 0; x < snapshot.size.x; x++) {
        const cell = snapshot.cells[z]?.[y]?.[x];
        if (!cell) continue;

        if (cell.terrain !== 'empty') {
          terrain.push({ position: { x, y, z }, type: cell.terrain });
        }

        if (cell.item) {
          items.push({ position: { x, y, z }, type: cell.item });
        }
      }
    }
  }

  // Build actor-position lookup for held entity rendering
  const actorPositions = new Map<string, Vec3i>();
  for (const actor of Object.values(snapshot.actors) as ActorState[]) {
    actorPositions.set(actor.id, actor.cell);
  }

  const actors: ActorVisual[] = [];
  let colorIdx = 0;
  for (const actor of Object.values(snapshot.actors) as ActorState[]) {
    const isHeld = actor.state.kind === 'held';
    const holderId = actor.state.kind === 'held' ? actor.state.holderActorId : undefined;
    const motionProgress = computeActorMotionProgress(actor);

    // If held, position above the holder
    let position = actor.cell;
    if (isHeld && holderId) {
      const holderPos = actorPositions.get(holderId);
      if (holderPos) position = holderPos;
    }

    const visual: ActorVisual = {
      id: actor.id,
      position,
      facing: actor.facing,
      color: ACTOR_COLORS[colorIdx % ACTOR_COLORS.length]!,
      isEliminated: actor.state.kind === 'eliminated',
      isStunned: actor.stunTicksRemaining > 0,
      isShielded: actor.shieldTicksRemaining > 0,
      isHeld,
      holderId,
      motionProgress,
      motionFrom:
        actor.state.kind === 'surfaceTravel'
          ? actor.state.from
          : actor.state.kind === 'thrownTravel'
            ? actor.state.from
            : undefined,
      motionTo:
        actor.state.kind === 'surfaceTravel'
          ? actor.state.to
          : actor.state.kind === 'thrownTravel'
            ? { ...actor.state.to, z: actor.state.from.z + 1 }
            : undefined,
    };
    actors.push(visual);
    colorIdx++;
  }

  const bombs: BombVisual[] = [];
  const explosionCells: Vec3i[] = [];

  for (const bomb of Object.values(snapshot.bombs) as BombState[]) {
    if (bomb.state.kind === 'removed') continue;

    const isExploding = bomb.state.kind === 'exploding';
    const isHeld = bomb.state.kind === 'held';
    const holderId = bomb.state.kind === 'held' ? bomb.state.holderActorId : undefined;

    if (isExploding && bomb.state.kind === 'exploding') {
      for (const cell of bomb.state.affectedCells) {
        explosionCells.push(cell);
      }
    }

    // Compute bomb motion for interpolation
    const bombMotion = computeBombMotion(bomb);

    // If held, use the holder actor's interpolated position
    let position = bomb.cell;
    if (isHeld && holderId) {
      const holderVisual = actors.find((a) => a.id === holderId);
      if (holderVisual) {
        // Use the holder's interpolated position (already computed)
        position = interpolatePosition(holderVisual);
      }
    }

    bombs.push({
      id: bomb.id,
      position,
      type: bomb.bombType,
      fuseProgress: computeFuseProgress(bomb),
      isExploding,
      isHeld,
      holderId,
      affectedCells:
        isExploding && bomb.state.kind === 'exploding' ? bomb.state.affectedCells : undefined,
      motionProgress: bombMotion.progress,
      motionFrom: bombMotion.from,
      motionTo: bombMotion.to,
    });
  }

  return {
    terrain,
    actors,
    bombs,
    items,
    explosionCells,
    gridSize: snapshot.size,
  };
}

function computeActorMotionProgress(actor: ActorState): number {
  if (actor.state.kind === 'surfaceTravel' || actor.state.kind === 'thrownTravel') {
    if (actor.state.phaseTicksTotal === 0) return actor.state.phase === 'leaving' ? 0.5 : 1;

    const phaseProgress = actor.state.phaseTicksElapsed / actor.state.phaseTicksTotal;

    if (actor.state.phase === 'leaving') {
      return phaseProgress * 0.5;
    } else {
      return 0.5 + phaseProgress * 0.5;
    }
  }
  return 0;
}

function computeFuseProgress(bomb: BombState): number {
  if (bomb.state.kind === 'exploding') return 1;
  const total = bomb.initialFuseTicks || 120;
  return Math.max(0, Math.min(1, 1 - bomb.fuseTicksRemaining / total));
}

function computeBombMotion(bomb: BombState): {
  progress: number;
  from?: Vec3i;
  to?: Vec3i;
} {
  if (bomb.state.kind === 'surfaceTravel') {
    const { phase, phaseTicksElapsed, phaseTicksTotal } = bomb.state;
    if (phaseTicksTotal === 0) return { progress: phase === 'leaving' ? 0.5 : 1 };
    const p = phaseTicksElapsed / phaseTicksTotal;
    return {
      progress: phase === 'leaving' ? p * 0.5 : 0.5 + p * 0.5,
      from: bomb.state.from,
      to: bomb.state.to,
    };
  }
  if (bomb.state.kind === 'thrownTravel') {
    const { phase, phaseTicksElapsed, phaseTicksTotal } = bomb.state;
    if (phaseTicksTotal === 0) return { progress: phase === 'leaving' ? 0.5 : 1 };
    const p = phaseTicksElapsed / phaseTicksTotal;
    return {
      progress: phase === 'leaving' ? p * 0.5 : 0.5 + p * 0.5,
      from: bomb.state.from,
      to: { ...bomb.state.to, z: bomb.state.from.z + 1 },
    };
  }
  return { progress: 0 };
}

/** Interpolate a visual's position from its motion data. */
function interpolatePosition(visual: ActorVisual): Vec3i {
  if (!visual.motionFrom || !visual.motionTo || visual.motionProgress === 0) {
    return visual.position;
  }
  const t = visual.motionProgress;
  return {
    x: visual.motionFrom.x + (visual.motionTo.x - visual.motionFrom.x) * t,
    y: visual.motionFrom.y + (visual.motionTo.y - visual.motionFrom.y) * t,
    z: visual.motionFrom.z + (visual.motionTo.z - visual.motionFrom.z) * t,
  };
}
