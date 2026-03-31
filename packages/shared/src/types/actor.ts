import type { Direction2D } from './direction.js';
import type { Upgrade, Vec3i } from './primitives.js';

/** Motion state machine for actors. */
export type ActorMotionState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'surfaceTravel';
      readonly mode: 'walk';
      readonly from: Vec3i;
      readonly to: Vec3i;
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
  | { readonly kind: 'eliminated' };

/** Full state for a single actor entity. */
export type ActorState = {
  readonly id: string;
  cell: Vec3i;
  facing: Direction2D;

  count: number;
  power: number;
  upgrade: Upgrade;

  stunTicksRemaining: number;
  shieldTicksRemaining: number;

  state: ActorMotionState;
};
