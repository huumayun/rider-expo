import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { PackageCheck } from 'lucide-react-native';
import { useApp } from '../../../context/AppContext';

export default function SuccessView({ batchOrders, onFinish }: any) {
  const { T, lang, font } = useApp();

  const scale = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 50,
      friction: 5,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.6, duration: 2000, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ])
      ])
    ).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
      
      <View style={{ position: 'relative', marginBottom: 28 }}>
        <Animated.View style={{
          position: 'absolute', inset: 0,
          backgroundColor: T.accent, borderRadius: 24,
          transform: [{ scale: pulse }],
          opacity: opacity
        }} />
        <Animated.View style={{
          width: 80, height: 80, backgroundColor: T.accent, borderRadius: 24,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: T.accent, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
          transform: [{ scale }]
        }}>
          <PackageCheck size={40} color="#fff" strokeWidth={2} />
        </Animated.View>
      </View>

      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <Text style={{ fontFamily: font, fontSize: 30, letterSpacing: 2, color: T.text, marginBottom: 6, textTransform: 'uppercase' }}>
          {lang === 'bn' ? 'ট্রিপ সম্পন্ন হয়েছে!' : 'Trip Completed!'}
        </Text>
        <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: T.sub }}>
          {lang === 'bn' ? 'সকল ডেলিভারি সফলভাবে সম্পন্ন হয়েছে' : 'All deliveries have been successful'}
        </Text>
      </View>

      <Pressable onPress={onFinish} style={{ width: '100%', maxWidth: 360, height: 60, borderRadius: 20, backgroundColor: T.text, alignItems: 'center', justifyContent: 'center', shadowColor: T.text, shadowOpacity: 0.25, shadowRadius: 30, elevation: 8 }}>
        <Text style={{ color: T.bg, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.5 }}>
          {lang === 'bn' ? 'হোম পেজে ফিরে যান' : 'Back to Home'}
        </Text>
      </Pressable>

    </View>
  );
}
