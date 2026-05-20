import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Animated,
} from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { useUIStore } from '../../store/uiStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Components
import { RiderMarker, OrderMarker, BranchMarker } from './MapMarkers';
import { ProximityBanner } from './ProximityBanner';
import { IncomingOrderPopup } from './IncomingOrderPopup';
import { MapControls } from './MapControls';
import { OrderListSheet } from './OrderListSheet';
import { OfflineOverlay } from './OfflineOverlay';

// Utils & Constants
import { STATUS_COLOR, calcDist, fmtDist, calculateHeading, snapToPolyline } from './mapUtils';
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

  // ─── REFS ──────────────────────────────────────────────────────────────────
  const mapRef = useRef<MapView>(null);
  const scrollRef = useRef<any>(null);
  const recenterAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;
  const lastCameraUpdate = useRef<number>(0);
  const lastHeading = useRef<number>(0);
  // Refs that mirror state – used inside effects to avoid stale-closure deps
  const isReroutingRef = useRef(false);
  const isArrivedRef = useRef(false);
  const directionsOriginRef = useRef<any>(null);
  const snapOnNextFrame = useRef(false); // snap instantly on next camera update

  // ─── DERIVED DATA ──────────────────────────────────────────────────────────
  const batchGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    assignedOrders.forEach((o: any) => {
      const bid = o.batchId || o.id;
      if (!groups[bid]) groups[bid] = [];
      groups[bid].push(o);
    });
    return Object.values(groups);
  }, [assignedOrders]);

  const activeBatchGroups = useMemo(() => {
    return batchGroups.filter(g => !['delivered', 'cancelled', 'returned'].includes(g[0].status));
  }, [batchGroups]);

  const returningCount = useMemo(() =>
    assignedOrders.filter((o: any) => ['returning_to_branch', 'returning_at_branch'].includes(o.status)).length,
    [assignedOrders]);

  const closestBatchInfo = useMemo(() => {
    if (!livePos || activeBatchGroups.length === 0) return null;
    let minD = 999999, minId = null, minColor = T.accent;
    activeBatchGroups.forEach(g => {
      const p = g[0];
      const isBeforePick = ['assigned', 'accepted', 'go_to_branch', 'arrived_at_branch'].includes(p.status);
      const bLoc = branches?.[p.branchId]?.location || p.pickupLocation || p.branchDetail?.location;
      const target = isBeforePick && bLoc?.lat ? bLoc : (p.customer?.location || p.deliveryLocation);
      if (target?.lat) {
        const d = calcDist(livePos.lat, livePos.lng, Number(target.lat), Number(target.lng));
        if (d < minD) {
          minD = d;
          minId = p.batchId || p.id;
          minColor = STATUS_COLOR[p.status] || T.accent;
        }
      }
    });
    return { id: minId, dist: minD, color: minColor };
  }, [livePos, activeBatchGroups, branches, T.accent]);

  const closestBatchId = closestBatchInfo?.id;

  // ─── EFFECTS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (livePos && (!lastRouteOrigin || calcDist(lastRouteOrigin.lat, lastRouteOrigin.lng, livePos.lat, livePos.lng) > 0.05)) {
      setLastRouteOrigin(livePos);
    }
  }, [livePos]);

  useEffect(() => {
    if (followMode !== undefined) setIsFollowMode(followMode);
  }, [followMode]);

  useEffect(() => {
    if (!stickyVisible) setSelectedBatchId(null);
  }, [stickyVisible]);

  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, []);

  useEffect(() => {
    Animated.timing(recenterAnim, {
      toValue: isFollowMode ? 0 : 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [isFollowMode]);

  useEffect(() => {
    const isVisible = (stickyVisible || !!selectedBatchId) && dutyStatus === 'online';
    Animated.spring(cardsAnim, {
      toValue: isVisible ? 0 : 400,
      tension: 40,
      friction: 8,
      useNativeDriver: true
    }).start();
  }, [stickyVisible, selectedBatchId, dutyStatus]);

  // Main Camera sync – throttled to 800ms to avoid jitter
  useEffect(() => {
    if (!livePos || !isFollowMode || !mapRef.current) return;
    const now = Date.now();
    if (now - lastCameraUpdate.current < 800) return;
    lastCameraUpdate.current = now;

    // In nav mode: always rotate map based on road direction (polyline heading).
    // GPS/compass heading is only a starting fallback before route is loaded.
    let activeHeading = heading ?? lastHeading.current;
    if (navigationMode && routeCoords.length > 0) {
      const roadHeading = getRoadHeading(livePos, routeCoords);
      if (roadHeading !== null) {
        // Smooth blend – fast enough to feel responsive, slow enough to not jerk
        activeHeading = lastHeading.current + (roadHeading - lastHeading.current) * 0.5;
        lastHeading.current = activeHeading;
      }
    }

    // Snap instantly on the frame right after re-center button press
    const shouldSnap = snapOnNextFrame.current;
    snapOnNextFrame.current = false;

    // Offset camera 60m ahead so rider appears in lower portion (Google Maps style)
    let cameraCenter = { latitude: livePos.lat, longitude: livePos.lng };
    if (navigationMode) {
      const rad = (activeHeading * Math.PI) / 180;
      const meters = 60;
      cameraCenter = {
        latitude: livePos.lat + Math.cos(rad) * (meters / 111320),
        longitude: livePos.lng + Math.sin(rad) * (meters / (111320 * Math.cos((livePos.lat * Math.PI) / 180))),
      };
    }

    mapRef.current.animateCamera({
      center: cameraCenter,
      heading: activeHeading,
      zoom: navigationMode ? 19 : 18,
      pitch: navigationMode ? 65 : 60,
    }, { duration: shouldSnap ? 0 : 900 });
  }, [livePos, heading, isFollowMode, navigationMode, routeCoords]);

  // Route stats calculation + off-route detection
  // Deps: only livePos/navigationMode/routeCoords/routeDestination to avoid cycles.
  // isRerouting/isArrived/directionsOrigin are read via refs.
  useEffect(() => {
    if (!navigationMode || !livePos || routeCoords.length === 0) return;
    const localStats = getRemainingStats(livePos, routeCoords);
    if (!localStats) return;

    // Arrival detection: < 50m from destination
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
        setRouteCoords([]); // clear stale route immediately
      }
      // Trigger reroute only if moved > 30m from last fetch origin
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
      const info = {
        distance: localStats.distance,
        duration: localStats.duration,
        nextStep: localStats.nextStep,
        speed: (livePos as any).speed ?? null,
      };
      setRouteInfo(info);
      onRouteReady?.(info);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePos, navigationMode, routeCoords, routeDestination]);

  useEffect(() => {
    setIsIncomingDismissed(false);
  }, [incomingOrder?.id]);

  // Auto-fit to markers in assigned mode (no route computed)
  useEffect(() => {
    if (currentStatus !== 'assigned' || !mapRef.current) return;

    const fit = () => {
      const pts: { latitude: number; longitude: number }[] = [];
      if (branchLocation?.latitude) pts.push({ latitude: branchLocation.latitude, longitude: branchLocation.longitude });
      // Use customerDestinations prop first; fallback to assignedOrders customer locations
      customerDestinations.forEach((d: any) => {
        if (d?.latitude) pts.push({ latitude: d.latitude, longitude: d.longitude });
      });
      if (pts.length <= (branchLocation ? 1 : 0)) {
        // No customer destinations from prop — pull directly from orders
        assignedOrders?.forEach((o: any) => {
          const loc = o.customer?.location || o.deliveryLocation;
          if (loc?.lat) pts.push({ latitude: Number(loc.lat), longitude: Number(loc.lng) });
        });
      }
      // Only fit if we have at least one meaningful location (not just rider)
      if (pts.length >= 1) {
        if (livePos?.lat) pts.push({ latitude: livePos.lat, longitude: livePos.lng });
        mapRef.current?.fitToCoordinates(pts, {
          edgePadding: { top: 80, right: 60, bottom: Math.round(SCREEN_HEIGHT * 0.62), left: 60 },
          animated: true,
        });
      }
    };

    // Delay to allow map + branchData to initialize
    const t = setTimeout(fit, 600);
    return () => clearTimeout(t);
  }, [currentStatus, branchLocation, customerDestinations, assignedOrders, livePos]);

  useEffect(() => {
    if (incomingOrder && !isIncomingDismissed) {
      const loc = incomingOrder.pickupLocation || incomingOrder.branchDetail?.location;
      if (loc?.lat) {
        setIsFollowMode(false);
        mapRef.current?.animateCamera({
          center: { latitude: Number(loc.lat), longitude: Number(loc.lng) },
          zoom: 16,
          pitch: 45
        }, { duration: 1000 });
      }
    }
  }, [incomingOrder, isIncomingDismissed]);

  useEffect(() => {
    if (routePolyline && routePolyline.length > 0 && mapRef.current) {
      const coords = routePolyline.map((p: any) => ({
        latitude: p.lat || p.latitude,
        longitude: p.lng || p.longitude,
      }));
      if (minimal && !navigationMode) {
        if (branchLocation) coords.push(branchLocation);
        customerDestinations.forEach((d: any) => coords.push(d));
      }
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: minimal && !navigationMode
          ? { top: 60, right: 50, bottom: Math.round(SCREEN_HEIGHT * 0.62), left: 50 }
          : { top: 150, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [routePolyline, minimal, navigationMode, branchLocation, customerDestinations]);

  // ─── HANDLERS ──────────────────────────────────────────────────────────────
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
    const mins = Math.max(1, Math.round((totalKm / 25) * 60));

    // Find the NEXT upcoming step (ahead of rider, not behind)
    let nextStep = null;
    if (fullSteps.length > 0) {
      // Walk steps from current position, find first one that is ahead (on remaining route)
      for (const step of fullSteps) {
        const dToStep = calcDist(pos.lat, pos.lng, step.end_location.lat, step.end_location.lng);
        const dToStepStart = calcDist(pos.lat, pos.lng, step.start_location.lat, step.start_location.lng);
        // Step is "ahead" if end is further than 20m away and start is closer than end
        if (dToStep > 0.02) {
          nextStep = {
            instruction: step.html_instructions.replace(/<[^>]*>?/gm, ''),
            distance: fmtDist(dToStepStart),
            rawDist: dToStepStart,
            maneuver: step.maneuver || (
              step.html_instructions.toLowerCase().includes('left') ? 'turn-left' :
                step.html_instructions.toLowerCase().includes('right') ? 'turn-right' : ''
            )
          };
          break;
        }
      }
    }
    return { distance: fmtDist(totalKm), duration: mins + ' min', isOffRoute: minD > 0.12, nextStep };
  }, [fullSteps]);

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

  const reenterFollow = useCallback(() => {
    setIsFollowMode(true);
    onFollowModeChange?.(true);
    setSelectedBatchId(null);
    if (livePos) {
      // Navigation mode: snap instantly. Overview mode: smooth transition.
      const snapDuration = navigationMode ? 0 : 600;
      snapOnNextFrame.current = navigationMode;

      // Offset camera 80m ahead so rider stays in lower portion of screen
      let cameraCenter = { latitude: livePos.lat, longitude: livePos.lng };
      if (navigationMode) {
        const rad = (heading * Math.PI) / 180;
        const meters = 80;
        cameraCenter = {
          latitude: livePos.lat + Math.cos(rad) * (meters / 111320),
          longitude: livePos.lng + Math.sin(rad) * (meters / (111320 * Math.cos((livePos.lat * Math.PI) / 180))),
        };
      }

      mapRef.current?.animateCamera({
        center: cameraCenter,
        zoom: navigationMode ? 20.5 : 19,
        heading: heading,
        pitch: navigationMode ? 72 : 65
      }, { duration: snapDuration });
    }
  }, [livePos, heading, navigationMode, onFollowModeChange]);

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        customMapStyle={isDark ? darkMapStyle : []}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        compassOffset={{ x: 20, y: 110 }}
        mapPadding={navigationMode
          ? { top: insets.top + 90, right: 0, left: 0, bottom: 200 }
          : minimal
            ? { top: insets.top + 10, right: 0, left: 0, bottom: Math.round(SCREEN_HEIGHT * 0.62) }
            : { top: insets.top + 80, right: 0, left: 0, bottom: 180 }
        }
        onPanDrag={() => { setIsFollowMode(false); onFollowModeChange?.(false); }}
        onRegionChangeComplete={(_, gesture) => { if (gesture.isGesture) { setIsFollowMode(false); onFollowModeChange?.(false); } }}
        onPress={() => { if (!stickyVisible && selectedBatchId) setSelectedBatchId(null); }}
        initialCamera={{
          center: livePos ? { latitude: livePos.lat, longitude: livePos.lng } : { latitude: 23.8103, longitude: 90.4125 },
          zoom: 17, pitch: 60, heading: 0, altitude: 1000
        }}
      >
        {/* RIDER MARKER */}
        {navigationMode && livePos && (
          <RiderMarker
            pos={livePos}
            heading={(() => {
              const roadH = getRoadHeading(livePos, routeCoords);
              return roadH !== null ? roadH : heading;
            })()}
            accent={accentColor}
          />
        )}

        {/* NAVIGATION DESTINATION */}
        {navigationMode && routeDestination && (
          <OrderMarker
            pos={routeDestination}
            color="#ef4444"
            label={lang === 'bn' ? 'গন্তব্য' : 'Target'}
            isSelected={true}
            isNear={true}
            onClick={() => { }}
          />
        )}

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
                  label={batch.length > 1 ? `x${batch.length}` : (p.seq || p.id.slice(-3))}
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
          const searchRange = Math.min(routeCoords.length, 80);
          for (let i = 0; i < searchRange; i++) {
            const d = Math.sqrt(Math.pow(routeCoords[i].latitude - livePos.lat, 2) + Math.pow(routeCoords[i].longitude - livePos.lng, 2));
            if (d < minDist) { minDist = d; closestIdx = i; }
          }
          const slicedRoute = [{ latitude: livePos.lat, longitude: livePos.lng }, ...routeCoords.slice(closestIdx + 1)];
          return (
            <>
              <Polyline coordinates={slicedRoute} strokeWidth={14} strokeColor={isDark ? "rgba(99, 102, 241, 0.2)" : "rgba(79, 70, 229, 0.15)"} lineCap="round" lineJoin="round" />
              <Polyline coordinates={slicedRoute} strokeWidth={8} strokeColor="#4f46e5" lineCap="round" lineJoin="round" />
              <Polyline coordinates={slicedRoute} strokeWidth={3} strokeColor="#818cf8" lineCap="round" lineJoin="round" />
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
      </MapView>

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
        <ProximityBanner dist={closestBatchInfo.dist} orderId={String(closestBatchInfo.id || '').slice(-5)} color={closestBatchInfo.color} lang={lang} font={font} labels={labels} />
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

const darkMapStyle = [
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

export default React.memo(RouteOverviewMap);
