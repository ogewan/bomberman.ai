/**
 * layoutStore — Zustand store for layout/panel state.
 * Sidebar open/closed, active tabs, overlay toggles.
 */

import { create } from 'zustand';

export type LayoutState = {
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  leftActiveTab: string;
  rightActiveTab: string;
  showDebugGrid: boolean;
  showDebugCoordinates: boolean;
};

export type LayoutActions = {
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftActiveTab: (tab: string) => void;
  setRightActiveTab: (tab: string) => void;
  toggleDebugGrid: () => void;
  toggleDebugCoordinates: () => void;
};

export const useLayoutStore = create<LayoutState & LayoutActions>((set) => ({
  leftSidebarOpen: true,
  rightSidebarOpen: true,
  leftActiveTab: 'run',
  rightActiveTab: 'inspector',
  showDebugGrid: false,
  showDebugCoordinates: false,
  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  setLeftActiveTab: (leftActiveTab) => set({ leftActiveTab }),
  setRightActiveTab: (rightActiveTab) => set({ rightActiveTab }),
  toggleDebugGrid: () => set((s) => ({ showDebugGrid: !s.showDebugGrid })),
  toggleDebugCoordinates: () => set((s) => ({ showDebugCoordinates: !s.showDebugCoordinates })),
}));
