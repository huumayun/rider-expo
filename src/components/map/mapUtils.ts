import { StyleSheet } from 'react-native';

export const FONT_EN = 'Nunito_800ExtraBold';

export const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  assigned: '#8b5cf6',
  accepted: '#10b981',
  arrived_at_branch: '#3b82f6',
  picked_up: '#10b981',
  arrived_at_customer: '#3b82f6',
  delivered: '#6366f1',
  cancelled: '#ef4444',
  returning_to_branch: '#f97316',
  returning_at_branch: '#f97316',
  returned: '#64748b',
};

export const statusLabels: any = {
  pending: { en: 'Pending', bn: 'অপেক্ষমান' },
  assigned: { en: 'New Order', bn: 'নতুন অর্ডার' },
  accepted: { en: 'Accepted', bn: 'গৃহীত' },
  arrived_at_branch: { en: 'At Branch', bn: 'ব্রাঞ্চে আছে' },
  picked_up: { en: 'In Transit', bn: 'রাস্তায় আছে' },
  arrived_at_customer: { en: 'At Customer', bn: 'কাস্টমারের কাছে' },
  delivered: { en: 'Delivered', bn: 'ডেলিভারি হয়েছে' },
  returning_to_branch: { en: 'Returning', bn: 'ফেরত যাচ্ছে' },
  returning_at_branch: { en: 'At Branch (Ret)', bn: 'ব্রাঞ্চে (ফেরত)' },
  returned: { en: 'Returned', bn: 'ফেরত এসেছে' },
};

export const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const fmtDist = (km: number) => {
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  return `${km.toFixed(1)} km`;
};

export const calculateHeading = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
};

export const snapToPolyline = (point: { lat: number; lng: number }, polyline: any[]) => {
  if (!polyline || polyline.length < 2) return point;

  let minDist = Infinity;
  let snappedPoint = point;

  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];

    const closest = getClosestPointOnSegment(
      point.lat,
      point.lng,
      p1.latitude || p1.lat,
      p1.longitude || p1.lng,
      p2.latitude || p2.lat,
      p2.longitude || p2.lng
    );

    const d = calcDist(point.lat, point.lng, closest.lat, closest.lng);
    if (d < minDist) {
      minDist = d;
      snappedPoint = closest;
    }
  }

  // Only snap if within 50 meters to avoid jumping across parallel roads or if way off track
  if (minDist > 0.05) return point;

  return snappedPoint;
};

const getClosestPointOnSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return { lat: x1, lng: y1 };

  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  if (t < 0) return { lat: x1, lng: y1 };
  if (t > 1) return { lat: x2, lng: y2 };

  return { lat: x1 + t * dx, lng: y1 + t * dy };
};
