import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { MapPin, ChevronRight } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { Order } from '../../store/orderStore';

interface Props {
  order: Order;
  onPress?: () => void;
}

export default function ActiveOrderCard({ order, onPress }: Props) {
  const { T, t, theme } = useApp();
  const isDark = theme === 'dark';
  const surf = isDark ? '#0e0e1c' : '#ffffff';

  // Animation for the pulsing dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const translateYAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    const loopAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        })
      ])
    );
    loopAnim.start();

    return () => loopAnim.stop();
  }, []);

  if (!order) return null;

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        style={{
          backgroundColor: surf,
          borderWidth: 1,
          borderColor: `${T.accent}30`,
          borderRadius: 22,
          padding: 18,
          position: 'relative',
          overflow: 'hidden',
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: translateYAnim }
          ]
        }}
      >
        {/* Left Border Accent */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: '10%',
            bottom: '10%',
            width: 4,
            backgroundColor: T.accent, // Simplified from gradient for RN
            borderTopRightRadius: 3,
            borderBottomRightRadius: 3,
            shadowColor: T.accent,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 5,
          }}
        />

        {/* Top Right Radial Gradient effect (Simplified with opacity circle) */}
        <View
          style={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: `${T.accent}12`,
            pointerEvents: 'none',
          }}
        />

        {/* Header Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: `${T.green}12`, borderWidth: 1, borderColor: `${T.green}30`, borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10 }}>
            <Animated.View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: T.green,
                shadowColor: T.green,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 1,
                shadowRadius: 4,
                elevation: 3,
                opacity: pulseAnim,
              }}
            />
            <Text style={{ fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, color: T.green }}>
              {t('aoc_active')}
            </Text>
          </View>
          <Text style={{ fontSize: 9, fontWeight: '700', color: T.sub, fontFamily: 'monospace' }}>
            #{order.id}
          </Text>
        </View>

        {/* Middle Row */}
        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 14, paddingLeft: 10 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: `${T.accent}12`, borderWidth: 1, borderColor: `${T.accent}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>🏬</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.text, marginBottom: 5 }}>
              {order.branchName || 'Branch'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <MapPin size={12} color={T.accent} strokeWidth={2} />
              <Text style={{ fontSize: 11, color: T.sub, flexShrink: 1 }} numberOfLines={1}>
                {order.customerLocation?.address || 'Customer Address'}
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Row */}
        <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: T.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 10 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: T.accent }}>
            {t('aoc_details')}
          </Text>
          <ChevronRight size={16} color={T.accent} strokeWidth={2.5} />
        </View>
      </Animated.View>
    </Pressable>
  );
}
