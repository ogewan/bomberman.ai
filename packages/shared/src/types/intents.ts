import type { Direction2D } from './direction.js';

/**
 * Actor intents represent actions an actor wants to perform on the current tick.
 * Intents are validated by the simulation before being applied.
 */
export type ActorIntent =
  | { readonly kind: 'move'; readonly actorId: string; readonly direction: Direction2D }
  | { readonly kind: 'placeBomb'; readonly actorId: string }
  | { readonly kind: 'kick'; readonly actorId: string; readonly direction: Direction2D }
  | { readonly kind: 'pickup'; readonly actorId: string }
  | { readonly kind: 'pump'; readonly actorId: string }
  | { readonly kind: 'throw'; readonly actorId: string; readonly direction: Direction2D }
  | { readonly kind: 'idle'; readonly actorId: string };
