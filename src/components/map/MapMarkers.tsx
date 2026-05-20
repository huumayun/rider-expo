import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { Marker } from 'react-native-maps';
import { Building2 } from 'lucide-react-native';

const PulsingAura = () => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(66, 133, 244, 0.25)',
        transform: [{ scale: pulse }],
        opacity: pulse.interpolate({
          inputRange: [1, 1.6],
          outputRange: [0.6, 0]
        })
      }}
    />
  );
};

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
      tracksViewChanges={true}
    >
      <View style={{
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        overflow: 'visible'
      }}>
        <PulsingAura />

        {/* Directional Beam - Subtle */}
        <View
          style={{
            position: 'absolute',
            width: 0,
            height: 0,
            borderLeftWidth: 7,
            borderRightWidth: 7,
            borderBottomWidth: 20,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: 'rgba(66, 133, 244, 0.4)',
            transform: [{ translateY: -12 }]
          }}
        />

        {/* Main Blue Dot - Smaller Radius */}
        <View style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: '#4285F4',
          borderWidth: 2,
          borderColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#fff', opacity: 0.6 }} />
        </View>
      </View>
    </Marker>
  );
});

export const OrderMarker = React.memo(({ pos, color, label, isSelected, onClick, isNear, isNew, lang }: any) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isNear) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.35, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [isNear]);

  return (
    <Marker
      coordinate={{ latitude: Number(pos.lat), longitude: Number(pos.lng) }}
      onPress={onClick}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={false}
    >
      <View style={{ alignItems: 'center', paddingBottom: 0 }}>
        {isNew && (
          <View style={{
            backgroundColor: color, paddingHorizontal: 6, paddingVertical: 1,
            borderRadius: 4, marginBottom: 4, borderWidth: 1, borderColor: '#fff',
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
          }}>
            <Text style={{ color: '#fff', fontSize: 7, fontWeight: '900' }}>{isNew}</Text>
          </View>
        )}
        <Animated.View style={{ transform: [{ scale: isSelected ? 1.2 : pulse }] }}>
          <View style={{
            width: 38, height: 38, borderRadius: 19, backgroundColor: color,
            borderWidth: isNear ? 3 : 2, borderColor: '#fff',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: color, shadowOpacity: isNear ? 0.7 : 0.35, shadowRadius: isNear ? 10 : 5,
            elevation: isSelected ? 9 : 5,
          }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{label}</Text>
          </View>
          {isNear && (
            <View style={{
              position: 'absolute', bottom: -4, left: '50%', marginLeft: -3,
              width: 6, height: 6, borderRadius: 3, backgroundColor: color,
              borderWidth: 1, borderColor: '#fff',
            }} />
          )}
        </Animated.View>
      </View>
    </Marker>
  );
});

export const BranchMarker = React.memo(({ pos, name, T }: any) => (
  <Marker
    coordinate={{ latitude: Number(pos.lat), longitude: Number(pos.lng) }}
    anchor={{ x: 0.5, y: 1 }}
    tracksViewChanges={false}
  >
    <View style={{ alignItems: 'center' }}>
      <View style={{
        backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: T.border,
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
      }}>
        <Text style={{ fontSize: 9, fontWeight: '800', color: T.text }}>{name}</Text>
      </View>
      <View style={{
        width: 34, height: 34, borderRadius: 17, backgroundColor: T.surface,
        borderWidth: 2, borderColor: T.accent, alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
      }}>
        <Building2 size={16} color={T.accent} />
      </View>
    </View>
  </Marker>
));
