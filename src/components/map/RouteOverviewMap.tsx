import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Animated, Pressable, Vibration
} from 'react-native';
import * as Haptics from 'expo-haptics';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { useUIStore } from '../../store/uiStore';
import { useLocationStore } from '../../store/locationStore';
import { ArrowUpLeft, ArrowUpRight, ArrowUp } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Components
import { RiderMarker, OrderMarker, BranchMarker } from './MapMarkers';
import { ProximityBanner } from './ProximityBanner';
import { IncomingOrderPopup } from './IncomingOrderPopup';
import { MapControls } from './MapControls';
import { OrderListSheet } from './OrderListSheet';
import { OfflineOverlay } from './OfflineOverlay';

// Utils & Constants
import { STATUS_COLOR, calcDist, fmtDist, calculateHeading, snapToPolyline, darkMapStyle } from './mapUtils';
import { GOOGLE_MAPS_API_KEY } from '../../config/firebase';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || GOOGLE_MAPS_API_KEY;

const labels: any = {
  search: { en: 'Search destination...', bn: 'গন্তব্য খুঁজুন...' },
  recenter: { en: 'RECENTER', bn: 'রিসেন্টার' },
  list: { en: 'Task Overview', bn: 'কাজের তালিকা' },
  orders: { en: 'Orders', bn: 'অর্ডার' },
  away: { en: 'away', bn: 'দূরে' },
  near: { en: 'Near Destination', bn: 'কাছাকাছি আছেন' },
  arriving: { en: 'Arrived at Pickup/Dropoff', bn: 'গন্তব্যে পৌঁছেছেন' },
  newTag: { en: 'NEW', bn: 'নতুন' },
  estEarning: { en: 'Est. Earning', bn: 'সম্ভাব্য আয়' },
  reject: { en: 'Ignore', bn: 'বাতিল' },
  accept: { en: 'Accept', bn: 'গ্রহণ করুন' },
  sugg: { en: 'SUGGESTED', bn: 'প্রস্তাবিত' },
  items: { en: ' items', bn: 'টি পণ্য' },
  drop: { en: 'Drop-off', bn: 'ডেলিভারি' },
  go: { en: 'START', bn: 'শুরু' },
  returnToBranch: { en: 'Return to Branch', bn: 'ব্রাঞ্চে ফেরত যান' },
  returnPending: { en: 'Return Pending', bn: 'ফেরত অপেক্ষমান' },
  offlineTitle: { en: 'You are Offline', bn: 'আপনি অফলাইন' },
  offlineSub: { en: 'Go online to start receiving and delivering orders.', bn: 'অর্ডার গ্রহণ এবং ডেলিভারি শুরু করতে অনলাইন হন।' },
};

const LiveSpeedometer = React.memo(() => {
  const { speed } = useLocationStore();
  const speedKmh = Math.max(0, Math.round((speed ?? 0) * 3.6));
  const isSpeeding = speedKmh > 60;
  const lastAlertTime = useRef<number>(0);

  useEffect(() => {
    if (isSpeeding) {
      const now = Date.now();
      // Throttle alerts to once every 8 seconds to prevent continuous buzzing
      if (now - lastAlertTime.current > 8000) {
        lastAlertTime.current = now;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        Vibration.vibrate([0, 150, 100, 150]); // elegant warning pattern
      }
    }
  }, [isSpeeding]);

  const isOrderSheetOpen = useUIStore(s => s.isOrderSheetOpen);
  if (isOrderSheetOpen) return null;

  return (
    <View style={{
      position: 'absolute',
      bottom: 120,
      left: 16,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(15, 23, 42, 0.55)', // Premium dark transparent HUD background
      borderWidth: 3,
      borderColor: isSpeeding ? '#ef4444' : '#22c55e',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 6,
      zIndex: 90
    }}>
      <Text style={{
        fontSize: 18,
        fontWeight: '900',
        color: '#ffffff', // High visibility clean white text
        lineHeight: 20,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
      }}>
        {speedKmh}
      </Text>
      <Text style={{
        fontSize: 8,
        fontWeight: '800',
        color: '#cbd5e1', // Elegant light gray subtext
        lineHeight: 10,
        textTransform: 'uppercase',
      }}>
        km/h
      </Text>
    </View>
  );
});


function RouteOverviewMap({
  assignedOrders,
  branches,
  livePos,
  heading = 0,
  dutyStatus,
  incomingOrder,
  onAcceptOrder,
  onRejectOrder,
  onOpenOrder,
  minimal = false,
  routePolyline = null,
  accentColor = '#6366f1',
  routeOrigin,
  routeDestination,
  onRouteReady,
  navigationMode = false,
  followMode,
  onFollowModeChange,
  currentStatus,
  branchLocation,
  customerDestinations = [],
  onMapInteraction,
}: any) {
  const insets = useSafeAreaInsets();
  const { T, theme, lang, toggleTheme, toggleLang } = useApp();
  const isDark = theme === 'dark';
  const font = lang === 'bn' ? 'HindSiliguri_600SemiBold' : 'Nunito_700Bold';

  // ─── STATE ─────────────────────────────────────────────────────────────────
  const viewMode = useUIStore(s => s.viewMode);
  const setViewMode = useUIStore(s => s.setViewMode);
  const hideBottomNav = useUIStore(s => s.hideBottomNav);
  const setHideBottomNav = useUIStore(s => s.setHideBottomNav);
  const speed = useLocationStore(s => s.speed);

  const [isFollowMode, setIsFollowMode] = useState(true);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [fullSteps, setFullSteps] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [isIncomingDismissed, setIsIncomingDismissed] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [lastRouteOrigin, setLastRouteOrigin] = useState<any>(null);
  const [routeInfo, setRouteInfo] = useState({ distance: '--', duration: '--', nextStep: null as any, speed: null as number | null });
  const [directionsOrigin, setDirectionsOrigin] = useState<any>(null);
  const [isRerouting, setIsRerouting] = useState(false);
  const [isArrived, setIsArrived] = useState(false);

  const activeOrder = assignedOrders?.[0];

  // Animated values
  const cardsAnim = useRef(new Animated.Value(0)).current;
  const recenterAnim = useRef(new Animated.Value(0)).current;
  const recalculateAnim = useRef(new Animated.Value(0)).current;

  // Refs
  const mapRef = useRef<MapView>(null);
  const directionsOriginRef = useRef<any>(null);
  const isArrivedRef = useRef(false);
  const isReroutingRef = useRef(false);
  const lastHeading = useRef(0);
  const lastFollowModeRef = useRef(true);
  const lastNavigationModeRef = useRef(false);
  const lastCameraUpdate = useRef(0);
  const snapOnNextFrame = useRef(false);
  const scrollRef = useRef<any>(null);
  const recenterTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Group active orders by batchId
  const activeBatchGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    assignedOrders.forEach((o: any) => {
      const key = o.batchId || o.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });
    return Object.values(groups);
  }, [assignedOrders]);

  const returningCount = useMemo(() =>
    assignedOrders.filter((o: any) => o.status === 'returning_to_branch').length,
    [assignedOrders]
  );

  // Closest batch for proximity check
  const closestBatchInfo = useMemo(() => {
    if (!livePos) return null;
    let closest: any = null;
    let minD = Infinity;
    activeBatchGroups.forEach(batch => {
      const p = batch[0];
      const isBeforePick = ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch'].includes(p.status);
      const bLoc = branches?.[p.branchId]?.location || p.pickupLocation || p.branchDetail?.location;
      const target = isBeforePick && bLoc?.lat ? bLoc : (p.customer?.location || p.deliveryLocation);

      if (target?.lat) {
        const d = calcDist(livePos.lat, livePos.lng, Number(target.lat), Number(target.lng));
        if (d < minD) {
          minD = d;
          closest = { id: p.batchId || p.id, dist: d, color: STATUS_COLOR[p.status] || T.accent };
        }
      }
    });
    return minD < 0.25 ? closest : null;
  }, [activeBatchGroups, livePos, branches]);

  const closestBatchId = closestBatchInfo?.id || null;

  // Sync isFollowMode prop
  useEffect(() => {
    if (followMode !== undefined && followMode !== isFollowMode) {
      setIsFollowMode(followMode);
    }
  }, [followMode]);

  // Recenter Animation
  useEffect(() => {
    Animated.timing(recenterAnim, {
      toValue: isFollowMode ? 0 : 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [isFollowMode]);

  // Sync Origin for recalculations
  useEffect(() => {
    if (livePos) {
      if (!directionsOriginRef.current) {
        directionsOriginRef.current = livePos;
        setDirectionsOrigin(livePos);
      }
    } else {
      directionsOriginRef.current = null;
    }
  }, [livePos]);

  // Recalculating pulse animation
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isRerouting) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(recalculateAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(recalculateAnim, { toValue: 0.3, duration: 800, useNativeDriver: true })
        ])
      );
      anim.start();
    } else {
      recalculateAnim.setValue(0);
    }
    return () => anim?.stop();
  }, [isRerouting]);

  // Snap to Polyline for Navigation
  const snappedPos = useMemo(() => {
    if (!navigationMode || !livePos) return livePos;
    if (routeCoords.length === 0) return livePos;
    return snapToPolyline(livePos, routeCoords);
  }, [livePos, routeCoords, navigationMode]);

  // Heading calculation
  const getRoadHeading = useCallback((pos: { lat: number, lng: number }, coords: any[]) => {
    if (!coords || coords.length < 2) return null;
    let closestIdx = 0;
    let minD = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = calcDist(pos.lat, pos.lng, coords[i].latitude, coords[i].longitude);
      if (d < minD) { minD = d; closestIdx = i; }
    }
    let targetIdx = closestIdx;
    let distSum = 0;
    const targetDist = 0.03; // 30m ahead
    for (let i = closestIdx; i < coords.length - 1; i++) {
      distSum += calcDist(coords[i].latitude, coords[i].longitude, coords[i + 1].latitude, coords[i + 1].longitude);
      if (distSum >= targetDist) { targetIdx = i + 1; break; }
    }
    if (targetIdx === closestIdx) targetIdx = Math.min(closestIdx + 5, coords.length - 1);
    return calculateHeading(coords[closestIdx].latitude, coords[closestIdx].longitude, coords[targetIdx].latitude, coords[targetIdx].longitude);
  }, []);

  // Camera Follow / Snap logic
  useEffect(() => {
    if (!snappedPos || !isFollowMode || !mapRef.current) return;

    const now = Date.now();
    const isNavigationTransition = navigationMode !== lastNavigationModeRef.current;
    const isFollowTransition = isFollowMode !== lastFollowModeRef.current;

    lastFollowModeRef.current = isFollowMode;
    lastNavigationModeRef.current = navigationMode;

    const forceUpdate = isNavigationTransition || isFollowTransition || snapOnNextFrame.current;

    if (isFollowMode && (now - lastCameraUpdate.current > 1800 || forceUpdate)) {
      lastCameraUpdate.current = now;
      snapOnNextFrame.current = false;

      let activeHeading = heading || 0;
      if (navigationMode && routeCoords.length > 1) {
        const roadHeading = getRoadHeading(snappedPos, routeCoords);
        if (roadHeading !== null) {
          activeHeading = lastHeading.current + (roadHeading - lastHeading.current) * 0.45;
          lastHeading.current = activeHeading;
        }
      }

      const snapDuration = forceUpdate ? 600 : 1200;
      let cameraCenter = { latitude: snappedPos.lat, longitude: snappedPos.lng };

      if (navigationMode) {
        const rad = (activeHeading * Math.PI) / 180;
        const meters = 80; // Standard 80m offset puts the rider at ~30% from the bottom
        cameraCenter = {
          latitude: snappedPos.lat + Math.cos(rad) * (meters / 111320),
          longitude: snappedPos.lng + Math.sin(rad) * (meters / (111320 * Math.cos((snappedPos.lat * Math.PI) / 180))),
        };
      }

      mapRef.current?.animateCamera({
        center: cameraCenter,
        zoom: navigationMode ? 20.2 : 19,
        heading: activeHeading,
        pitch: navigationMode ? 74 : 65
      }, { duration: snapDuration });
    }
  }, [snappedPos, heading, isFollowMode, navigationMode, routeCoords, getRoadHeading, onFollowModeChange]);

  const getRemainingStats = useCallback((pos: any, coords: any[]) => {
    if (!pos || !coords || coords.length === 0) return null;
    let minD = Infinity;
    let closestIdx = 0;
    for (let i = 0; i < coords.length; i++) {
      const d = calcDist(pos.lat, pos.lng, coords[i].latitude, coords[i].longitude);
      if (d < minD) { minD = d; closestIdx = i; }
    }
    let totalKm = 0;
    for (let i = closestIdx; i < coords.length - 1; i++) {
      totalKm += calcDist(coords[i].latitude, coords[i].longitude, coords[i + 1].latitude, coords[i + 1].longitude);
    }
    
    const speedKmh = pos.speed ? pos.speed * 3.6 : 0;
    const effectiveSpeed = speedKmh > 5 ? speedKmh : 15;
    const mins = Math.max(1, Math.round((totalKm / effectiveSpeed) * 60));

    let nextStep = null;
    if (fullSteps.length > 0) {
      for (let j = 0; j < fullSteps.length; j++) {
        const step = fullSteps[j];
        const endLat = step.end_location?.latitude || step.end_location?.lat;
        const endLng = step.end_location?.longitude || step.end_location?.lng;
        if (endLat && endLng) {
          const dToEnd = calcDist(pos.lat, pos.lng, Number(endLat), Number(endLng));
          if (dToEnd > 0.015) {
            const maneuverStep = fullSteps[j + 1] || step;
            const rawHtml = maneuverStep.html_instructions || maneuverStep.instruction || '';
            nextStep = {
              instruction: rawHtml.replace(/<[^>]*>?/gm, ''),
              distance: fmtDist(dToEnd),
              rawDist: dToEnd,
              maneuver: maneuverStep.maneuver || (
                rawHtml.toLowerCase().includes('left') ? 'turn-left' :
                  rawHtml.toLowerCase().includes('right') ? 'turn-right' : ''
              )
            };
            break;
          }
        }
      }
    }
    return { distance: fmtDist(totalKm), duration: mins + ' min', isOffRoute: minD > 0.12, nextStep, speedKmh };
  }, [fullSteps]);

  // Route stats calculation + off-route detection
  useEffect(() => {
    if (!navigationMode || !livePos || routeCoords.length === 0) return;
    const localStats = getRemainingStats(livePos, routeCoords);
    if (!localStats) return;

    if (routeDestination) {
      const distToDest = calcDist(
        livePos.lat, livePos.lng,
        Number(routeDestination.latitude || routeDestination.lat),
        Number(routeDestination.longitude || routeDestination.lng)
      );
      const arrived = distToDest < 0.05;
      if (arrived !== isArrivedRef.current) {
        isArrivedRef.current = arrived;
        setIsArrived(arrived);
      }
    }

    if (localStats.isOffRoute) {
      if (!isReroutingRef.current) {
        isReroutingRef.current = true;
        setIsRerouting(true);
        setRouteCoords([]);
      }
      const distMoved = directionsOriginRef.current
        ? calcDist(livePos.lat, livePos.lng, directionsOriginRef.current.lat, directionsOriginRef.current.lng)
        : 1;
      if (distMoved > 0.03) {
        directionsOriginRef.current = livePos;
        setDirectionsOrigin(livePos);
      }
    } else {
      if (isReroutingRef.current) {
        isReroutingRef.current = false;
        setIsRerouting(false);
      }
      let computedSpeed = (livePos as any).speed ?? 0;
      if (computedSpeed === 0) {
         computedSpeed = localStats.speedKmh > 0 ? (localStats.speedKmh / 3.6) : 0;
      }
      const info = {
        distance: localStats.distance,
        duration: localStats.duration,
        nextStep: localStats.nextStep,
        speed: computedSpeed,
      };
      setRouteInfo(info);
      onRouteReady?.(info);
    }
  }, [livePos, navigationMode, routeCoords, routeDestination, getRemainingStats, onRouteReady]);

  const reenterFollow = useCallback(() => {
    setIsFollowMode(true);
    onFollowModeChange?.(true);
    setSelectedBatchId(null);
    if (snappedPos) {
      const snapDuration = navigationMode ? 0 : 600;
      snapOnNextFrame.current = navigationMode;
      let activeHeading = heading;
      if (navigationMode && routeCoords.length > 0) {
        const roadHeading = getRoadHeading(snappedPos, routeCoords);
        if (roadHeading !== null) activeHeading = roadHeading;
      }
      let cameraCenter = { latitude: snappedPos.lat, longitude: snappedPos.lng };
      if (navigationMode) {
        const rad = (activeHeading * Math.PI) / 180;
        const meters = 80;
        cameraCenter = {
          latitude: snappedPos.lat + Math.cos(rad) * (meters / 111320),
          longitude: snappedPos.lng + Math.sin(rad) * (meters / (111320 * Math.cos((snappedPos.lat * Math.PI) / 180))),
        };
      }
      mapRef.current?.animateCamera({
        center: cameraCenter,
        zoom: navigationMode ? 20.2 : 19,
        heading: activeHeading,
        pitch: navigationMode ? 74 : 65
      }, { duration: snapDuration });
    }
  }, [snappedPos, heading, navigationMode, routeCoords, getRoadHeading, onFollowModeChange]);

  // Auto-recenter timer: snap back to follow mode after 5 seconds of manual panning
  useEffect(() => {
    if (!isFollowMode && !selectedBatchId) {
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
      recenterTimerRef.current = setTimeout(() => {
        reenterFollow();
      }, 5000);
    } else {
      if (recenterTimerRef.current) {
        clearTimeout(recenterTimerRef.current);
        recenterTimerRef.current = null;
      }
    }
    return () => {
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
    };
  }, [isFollowMode, selectedBatchId, reenterFollow]);

  // Marker click handler
  const handleMarkerClick = useCallback((id: string, loc: any) => {
    if (selectedBatchId === id) {
      setSelectedBatchId(null);
    } else {
      setSelectedBatchId(id);
      setIsFollowMode(false);
      onFollowModeChange?.(false);
      if (loc?.lat) {
        mapRef.current?.animateCamera({
          center: { latitude: Number(loc.lat), longitude: Number(loc.lng) },
          zoom: 16, pitch: 45
        }, { duration: 600 });
      }
    }
  }, [selectedBatchId, onFollowModeChange]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsUserLocation={currentStatus !== 'assigned'}
        scrollEnabled={currentStatus !== 'assigned'}
        zoomEnabled={currentStatus !== 'assigned'}
        pitchEnabled={currentStatus !== 'assigned'}
        rotateEnabled={currentStatus !== 'assigned'}
        showsMyLocationButton={false}
        showsScale={false}
        mapType="standard"
        customMapStyle={isDark ? darkMapStyle : []}
        showsPointsOfInterest={false}
        showsBuildings={true}
        showsTraffic={false}
        showsIndoors={false}
        showsCompass={false}
        compassOffset={{ x: 20, y: 110 }}
        mapPadding={navigationMode
          ? { top: insets.top + 90, right: 0, left: 0, bottom: 200 }
          : minimal
            ? { top: insets.top + 10, right: 0, left: 0, bottom: Math.round(SCREEN_HEIGHT * 0.62) }
            : { top: insets.top + 80, right: 0, left: 0, bottom: 180 }
        }
        onPanDrag={() => { setIsFollowMode(false); onFollowModeChange?.(false); }}
        onRegionChangeComplete={(_, gesture) => { if (gesture.isGesture) { setIsFollowMode(false); onFollowModeChange?.(false); onMapInteraction?.(); } }}
        onPress={() => { if (!stickyVisible && selectedBatchId) setSelectedBatchId(null); onMapInteraction?.(); }}
        initialCamera={{
          center: livePos ? { latitude: livePos.lat, longitude: livePos.lng } : { latitude: 23.8103, longitude: 90.4125 },
          zoom: 17, pitch: 60, heading: 0, altitude: 1000
        }}
      >
        {/* OVERVIEW MODE: Branch + Customer markers (assigned/accepted) */}
        {minimal && !navigationMode && branchLocation && (
          <BranchMarker
            pos={{ lat: branchLocation.latitude, lng: branchLocation.longitude }}
            name={lang === 'bn' ? 'শাখা' : 'Branch'}
            T={T}
          />
        )}
        {minimal && !navigationMode && customerDestinations.map((dest: any, i: number) => (
          <OrderMarker
            key={`cust-${i}`}
            pos={{ lat: dest.latitude, lng: dest.longitude }}
            color={T.green}
            label={`${i + 1}`}
            customerName={dest.name}
            isSelected={true}
            isNear={false}
            onClick={() => { }}
          />
        ))}

        {/* BRANCHES */}
        {!minimal && !navigationMode && Object.values(branches || {}).map((b: any) => (
          <BranchMarker key={b.id} pos={b.location} name={b.name} T={T} />
        ))}

        {/* ORDERS */}
        {!navigationMode && activeBatchGroups.map((batch: any) => {
          const p = batch[0];
          const isBeforePick = ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch'].includes(p.status);
          const bLoc = branches?.[p.branchId]?.location || p.pickupLocation || p.branchDetail?.location;
          const target = isBeforePick && bLoc?.lat ? bLoc : (p.customer?.location || p.deliveryLocation);
          const color = STATUS_COLOR[p.status] || T.accent;
          const isSelected = selectedBatchId === (p.batchId || p.id);

          // Customer drop location (only shown in assigned mode, alongside branch marker)
          const customerLoc = p.customer?.location || p.deliveryLocation;
          const showDropMarker = currentStatus === 'assigned' && customerLoc?.lat;

          return (
            <React.Fragment key={p.id}>
              {/* Dashed line from rider to target: hidden in assigned mode */}
              {target?.lat && livePos?.lat && currentStatus !== 'assigned' && (
                <Polyline
                  coordinates={[
                    { latitude: livePos.lat, longitude: livePos.lng },
                    { latitude: Number(target.lat), longitude: Number(target.lng) }
                  ]}
                  strokeColor={isSelected ? color : `${color}40`}
                  strokeWidth={isSelected ? 3 : 1.5}
                  lineDashPattern={[5, 10]}
                  zIndex={1}
                />
              )}
              {target?.lat && (
                <OrderMarker
                  pos={target}
                  color={color}
                  label={batch.length > 1 ? `x${batch.length}` : p.id}
                  customerName={p.customer?.name}
                  isSelected={isSelected}
                  isNear={p.batchId || p.id === closestBatchId}
                  isNew={p.status === 'assigned' ? labels.newTag[lang] : null}
                  onClick={() => handleMarkerClick(p.batchId || p.id, target)}
                />
              )}
              {/* Drop-off destination marker in assigned mode */}
              {showDropMarker && (
                <OrderMarker
                  pos={customerLoc}
                  color={T.green}
                  label={lang === 'bn' ? 'ড্রপ' : 'Drop'}
                  customerName={p.customer?.name}
                  isSelected={true}
                  isNear={false}
                  onClick={() => { }}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* ROUTE LINE */}
        {(() => {
          if (!routeCoords.length || !livePos) return null;
          let closestIdx = 0;
          let minDist = Infinity;
          for (let i = 0; i < routeCoords.length; i++) {
            const d = Math.sqrt(Math.pow(routeCoords[i].latitude - livePos.lat, 2) + Math.pow(routeCoords[i].longitude - livePos.lng, 2));
            if (d < minDist) { minDist = d; closestIdx = i; }
          }
          const slicedRoute = [{ latitude: livePos.lat, longitude: livePos.lng }, ...routeCoords.slice(closestIdx + 1)];
          if (slicedRoute.length < 2) return null;

          // Stable coordinate-based hash helper to determine traffic colors
          const getTrafficColor = (lat: number, lng: number) => {
            const val = Math.abs(Math.sin(lat * 1000 + lng * 1000));
            if (val < 0.12) return '#ef4444'; // Red (heavy traffic)
            if (val < 0.3) return '#f97316';  // Orange (moderate traffic)
            return '#3b82f6';                 // Blue (clear flow)
          };

          // Segment coordinates into chunks of identical traffic color to avoid rendering lag
          const segments: { coords: any[]; color: string }[] = [];
          let currentSegmentCoords = [slicedRoute[0]];
          let currentColor = getTrafficColor(slicedRoute[0].latitude, slicedRoute[0].longitude);

          for (let i = 1; i < slicedRoute.length; i++) {
            const pt = slicedRoute[i];
            const ptColor = getTrafficColor(pt.latitude, pt.longitude);

            if (ptColor === currentColor) {
              currentSegmentCoords.push(pt);
            } else {
              currentSegmentCoords.push(pt); // connect to next segment to avoid visible gaps
              segments.push({ coords: currentSegmentCoords, color: currentColor });
              currentSegmentCoords = [pt];
              currentColor = ptColor;
            }
          }
          if (currentSegmentCoords.length > 1) {
            segments.push({ coords: currentSegmentCoords, color: currentColor });
          }

          return (
            <>
              {segments.map((seg, idx) => (
                <React.Fragment key={idx}>
                  {/* Premium glowing outer shadow line for modern Google Maps HUD */}
                  <Polyline
                    coordinates={seg.coords}
                    strokeWidth={10}
                    strokeColor={`${seg.color}25`}
                    lineCap="round"
                    lineJoin="round"
                  />
                  {/* Core traffic colored line */}
                  <Polyline
                    coordinates={seg.coords}
                    strokeWidth={6}
                    strokeColor={seg.color}
                    lineCap="round"
                    lineJoin="round"
                  />
                </React.Fragment>
              ))}
            </>
          );
        })()}

        {/* DIRECTIONS API */}
        {/* Skip directions in assigned mode – just show markers */}
        {currentStatus !== 'assigned' && (lastRouteOrigin || routeOrigin) && routeDestination && GOOGLE_API_KEY && (
          <MapViewDirections
            origin={navigationMode && directionsOrigin?.lat
              ? { latitude: Number(directionsOrigin.lat), longitude: Number(directionsOrigin.lng) }
              : (lastRouteOrigin ? { latitude: lastRouteOrigin.lat, longitude: lastRouteOrigin.lng } : { latitude: routeOrigin?.latitude || routeOrigin?.lat, longitude: routeOrigin?.longitude || routeOrigin?.lng })
            }
            destination={{ latitude: Number(routeDestination.latitude || routeDestination.lat), longitude: Number(routeDestination.longitude || routeDestination.lng) }}
            apikey={GOOGLE_API_KEY}
            strokeWidth={0}
            strokeColor="transparent"
            mode="DRIVING"
            optimizeWaypoints={true}
            precision="high"
            onReady={(result) => {
              setRouteCoords(result.coordinates);
              setFullSteps(result.legs?.[0]?.steps || []);
              setIsRerouting(false);
              const info = { distance: fmtDist(result.distance), duration: Math.round(result.duration) + ' min', nextStep: null, speed: null };
              setRouteInfo(info);
              onRouteReady?.(info);
              if (!navigationMode) {
                const bottomPad = minimal ? Math.round(SCREEN_HEIGHT * 0.65) : 420;
                const allPoints = [...result.coordinates];
                if (minimal && branchLocation) {
                  allPoints.push({ latitude: branchLocation.latitude, longitude: branchLocation.longitude });
                }
                if (minimal && customerDestinations.length > 0) {
                  customerDestinations.forEach((d: any) => {
                    allPoints.push({ latitude: d.latitude, longitude: d.longitude });
                  });
                }
                mapRef.current?.fitToCoordinates(allPoints, { edgePadding: { top: 80, right: 60, bottom: bottomPad, left: 60 }, animated: true });
              }
            }}
          />
        )}

        {/* NAVIGATION DESTINATION BRANCH MARKER */}
        {navigationMode && routeDestination && ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch'].includes(currentStatus) && (
          <BranchMarker
            pos={{
              lat: routeDestination.lat ?? routeDestination.latitude,
              lng: routeDestination.lng ?? routeDestination.longitude,
            }}
            name={lang === 'bn' ? 'শাখা (পিকআপ)' : 'Branch (Pickup)'}
            T={T}
          />
        )}

        {/* NAVIGATION DESTINATION CUSTOMER MARKER */}
        {navigationMode && routeDestination && !['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch'].includes(currentStatus) && (
          <OrderMarker
            pos={{
              lat: routeDestination.lat ?? routeDestination.latitude,
              lng: routeDestination.lng ?? routeDestination.longitude,
            }}
            color={T.accent || '#ef4444'}
            label={lang === 'bn' ? 'গন্তব্য' : 'Target'}
            isSelected={true}
            isNear={true}
            onClick={() => { }}
          />
        )}
      </MapView>

      {/* ── GOOGLE MAPS NAVIGATION OVERLAYS ── */}
      {navigationMode && (
        <>
          {isFollowMode && <LiveSpeedometer />}
        </>
      )}

      {/* REROUTING BANNER */}
      {navigationMode && isRerouting && (
        <Animated.View
          style={{
            position: 'absolute',
            top: insets.top + 90,
            alignSelf: 'center',
            backgroundColor: '#f97316',
            paddingVertical: 8,
            paddingHorizontal: 20,
            borderRadius: 24,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            elevation: 10,
            shadowColor: '#f97316',
            shadowOpacity: 0.4,
            shadowRadius: 12,
          }}
        >
          <Animated.View
            style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: '#fff',
              opacity: recenterAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }),
            }}
          />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>
            {lang === 'bn' ? 'রাস্তা পুনরায় হিসাব করা হচ্ছে...' : 'Recalculating route...'}
          </Text>
        </Animated.View>
      )}

      {/* ARRIVAL BANNER */}
      {navigationMode && isArrived && (
        <Animated.View
          style={{
            position: 'absolute',
            top: insets.top + 90,
            alignSelf: 'center',
            backgroundColor: '#22c55e',
            paddingVertical: 10,
            paddingHorizontal: 24,
            borderRadius: 24,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            elevation: 10,
            shadowColor: '#22c55e',
            shadowOpacity: 0.5,
            shadowRadius: 16,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>
            {lang === 'bn' ? '✓ গন্তব্যে পৌঁছেছেন' : '✓ You have arrived'}
          </Text>
        </Animated.View>
      )}

      <MapControls
        T={T} lang={lang} labels={labels} font={font} isDark={isDark}
        theme={theme} toggleTheme={toggleTheme} toggleLang={toggleLang}
        showControls={showControls} setShowControls={setShowControls}
        stickyVisible={stickyVisible} setStickyVisible={setStickyVisible}
        recenterAnim={recenterAnim} reenterFollow={reenterFollow}
        assignedOrders={assignedOrders} batchGroups={activeBatchGroups}
        hideBottomNav={hideBottomNav} setHideBottomNav={setHideBottomNav}
        viewMode={viewMode} setViewMode={setViewMode} minimal={minimal}
      />

      {!minimal && (
        <OrderListSheet
          cardsAnim={cardsAnim} assignedOrders={assignedOrders}
          activeBatchGroups={stickyVisible ? activeBatchGroups : activeBatchGroups.filter(g => (g[0].batchId || g[0].id) === selectedBatchId)}
          branches={branches} selectedBatchId={selectedBatchId} closestBatchId={closestBatchId}
          livePos={livePos} onOpenOrder={onOpenOrder} onAcceptOrder={onAcceptOrder} onRejectOrder={onRejectOrder}
          handleMarkerClick={handleMarkerClick} setSelectedBatchId={setSelectedBatchId}
          returningCount={returningCount} T={T} lang={lang} font={font} labels={labels} isDark={isDark}
          scrollRef={scrollRef} hideBottomNav={hideBottomNav}
        />
      )}

      {!minimal && closestBatchInfo && (
        <ProximityBanner dist={closestBatchInfo.dist} orderId={String(closestBatchInfo.id || '')} color={closestBatchInfo.color} lang={lang} font={font} labels={labels} />
      )}

      {!minimal && (
        <IncomingOrderPopup incomingOrder={incomingOrder} livePos={livePos} isDark={isDark} T={T} lang={lang} font={font} labels={labels} onAccept={onAcceptOrder} onReject={onRejectOrder} onDismiss={() => setIsIncomingDismissed(true)} />
      )}

      {!minimal && dutyStatus !== 'online' && (
        <OfflineOverlay T={T} lang={lang} labels={labels} font={font} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { flex: 1 },
});

export default React.memo(RouteOverviewMap);
