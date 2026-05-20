import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { db } from '../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { GOOGLE_MAPS_API_KEY } from '../config/firebase';
import { calcDist } from '../utils/mapUtils';
import { shouldRefetch } from '../utils/mapsThrottle';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKGROUND_TRACKING_TASK = 'RIDER_LOCATION_TRACKING';
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || GOOGLE_MAPS_API_KEY;

export interface LatLng {
  lat: number;
  lng: number;
}

interface GoogleMapsResult {
  distance: string;
  duration: string;
  polyline: LatLng[];
}

// Global cache for Google API results
const apiCache = new Map<string, GoogleMapsResult>();

// Polyline Decoder (Inline)
const decodePolyline = (encoded: string): LatLng[] => {
  const points: LatLng[] = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
};

// Heading Calculation
const calculateHeading = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
};

// Background Task Definition
TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('[Background Task Error]:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const loc = locations[0];
    if (loc) {
      const riderId = await AsyncStorage.getItem('active_rider_id');
      if (riderId) {
        // Sync with foreground by writing to storage or just updating firestore directly
        // User wants max every 3s, but background tasks usually have higher intervals.
        // We update Firestore here to ensure background tracking persistence.
        try {
          const docRef = doc(db, 'riders', riderId);
          await updateDoc(docRef, {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            heading: loc.coords.heading || 0,
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
          console.error('[BG Firestore Update Failed]:', e);
        }
      }
    }
  }
});

export const useGoogleMaps = (riderId: string, destination: LatLng | null, origin?: LatLng | null) => {
  const [livePos, setLivePos] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [distance, setDistance] = useState<string>('--');
  const [duration, setDuration] = useState<string>('--');
  const [polyline, setPolyline] = useState<LatLng[]>([]);

  const lastApiPos = useRef<LatLng | null>(null);
  const lastFetchTime = useRef<number>(0);
  const lastFirestoreTime = useRef<number>(0);
  const lastHeadingPos = useRef<LatLng | null>(null);

  // Determine the effective origin (provided origin or live GPS position)
  const effectiveOrigin = origin || livePos;

  useEffect(() => {
    if (riderId) {
      AsyncStorage.setItem('active_rider_id', riderId);
    }
  }, [riderId]);

  const updateFirestore = async (lat: number, lng: number, currentHeading: number) => {
    const now = Date.now();
    if (now - lastFirestoreTime.current < 3000) return;

    lastFirestoreTime.current = now;
    try {
      const docRef = doc(db, 'riders', riderId);
      await updateDoc(docRef, {
        lat,
        lng,
        heading: currentHeading,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('[Firestore Update Error]:', e);
    }
  };

  const fetchGoogleData = async (origin: LatLng, dest: LatLng) => {
    if (!GOOGLE_API_KEY) return;

    const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)},${dest.lat.toFixed(4)},${dest.lng.toFixed(4)}`;
    if (apiCache.has(cacheKey)) {
      const cached = apiCache.get(cacheKey)!;
      setDistance(cached.distance);
      setDuration(cached.duration);
      setPolyline(cached.polyline);
      lastFetchTime.current = Date.now();
      return;
    }

    try {
      lastFetchTime.current = Date.now();
      const originStr = `${origin.lat},${origin.lng}`;
      const destStr = `${dest.lat},${dest.lng}`;

      // Call Directions API for polyline and basic distance/duration
      const dirRes = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${GOOGLE_API_KEY}`
      );
      const dirData = await dirRes.json();

      // Call Distance Matrix API for more accurate/specific duration/distance if needed (as requested)
      const distRes = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${GOOGLE_API_KEY}`
      );
      const distData = await distRes.json();

      if (dirData.status === 'OK' && distData.status === 'OK') {
        const route = dirData.routes[0];
        const matrix = distData.rows[0].elements[0];

        const result: GoogleMapsResult = {
          distance: matrix.distance.text,
          duration: matrix.duration.text,
          polyline: decodePolyline(route.overview_polyline.points),
        };

        apiCache.set(cacheKey, result);
        setDistance(result.distance);
        setDuration(result.duration);
        setPolyline(result.polyline);
      }
    } catch (e) {
      console.error('[Google API Error]:', e);
    }
  };

  useEffect(() => {
    let fgSub: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') return;

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus === 'granted') {
        await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000,
          distanceInterval: 10,
          foregroundService: {
            notificationTitle: 'Rider App',
            notificationBody: 'Tracking your delivery route...',
          },
        });
      }

          fgSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 5,
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          const currentPos = { lat: latitude, lng: longitude };
          setLivePos(currentPos);

          // Calculate heading
          if (lastHeadingPos.current) {
            const newHeading = calculateHeading(
              lastHeadingPos.current.lat,
              lastHeadingPos.current.lng,
              latitude,
              longitude
            );
            setHeading(newHeading);
            updateFirestore(latitude, longitude, newHeading);
          } else {
            updateFirestore(latitude, longitude, 0);
          }
          lastHeadingPos.current = currentPos;

          // Check if moved 500m for Google API call
          if (destination) {
            const currentOrigin = origin || currentPos;
            if (!lastApiPos.current || shouldRefetch(lastApiPos.current, currentOrigin, lastFetchTime.current)) {
              lastApiPos.current = currentOrigin;
              fetchGoogleData(currentOrigin, destination);
            }
          }
        }
      );
    };

    startTracking();

    return () => {
      if (fgSub) fgSub.remove();
      Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => {});
    };
  }, [riderId, destination, origin]);

  // Also trigger API call when manual origin changes and exceeds threshold
  useEffect(() => {
    if (origin && destination) {
      if (!lastApiPos.current || shouldRefetch(lastApiPos.current, origin, lastFetchTime.current)) {
        lastApiPos.current = origin;
        fetchGoogleData(origin, destination);
      }
    }
  }, [origin, destination]);

  return { distance, duration, polyline, heading, livePos };
};
