import type { Vec3i } from './primitives.js';

/** Bidirectional selection state shared between GUI and renderer. */
export type Selection =
  | { readonly kind: 'none' }
  | { readonly kind: 'cell'; readonly position: Vec3i }
  | { readonly kind: 'actor'; readonly id: string }
  | { readonly kind: 'bomb'; readonly id: string }
  | { readonly kind: 'run'; readonly id: string };
