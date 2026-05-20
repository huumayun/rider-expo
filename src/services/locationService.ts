import * as Location from 'expo-location';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export const locationService = {
  requestPermissions: async () => {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') return false;
    
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    return bgStatus === 'granted';
  },

  updateLocation: async (uid: string, location: Location.LocationObject) => {
    try {
      await updateDoc(doc(db, 'employees', uid), {
        currentLocation: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          heading: location.coords.heading || 0,
          speed: location.coords.speed || 0,
          updatedAt: serverTimestamp(),
        }
      });
    } catch (error) {
      console.error('Failed to update location', error);
    }
  }
};
