import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { OrderMarker, BranchMarker } from './MapMarkers';
import { GOOGLE_MAPS_API_KEY } from '../../config/firebase';
import { darkMapStyle, fmtDist } from './mapUtils';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || GOOGLE_MAPS_API_KEY;

interface SimpleOverviewMapProps {
  assignedOrders: any[];
  livePos: { lat: number; lng: number } | null;
  branchLocation: any; // Allow both {latitude, longitude} and {lat, lng}
  customerDestinations: any[];
  isAccepted: boolean;
  accentColor: string;
  T: any;
  lang: string;
  isDark: boolean;
  onRouteReady?: (info: any) => void;
  onMapInteraction?: () => void;
}

export default React.memo(function SimpleOverviewMap({
  assignedOrders = [],
  livePos,
  branchLocation,
  customerDestinations = [],
  isAccepted,
  accentColor = '#6366f1',
  T,
  lang,
  isDark,
  onRouteReady,
  onMapInteraction
}: SimpleOverviewMapProps) {
  const mapRef = useRef<MapView>(null);

  // 1. Resolve safe coordinate objects
  const routeOrigin = useMemo(() => {
    return livePos ? { latitude: Number(livePos.lat), longitude: Number(livePos.lng) } : null;
  }, [livePos]);

  const resolvedBranchCoords = useMemo(() => {
    if (!branchLocation) return null;
    const lat = branchLocation.latitude ?? branchLocation.lat;
    const lng = branchLocation.longitude ?? branchLocation.lng;
    return lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : null;
  }, [branchLocation]);

  const resolvedCustomerCoords = useMemo(() => {
    return customerDestinations
      .map(dest => {
        if (!dest) return null;
        const lat = dest.latitude ?? dest.lat;
        const lng = dest.longitude ?? dest.lng;
        return lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : null;
      })
      .filter(Boolean) as { latitude: number; longitude: number }[];
  }, [customerDestinations]);

  // Destination and waypoints for driving direction line
  const routeDestination = useMemo(() => {
    if (isAccepted) {
      return resolvedBranchCoords;
    }
    return resolvedCustomerCoords.length > 0 
      ? resolvedCustomerCoords[resolvedCustomerCoords.length - 1] 
      : resolvedBranchCoords;
  }, [isAccepted, resolvedBranchCoords, resolvedCustomerCoords]);

  const waypoints = useMemo(() => {
    if (isAccepted || !resolvedBranchCoords) {
      return [];
    }
    return [
      resolvedBranchCoords,
      ...resolvedCustomerCoords.slice(0, -1)
    ];
  }, [isAccepted, resolvedBranchCoords, resolvedCustomerCoords]);

  // 2. Camera Fit to show the entire trip bounds perfectly
  useEffect(() => {
    if (!mapRef.current) return;

    const fitCamera = () => {
      const coordinates: { latitude: number; longitude: number }[] = [];
      
      if (routeOrigin) coordinates.push(routeOrigin);
      if (resolvedBranchCoords) coordinates.push(resolvedBranchCoords);
      resolvedCustomerCoords.forEach(dest => {
        coordinates.push(dest);
      });

      if (coordinates.length > 0) {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: {
            top: 100,
            right: 80,
            bottom: Math.round(SCREEN_HEIGHT * 0.48), // Space for bottom sheet
            left: 80
          },
          animated: true
        });
      }
    };

    const timer = setTimeout(fitCamera, 600);
    return () => clearTimeout(timer);
  }, [routeOrigin, resolvedBranchCoords, resolvedCustomerCoords]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        onTouchStart={onMapInteraction}
        onPanDrag={onMapInteraction}
        onPress={onMapInteraction}
        showsUserLocation={true} // Natively show blue dot for rider's real-time position
        showsMyLocationButton={false}
        showsScale={false}
        mapType="standard"
        customMapStyle={isDark ? darkMapStyle : []}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        showsCompass={false}
        initialCamera={{
          center: livePos ? { latitude: Number(livePos.lat), longitude: Number(livePos.lng) } : { latitude: 23.8103, longitude: 90.4125 },
          zoom: 15,
          pitch: 0,
          heading: 0,
          altitude: 1000
        }}
      >
        {/* BRANCH MARKER */}
        {resolvedBranchCoords && (
          <BranchMarker
            pos={{ lat: resolvedBranchCoords.latitude, lng: resolvedBranchCoords.longitude }}
            name={lang === 'bn' ? 'শাখা' : 'Branch'}
            T={T}
          />
        )}

        {/* CUSTOMER DESTINATION MARKERS (Show in both assigned and accepted overview stages) */}
        {resolvedCustomerCoords.map((dest: any, i: number) => (
          <OrderMarker
            key={`drop-${i}`}
            pos={{ lat: dest.latitude, lng: dest.longitude }}
            color={T.green}
            label={`${i + 1}`}
            customerName={dest.name}
            isSelected={true}
            isNear={false}
            onClick={() => {}}
          />
        ))}

        {/* DIRECTIONS ROUTE LINE */}
        {routeOrigin && routeDestination && GOOGLE_API_KEY && (
          <MapViewDirections
            origin={routeOrigin}
            destination={routeDestination}
            waypoints={waypoints}
            apikey={GOOGLE_API_KEY}
            strokeWidth={5}
            strokeColor="#3b82f6"
            mode="DRIVING"
            optimizeWaypoints={false}
            precision="high"
            onReady={(result) => {
              const info = {
                distance: fmtDist(result.distance),
                duration: Math.round(result.duration) + ' min',
                nextStep: null,
                speed: null
              };
              onRouteReady?.(info);
            }}
          />
        )}
      </MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e5e7eb',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
