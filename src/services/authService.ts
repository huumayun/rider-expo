import { auth, signOut } from '../config/firebase';
import { useAuthStore } from '../store/authStore';

export const authService = {
  logout: async () => {
    try {
      await signOut(auth);
      useAuthStore.getState().setRider(null);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  }
};
