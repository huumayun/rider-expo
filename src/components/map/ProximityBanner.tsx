import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Navigation2 } from 'lucide-react-native';

export const ProximityBanner = React.memo(({ dist, orderId, color, lang, font, labels }: any) => {
  const slideAnim = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [orderId]);

  const isNear = dist < 0.2;
  const distLabel = dist < 1
    ? `${Math.round(dist * 1000)} m`
    : `${dist.toFixed(1)} km`;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.pill, { borderLeftColor: color, borderLeftWidth: 3 }]}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}20` }]}>
          <Navigation2 size={14} color={color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.label, { fontFamily: font }]}>
            {isNear
              ? (labels.near?.[lang] ?? 'Near Destination')
              : `#${orderId}`}
          </Text>
          <Text style={[styles.dist, { color }]}>{distLabel} {labels.away?.[lang] ?? 'away'}</Text>
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 390,
    alignSelf: 'center',
    zIndex: 85,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    gap: 1,
  },
  label: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  dist: {
    fontSize: 12,
    fontWeight: '900',
  },
});
