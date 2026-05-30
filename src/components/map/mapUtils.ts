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

export const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
  { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#2f3948" }] },
  { "featureType": "transit.station", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
  { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];

export const translateInstruction = (instruction: string, lang: string) => {
  if (!instruction || lang !== 'bn') return instruction;

  let bn = instruction;

  // 1. Core turn directions
  bn = bn.replace(/Turn left/i, 'বামে মোড় নিন');
  bn = bn.replace(/Turn right/i, 'ডানে মোড় নিন');
  bn = bn.replace(/Keep left/i, 'বামে থাকুন');
  bn = bn.replace(/Keep right/i, 'ডানে থাকুন');
  bn = bn.replace(/Slight left/i, 'সামান্য বামে যান');
  bn = bn.replace(/Slight right/i, 'সামান্য ডানে যান');
  bn = bn.replace(/Sharp left/i, 'তীক্ষ্ণ বামে মোড় নিন');
  bn = bn.replace(/Sharp right/i, 'তীক্ষ্ণ ডানে মোড় নিন');
  
  // 2. Roundabout exits
  bn = bn.replace(/At the roundabout, take the (\d+)(st|nd|rd|th) exit/i, (_, exit) => {
    return `গোলচত্বরে পৌঁছে ${exit} নম্বর এক্সিট দিয়ে বের হন`;
  });
  bn = bn.replace(/At the roundabout, continue straight/i, 'গোলচত্বর দিয়ে সোজা এগিয়ে যান');

  // 3. General movements
  bn = bn.replace(/Head northwest/i, 'উত্তর-পশ্চিম দিকে এগিয়ে যান');
  bn = bn.replace(/Head northeast/i, 'উত্তর-পূর্ব দিকে এগিয়ে যান');
  bn = bn.replace(/Head southwest/i, 'দক্ষিণ-পশ্চিম দিকে এগিয়ে যান');
  bn = bn.replace(/Head southeast/i, 'দক্ষিণ-পূর্ব দিকে এগিয়ে যান');
  bn = bn.replace(/Head north/i, 'উত্তর দিকে এগিয়ে যান');
  bn = bn.replace(/Head south/i, 'দক্ষিণ দিকে এগিয়ে যান');
  bn = bn.replace(/Head east/i, 'পূর্ব দিকে এগিয়ে যান');
  bn = bn.replace(/Head west/i, 'পশ্চিম দিকে এগিয়ে যান');
  bn = bn.replace(/Go straight/i, 'সোজা যান');
  bn = bn.replace(/Continue straight/i, 'সোজা এগিয়ে যান');
  bn = bn.replace(/Continue/i, 'এগিয়ে যান');
  
  // 4. Prepositions / Junctions
  bn = bn.replace(/onto/i, 'এ');
  bn = bn.replace(/toward/i, 'এর দিকে');
  bn = bn.replace(/Merge/i, 'মিলিত হন');
  bn = bn.replace(/Take the ramp/i, 'র‌্যাম্পে উঠুন');

  return bn;
};
