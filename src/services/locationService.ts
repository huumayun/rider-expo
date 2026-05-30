import * as Location from 'expo-location';
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import { rtdb } from '../config/firebase';
import { RTDB_PATHS } from '../config/constants';

// ─── Permission helpers ───────────────────────────────────────────────────────

export async function requestForegroundPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function requestBackgroundPermission(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === 'granted';
}

// ─── RTDB write ───────────────────────────────────────────────────────────────
// Writes to: riders/{riderId}/tracking
// Payload matches the exact structure required.

export async function writeTrackingToRTDB(
  riderId: string,
  coords: Location.LocationObjectCoords,
): Promise<void> {
  try {
    await rtdb.ref(RTDB_PATHS.riderTracking(riderId)).set({
      location: {
        lat: coords.latitude,
        lng: coords.longitude,
        speed: coords.speed ?? 0,
        heading: coords.heading ?? 0,
      },
      lastSeen: firebase.database.ServerValue.TIMESTAMP,
    });
  } catch (error) {
    console.warn('[locationService] RTDB write failed:', error);
  }
}

// ─── Haversine distance (metres) ─────────────────────────────────────────────

export function distanceMetres(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
