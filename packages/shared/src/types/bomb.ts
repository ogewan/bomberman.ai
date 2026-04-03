import type { Direction2D } from './direction.js';
import type { BombType, Vec3i } from './primitives.js';

/** Motion state machine for bombs. */
export type BombMotionState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'surfaceTravel';
      readonly mode: 'kicked';
      readonly from: Vec3i;
      readonly to: Vec3i;
      readonly direction: Direction2D;
      readonly phase: 'leaving' | 'entering';
      phaseTicksElapsed: number;
      readonly phaseTicksTotal: number;
    }
  | {
      readonly kind: 'held';
      readonly holderActorId: string;
    }
  | {
      readonly kind: 'thrownTravel';
      readonly throwOrigin: Vec3i;
      readonly from: Vec3i;
      readonly to: Vec3i;
      readonly direction: Direction2D;
      remainingDistance: number;
      readonly phase: 'leaving' | 'entering';
      phaseTicksElapsed: number;
      readonly phaseTicksTotal: number;
      readonly interactionLocked: boolean;
    }
  | {
      readonly kind: 'exploding';
      readonly origin: Vec3i;
      ticksRemaining: number;
      readonly affectedCells: Vec3i[];
    }
  | { readonly kind: 'removed' };

/** Full state for a single bomb entity. */
export type BombState = {
  readonly id: string;
  readonly ownerActorId: string;
  bombType: BombType;
  cell: Vec3i;
  power: number;
  fuseTicksRemaining: number;
  initialFuseTicks: number;
  /** Last movement direction — used for bounce resolution when falling. */
  lastMoveDirection?: Direction2D;
  state: BombMotionState;
};
