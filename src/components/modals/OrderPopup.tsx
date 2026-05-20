import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Dimensions, Modal, Easing } from 'react-native';
import { Package, Timer, MapPin, Navigation } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';

export default function OrderPopup({ order, onAccept, onSkip, visible }: any) {
  const { T, t, theme, font } = useApp();
  const isDark = theme === 'dark';
  const surfHi = isDark ? '#141428' : '#f4f4f9';
  const cardBg = isDark ? '#0e0e1c' : '#ffffff';

  const [timeLeft, setTimeLeft] = useState(30);
  
  const translateY = useRef(new Animated.Value(500)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible && order) {
      setTimeLeft(30);
      progressAnim.setValue(100);
      
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 7 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(progressAnim, { toValue: 0, duration: 30000, easing: Easing.linear, useNativeDriver: false })
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
        ])
      ).start();

    } else {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true })
      ]).start();
    }
  }, [visible, order]);

  useEffect(() => {
    if (!visible) return;
    if (timeLeft <= 0) {
      onSkip();
      return;
    }
    const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, visible, onSkip]);



  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,.88)' : 'rgba(0,0,0,.6)', justifyContent: 'flex-end', padding: 16, paddingBottom: 32 }}>
        <Animated.View style={{ opacity, transform: [{ translateY }], backgroundColor: cardBg, width: '100%', borderRadius: 32, borderWidth: 1, borderColor: T.border, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 }}>
          
          {/* timer bar */}
          <View style={{ height: 4, backgroundColor: T.border, width: '100%' }}>
            <Animated.View style={{ height: '100%', backgroundColor: T.accent, borderRadius: 2, width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
          </View>

          <View style={{ padding: 22, paddingBottom: 26 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: `${T.accent}12`, borderWidth: 1, borderColor: `${T.accent}25`, alignItems: 'center', justifyContent: 'center' }}>
                <Package size={28} color={T.accent} strokeWidth={1.8} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Animated.View style={{ opacity: pulseAnim }}>
                    <Timer size={13} color={T.accent} strokeWidth={2} />
                  </Animated.View>
                  <Text style={{ fontFamily: font, fontSize: 30, letterSpacing: 1, color: T.accent, lineHeight: 30 }}>{timeLeft}s</Text>
                </View>
                <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, color: T.sub, marginBottom: 2 }}>
                  {t('popup_new') || 'New Order'}
                </Text>
                <Text style={{ fontFamily: font, fontSize: 22, letterSpacing: 0.5, color: T.text }}>
                  #{order?.seq || order?.id?.slice(-5) || '----'}
                </Text>
              </View>
            </View>

            <View style={{ backgroundColor: surfHi, borderWidth: 1, borderColor: T.border, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${T.accent}12`, borderWidth: 1, borderColor: `${T.accent}20`, alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={18} color={T.accent} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: T.sub, marginBottom: 3 }}>
                  {t('popup_pickup') || 'Pickup Point'}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.text }}>
                  {order?.branchName || 'GraamBazaar Main Branch'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={onSkip} style={{ flex: 1, height: 56, borderRadius: 18, backgroundColor: surfHi, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: T.sub, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  {t('popup_skip') || 'Skip'}
                </Text>
              </Pressable>

              <Pressable onPress={onAccept} style={{ flex: 1, height: 56, borderRadius: 18, backgroundColor: T.green, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowColor: T.green, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 }}>
                <Navigation size={16} color="#fff" strokeWidth={2.5} />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  {t('popup_accept') || 'Accept'}
                </Text>
              </Pressable>
            </View>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}
