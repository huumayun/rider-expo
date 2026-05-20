import { create } from 'zustand';

interface LocationState {
  currentLocation: { lat: number; lng: number } | null;
  heading: number | null;
  speed: number | null;
  locationError: string | null;
  isTracking: boolean;
  
  setCurrentLocation: (loc: { lat: number; lng: number } | null) => void;
  setHeading: (h: number | null) => void;
  setSpeed: (s: number | null) => void;
  setLocationError: (err: string | null) => void;
  setIsTracking: (tracking: boolean) => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  currentLocation: null,
  heading: null,
  speed: null,
  locationError: null,
  isTracking: false,

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
}));
