import React, {
  createContext, useContext, useEffect, useRef, ReactNode,
} from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKGROUND_LOCATION_TASK, TRACKING_DISTANCE_INTERVAL_M } from '../config/constants';
import { useAuthStore } from '../store/authStore';
import { useLocationStore } from '../store/locationStore';
import {
  writeTrackingToRTDB,
  distanceMetres,
  requestForegroundPermission,
  requestBackgroundPermission,
} from '../services/locationService';

// ─── Background task (must be at module top-level) ───────────────────────────
// When the app is backgrounded / killed, expo-location fires this task.
// We write directly to RTDB here with the exact required payload.
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) { console.error('[BG Location]', error.message); return; }
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  const loc = locations?.[0];
  if (!loc) return;

  try {
    // Persist riderId across the task boundary via AsyncStorage.
    const riderId = await AsyncStorage.getItem('tracking_rider_id');
    if (!riderId) return;

    // Distance gate — only write if the rider has moved >= threshold.
    const lastRaw = await AsyncStorage.getItem('bg_last_coords');
    if (lastRaw) {
      const { lat: pLat, lng: pLng } = JSON.parse(lastRaw);
      const moved = distanceMetres(pLat, pLng, loc.coords.latitude, loc.coords.longitude);
      if (moved < TRACKING_DISTANCE_INTERVAL_M) return; // stationary — skip write
    }

    await writeTrackingToRTDB(riderId, loc.coords);

    // Relay latest coords for AsyncStorage so foreground can sync UI state.
    await AsyncStorage.setItem('bg_last_coords', JSON.stringify({
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      heading: loc.coords.heading ?? null,
      speed: loc.coords.speed ?? 0,
      timestamp: loc.timestamp,
    }));
  } catch (e) {
    console.error('[BG Location] write error:', e);
  }
});

// ─── Context types ────────────────────────────────────────────────────────────
interface LocationContextValue {
  currentLocation: { lat: number; lng: number } | null;
  heading: number | null;
  speed: number | null;
  locationError: string | null;
  isTracking: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function LocationProvider({ children }: { children: ReactNode }) {
  const { rider } = useAuthStore();
  const {
    currentLocation, heading, speed, locationError, isTracking,
    totalDistance, activeTime,
    setCurrentLocation, setHeading, setSpeed, setLocationError, setIsTracking,
    setAnalytics, addDistance, addActiveTime,
  } = useLocationStore();

  const fgSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastFgCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Load persisted analytics stats on mount
  useEffect(() => {
    const loadStats = async () => {
      try {
        const stored = await AsyncStorage.getItem('ride_analytics');
        if (stored) {
          const parsed = JSON.parse(stored);
          setAnalytics(parsed);
        }
      } catch (e) {
        console.error('Failed to load ride analytics', e);
      }
    };
    loadStats();
  }, [setAnalytics]);

  // Track active time (1 second increment every second when tracking is active)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isTracking) {
      timer = setInterval(() => {
        addActiveTime(1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTracking, addActiveTime]);

  // Periodically persist analytics stats (every 10 seconds)
  useEffect(() => {
    if (!isTracking) return;
    const interval = setInterval(async () => {
      try {
        await AsyncStorage.setItem('ride_analytics', JSON.stringify({
          totalDistance,
          activeTime
        }));
      } catch (e) {
        console.error('Failed to save ride analytics', e);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isTracking, totalDistance, activeTime]);

  // ─── Handle a fresh location update ────────────────────────────────────────
  const onLocationUpdate = async (uid: string, loc: Location.LocationObject) => {
    const { latitude: lat, longitude: lng, heading: h, speed: s } = loc.coords;

    // Always update local UI state in real-time
    setCurrentLocation({ lat, lng });
    if (h !== null && h !== undefined && h >= 0) setHeading(h);
    setSpeed(s ?? 0);

    // Foreground distance tracking
    if (lastFgCoordsRef.current) {
      const movedKm = distanceMetres(
        lastFgCoordsRef.current.lat, lastFgCoordsRef.current.lng, lat, lng,
      ) / 1000;
      if (movedKm > 0.002) { // filter GPS noise/jitter
        addDistance(movedKm);
      }
    }
    lastFgCoordsRef.current = { lat, lng };

    // Distance gate — skip database write if rider hasn't moved enough
    if (lastCoordsRef.current) {
      const moved = distanceMetres(
        lastCoordsRef.current.lat, lastCoordsRef.current.lng, lat, lng,
      );
      if (moved < TRACKING_DISTANCE_INTERVAL_M) return;
    }

    lastCoordsRef.current = { lat, lng };

    // Write to RTDB — exact path + payload
    await writeTrackingToRTDB(uid, loc.coords);

    // Sync AsyncStorage so the background task shares the same "last" point
    await AsyncStorage.setItem('bg_last_coords', JSON.stringify({
      lat, lng,
      heading: h ?? null,
      speed: s ?? 0,
      timestamp: loc.timestamp,
    }));
  };

  // ─── Start tracking ────────────────────────────────────────────────────────
  const startTracking = async () => {
    if (!rider?.uid) return;
    setLocationError(null);

    // 1. Foreground permission
    const hasFg = await requestForegroundPermission();
    if (!hasFg) {
      setLocationError('Location permission denied. Please enable it in Settings.');
      return;
    }

    // 2. Persist riderId so the BG task can read it
    await AsyncStorage.setItem('tracking_rider_id', rider.uid);

    // 3. Foreground subscription — position
    fgSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        // Raw GPS accuracy is ~3–5 m; 2 m avoids noise-driven updates while
        // still being extremely real-time for navigation and speed.
        distanceInterval: 2,
        timeInterval: 2000,
      },
      (loc) => onLocationUpdate(rider.uid, loc),
    );

    // 4. Foreground subscription — heading (throttled to avoid re-renders)
    const lastHeadingTs = { current: 0 };
    headingSubRef.current = await Location.watchHeadingAsync((h) => {
      const now = Date.now();
      if (now - lastHeadingTs.current < 500) return;
      lastHeadingTs.current = now;
      const deg = Math.round(h.trueHeading >= 0 ? h.trueHeading : h.magHeading);
      if (deg >= 0) setHeading(deg);
    });

    // 5. Background permission + task
    const hasBg = await requestBackgroundPermission();
    if (hasBg) {
      const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)
        .catch(() => false);
      if (!running) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          // BG: raw gps interval — actual RTDB writes are still distance-gated
          // in the task handler, so 15 m here is just the GPS wakeup interval.
          distanceInterval: 15,
          timeInterval: 5000,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Graam Rider',
            notificationBody: 'Live location tracking is active',
            notificationColor: '#22d47a',
          },
        });
      }
    }

    setIsTracking(true);
  };

  // ─── Stop tracking ─────────────────────────────────────────────────────────
  const stopTracking = async () => {
    // Remove foreground subscriptions
    fgSubscriptionRef.current?.remove();
    fgSubscriptionRef.current = null;
    headingSubRef.current?.remove();
    headingSubRef.current = null;

    lastCoordsRef.current = null;
    lastFgCoordsRef.current = null;

    // Stop background task
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch {}

    // Clean up persisted state
    await AsyncStorage.multiRemove(['tracking_rider_id', 'bg_last_coords']);

    setIsTracking(false);
  };

  // ─── React to duty status changes ──────────────────────────────────────────
  useEffect(() => {
    if (rider?.dutyStatus === 'online') {
      startTracking();
    } else {
      stopTracking();
    }
    return () => { stopTracking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider?.dutyStatus, rider?.uid]);

  const value = React.useMemo(() => ({
    currentLocation, heading, speed, locationError, isTracking, startTracking, stopTracking,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [currentLocation, heading, speed, locationError, isTracking]);

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within a LocationProvider');
  return ctx;
}