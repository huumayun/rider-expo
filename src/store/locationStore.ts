import { create } from 'zustand';

interface LocationState {
  currentLocation: { lat: number; lng: number } | null;
  heading: number | null;
  speed: number | null;
  locationError: string | null;
  isTracking: boolean;

  // Analytics
  totalDistance: number; // in km
  activeTime: number; // in seconds
  
  setCurrentLocation: (loc: { lat: number; lng: number } | null) => void;
  setHeading: (h: number | null) => void;
  setSpeed: (s: number | null) => void;
  setLocationError: (err: string | null) => void;
  setIsTracking: (tracking: boolean) => void;

  setAnalytics: (stats: { totalDistance: number; activeTime: number }) => void;
  addDistance: (d: number) => void;
  addActiveTime: (t: number) => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  currentLocation: null,
  heading: null,
  speed: null,
  locationError: null,
  isTracking: false,

  // Analytics initial state
  totalDistance: 0,
  activeTime: 0,

  setCurrentLocation: (loc) => set({ currentLocation: loc }),
  setHeading: (h) => {
    // Only call set() (which notifies all subscribers) when heading actually changed
    const current = get().heading;
    if (current === null || Math.abs(current - (h ?? 0)) >= 2) {
      set({ heading: h });
    }
  },
  setSpeed: (s) => set({ speed: s }),
  setLocationError: (err) => set({ locationError: err }),
  setIsTracking: (isTracking) => set({ isTracking }),

  setAnalytics: (stats) => set({ totalDistance: stats.totalDistance, activeTime: stats.activeTime }),
  addDistance: (d) => set((state) => ({ totalDistance: state.totalDistance + d })),
  addActiveTime: (t) => set((state) => ({ activeTime: state.activeTime + t })),
}));
