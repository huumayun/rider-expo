export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Calculates the distance between two points in meters using the Haversine formula.
 * Inline implementation to avoid external dependencies.
 */
const getDistanceInMeters = (p1: LatLng, p2: LatLng): number => {
  const R = 6371e3; // Earth's radius in meters
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Determines if a new Google Maps API fetch should be triggered.
 * Returns true only if the rider moved > 500m AND > 30 seconds have passed.
 */
export const shouldRefetch = (
  prevPos: LatLng,
  newPos: LatLng,
  lastFetchTime: number
): boolean => {
  const now = Date.now();
  const timeElapsed = now - lastFetchTime;
  const distanceMoved = getDistanceInMeters(prevPos, newPos);

  return distanceMoved > 500 && timeElapsed > 30000;
};

/**
 * Formats a distance in meters to a human-readable string.
 * Example: 850m or 3.2 km
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
};
