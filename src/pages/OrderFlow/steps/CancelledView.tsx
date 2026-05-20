import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { XCircle, AlertTriangle } from 'lucide-react-native';
import { useApp } from '../../../context/AppContext';

export default function CancelledView({ order, onFinish, batchOrders }: any) {
  const { T, lang, font } = useApp();

  const scale = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;
  const boxY = useRef(new Animated.Value(20)).current;
  const boxOpacity = useRef(new Animated.Value(0)).current;

  const reason = order?.cancelReason || (lang === 'bn' ? 'অজানা কারণ' : 'Reason not provided');

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 50,
      friction: 5,
      useNativeDriver: true,
    }).start();

    Animated.parallel([
      Animated.timing(boxOpacity, { toValue: 1, duration: 300, delay: 200, useNativeDriver: true }),
      Animated.spring(boxY, { toValue: 0, tension: 50, friction: 6, delay: 200, useNativeDriver: true })
    ]).start();

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
          backgroundColor: '#ef4444', borderRadius: 24,
          transform: [{ scale: pulse }],
          opacity: opacity
        }} />
        <Animated.View style={{
          width: 80, height: 80, backgroundColor: '#ef4444', borderRadius: 24,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#ef4444', shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
          transform: [{ scale }]
        }}>
          <XCircle size={40} color="#fff" strokeWidth={2} />
        </Animated.View>
      </View>

      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <Text style={{ fontFamily: font, fontSize: 30, letterSpacing: 2, color: T.text, marginBottom: 6, textTransform: 'uppercase' }}>
          {lang === 'bn' ? 'অর্ডার বাতিল!' : 'ORDER CANCELLED!'}
        </Text>
        <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: T.sub }}>
          {lang === 'bn' ? 'এই ট্রিপটি বাতিল করা হয়েছে' : 'This trip has been cancelled'}
        </Text>
      </View>

      <Animated.View style={{
        width: '100%', maxWidth: 360, backgroundColor: 'rgba(239,68,68,0.06)',
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 20,
        padding: 20, gap: 10, marginBottom: 20,
        transform: [{ translateY: boxY }], opacity: boxOpacity
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} color="#ef4444" strokeWidth={2.5} />
          <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, color: '#ef4444' }}>
            {lang === 'bn' ? 'বাতিলের কারণ' : 'Cancellation Reason'}
          </Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: '600', color: T.text, lineHeight: 22 }}>
          {reason}
        </Text>
      </Animated.View>

      <Pressable onPress={onFinish} style={{ width: '100%', maxWidth: 360, height: 60, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.5 }}>
          {lang === 'bn' ? 'বন্ধ করুন' : 'CLOSE'}
        </Text>
      </Pressable>

    </View>
  );
}
