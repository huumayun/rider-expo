import { create } from 'zustand';
import { auth, signOut } from '../config/firebase';

export interface RiderProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: 'riders' | 'rider_hub';
  employeeId?: string;
  photoURL?: string;
  dutyStatus: 'online' | 'offline';
  isVisible?: boolean;
  currentLocation?: { lat: number; lng: number };
  hub?: string;
  area?: string;
  holdingBalance?: number;
}

interface AuthState {
  rider: RiderProfile | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  setRider: (rider: RiderProfile | null) => void;
  setLoading: (loading: boolean) => void;
  updateRiderField: (fields: Partial<RiderProfile>) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  rider: null,
  isLoading: true,
  isLoggedIn: false,

  setRider: (rider) =>
    set({ rider, isLoading: false, isLoggedIn: !!rider }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  updateRiderField: (fields) => {
    const current = get().rider;
    if (!current) return;
    set({ rider: { ...current, ...fields } });
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('[AuthStore] signOut error:', e);
    }
    set({ rider: null, isLoggedIn: false, isLoading: false });
  },
}));
