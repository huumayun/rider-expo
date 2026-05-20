import { create } from 'zustand';

interface UIState {
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
  showMapOverlay: boolean;
  setShowMapOverlay: (show: boolean) => void;
  viewMode: 'list' | 'map';
  setViewMode: (mode: 'list' | 'map') => void;
  isExecuting: boolean;
  setIsExecuting: (val: boolean) => void;
  hideBottomNav: boolean;
  setHideBottomNav: (val: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  showSidebar: false,
  setShowSidebar: (show) => set({ showSidebar: show }),
  showMapOverlay: false,
  setShowMapOverlay: (show) => set({ showMapOverlay: show }),
  viewMode: 'list',
  setViewMode: (mode) => set({ viewMode: mode }),
  isExecuting: false,
  setIsExecuting: (val) => set({ isExecuting: val }),
  hideBottomNav: false,
  setHideBottomNav: (val) => set({ hideBottomNav: val }),
}));
