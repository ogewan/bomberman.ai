/**
 * selectionStore — Zustand store for bidirectional selection state.
 * Shared between GUI and renderer. Both scene clicks and sidebar interactions
 * update the same selection.
 */

import { create } from 'zustand';
import type { Selection } from '@bomberman65/shared';

export type SelectionState = {
  selection: Selection;
};

export type SelectionActions = {
  select: (selection: Selection) => void;
  clearSelection: () => void;
};

export const useSelectionStore = create<SelectionState & SelectionActions>((set) => ({
  selection: { kind: 'none' },
  select: (selection) => set({ selection }),
  clearSelection: () => set({ selection: { kind: 'none' } }),
}));
