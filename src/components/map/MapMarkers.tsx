import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { Marker } from 'react-native-maps';
import { Building2, Navigation, User } from 'lucide-react-native';

export const RiderMarker = React.memo(({ pos, heading, accent }: any) => {
  const plat = pos?.lat || pos?.latitude;
  const plng = pos?.lng || pos?.longitude;

  if (!plat || !plng) return null;

  return (
    <Marker
      coordinate={{ latitude: Number(plat), longitude: Number(plng) }}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={true}
      rotation={heading || 0}
      zIndex={999}
    >
      <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
        <Navigation color="#ffffff" fill="#3b82f6" size={38} strokeWidth={2.5} style={{
          shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 8, elevation: 10,
        }} />
      </View>
    </Marker>
  );
});

export const OrderMarker = React.memo(({ pos, color, label, isSelected, onClick, isNear, isNew, lang }: any) => {
  return (
    <Marker
      coordinate={{ latitude: Number(pos.lat), longitude: Number(pos.lng) }}
      onPress={onClick}
      pinColor={color}
      title={label ? (lang === 'bn' ? `ড্রপ ${label}` : `Drop ${label}`) : 'Customer'}
      description={isNew ? isNew : undefined}
    />
  );
});

export const BranchMarker = React.memo(({ pos, name, T }: any) => (
  <Marker
    coordinate={{ latitude: Number(pos.lat), longitude: Number(pos.lng) }}
    title={name}
    pinColor="blue"
  />
));
