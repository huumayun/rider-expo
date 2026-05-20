import React, {
  createContext, useContext, useEffect, useRef, ReactNode,
} from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { BACKGROUND_LOCATION_TASK } from '../config/constants';
import { useAuthStore } from '../store/authStore';
import { useLocationStore } from '../store/locationStore';

// ─── Background task definition (must be at module top level) ─────────────────
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) { console.error('[BG Location]', error); return; }
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  const loc = locations?.[0];
  if (!loc) return;

  try {
    // Relay to AsyncStorage so the foreground can pick it up too
    await AsyncStorage.setItem('bg_location_relay', JSON.stringify({
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      heading: loc.coords.heading ?? null,
      timestamp: loc.timestamp,
    }));
  } catch {}
});

// ─── Context types (Maintained for backward compatibility) ───────────────────
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
    setCurrentLocation, setHeading, setSpeed, setLocationError, setIsTracking 
  } = useLocationStore();

  const fgSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHeadingTs = useRef<number>(0); // throttle heading updates

  // Save to Firestore (debounced — at most once per 15s)
  const saveToFirestore = (uid: string, lat: number, lng: number) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'employees', uid), {
          currentLocation: { lat, lng },
          locationUpdatedAt: new Date().toISOString(),
        });
        const dateKey = new Date().toISOString().slice(0, 10);
        const routeKey = `route_${uid}_${dateKey}`;
        const existing = await AsyncStorage.getItem(routeKey);
        const route = existing ? JSON.parse(existing) : [];
        route.push({ lat, lng, ts: Date.now() });
        await AsyncStorage.setItem(routeKey, JSON.stringify(route.slice(-500)));
      } catch {}
    }, 15000);
  };

  const onLocationUpdate = (uid: string, loc: Location.LocationObject) => {
    const { latitude: lat, longitude: lng, heading: h, speed: s } = loc.coords;
    setCurrentLocation({ lat, lng });
    if (h !== null && h !== undefined && h >= 0) setHeading(h);
    setSpeed(s ?? 0);
    saveToFirestore(uid, lat, lng);
  };

  const startTracking = async () => {
    if (!rider?.uid) return;
    setLocationError(null);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError('Location permission denied');
      return;
    }

    fgSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 3,
        timeInterval: 1000,
      },
      (loc) => onLocationUpdate(rider.uid, loc)
    );

    headingSubscriptionRef.current = await Location.watchHeadingAsync((h) => {
      const now = Date.now();
      if (now - lastHeadingTs.current < 500) return; // throttle to 2/s max
      lastHeadingTs.current = now;
      const newHeading = Math.round(h.trueHeading >= 0 ? h.trueHeading : h.magHeading);
      if (newHeading >= 0) setHeading(newHeading);
    });

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus === 'granted') {
      const taskRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
      if (!taskRunning) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 10,
          timeInterval: 5000,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Graam Rider',
            notificationBody: 'Location tracking active for delivery',
            notificationColor: '#22d47a',
          },
        });
      }
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const raw = await AsyncStorage.getItem('bg_location_relay');
        if (!raw) return;
        const { lat, lng, heading: h, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < 30000) {
          setCurrentLocation({ lat, lng });
          if (h !== null && h >= 0) setHeading(h);
        }
      } catch {}
    }, 10000);

    setIsTracking(true);
  };

  const stopTracking = async () => {
    fgSubscriptionRef.current?.remove();
    fgSubscriptionRef.current = null;
    headingSubscriptionRef.current?.remove();
    headingSubscriptionRef.current = null;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    try {
      const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch {}

    setIsTracking(false);
  };

  useEffect(() => {
    if (rider?.dutyStatus === 'online') {
      startTracking();
    } else {
      stopTracking();
    }
    return () => { stopTracking(); };
  }, [rider?.dutyStatus, rider?.uid]);

  // The context value now just provides a stable interface to the store
  const value = React.useMemo(() => ({
    currentLocation, heading, speed, locationError, isTracking, startTracking, stopTracking
  }), [currentLocation, heading, speed, locationError, isTracking]);

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}