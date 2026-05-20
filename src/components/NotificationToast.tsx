import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, Animated, Dimensions, PanResponder, StyleSheet, Pressable } from 'react-native';
import { Bell, X, ChevronRight, MessageSquare, Banknote, Info, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const COLORS: Record<string, string> = {
  new_order: '#22d47a',
  order_status: '#e85d04',
  chat: '#10b981', 
  wallet: '#f59e0b',
  default: '#6366f1',
};

const ICONS: Record<string, any> = {
  new_order: Bell,
  order_status: Info,
  chat: MessageSquare,
  wallet: Banknote,
  default: Info,
};

function Toast({ id, title, body, type, onDismiss, onClick }: any) {
  const { theme, font } = useApp();
  const isDark = theme === 'dark';
  const color = COLORS[type] || COLORS.default;
  const Icon = ICONS[type] || ICONS.default;
  
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);
  
  const progress = useRef(new Animated.Value(1)).current;

  // Mount animation
  useEffect(() => {
    Animated.parallel([
      Animated.spring(pan.y, { toValue: 0, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(progress, { toValue: 0, duration: 5000, useNativeDriver: false })
    ]).start();

    timerRef.current = setTimeout(() => {
      dismissAnimation();
    }, 5000);

    return () => clearTimeout(timerRef.current);
  }, []);

  const dismissAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(pan.y, { toValue: -40, duration: 200, useNativeDriver: true })
    ]).start(() => onDismiss(id));
  }, [id, onDismiss]);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10,
    onPanResponderGrant: () => {
      clearTimeout(timerRef.current);
      progress.stopAnimation();
    },
    onPanResponderMove: Animated.event(
      [null, { dx: pan.x }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (_, gestureState) => {
      if (Math.abs(gestureState.dx) > 80) {
        Animated.spring(pan.x, {
          toValue: Math.sign(gestureState.dx) * width,
          useNativeDriver: true
        }).start(() => onDismiss(id));
      } else {
        Animated.spring(pan.x, {
          toValue: 0,
          useNativeDriver: true
        }).start();
        timerRef.current = setTimeout(dismissAnimation, 3000);
      }
    }
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        opacity,
        transform: [
          { translateX: pan.x },
          { translateY: pan.y },
          { scale },
          { rotate: pan.x.interpolate({ inputRange: [-120, 0, 120], outputRange: ['-6deg', '0deg', '6deg'] }) }
        ],
        marginBottom: 12,
        width: Math.min(width - 32, 400),
        alignSelf: 'center',
      }}
    >
      <Pressable
        onPress={() => { dismissAnimation(); onClick(type); }}
        style={({ pressed }) => [
          {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
            borderRadius: 24,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: isDark ? 0.4 : 0.12,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
            elevation: 10,
            opacity: pressed ? 0.8 : 1
          }
        ]}
      >
        {/* Progress Bar */}
        <Animated.View style={{
          position: 'absolute', bottom: 0, left: 0, height: 3,
          backgroundColor: color,
          width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          opacity: 0.6
        }} />

        {/* Icon */}
        <View style={{ flexShrink: 0 }}>
          <View style={{
            width: 48, height: 48, borderRadius: 16,
            backgroundColor: isDark ? `${color}18` : `${color}10`,
            borderWidth: 1, borderColor: `${color}35`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={22} color={color} strokeWidth={2.5} />
          </View>
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{
              fontSize: 14.5, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a',
              fontFamily: font, lineHeight: 18,
            }} numberOfLines={1}>
              {title}
            </Text>
            {type === 'new_order' && <Sparkles size={12} color={color} />}
          </View>
          <Text style={{
            fontSize: 12.5, color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(15, 23, 42, 0.65)',
            fontFamily: font, fontWeight: '500', lineHeight: 16
          }} numberOfLines={1}>
            {body}
          </Text>
        </View>

        {/* Action arrow */}
        <View style={{
          width: 34, height: 34, borderRadius: 12,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <ChevronRight size={20} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} strokeWidth={3} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function NotificationToast({ toasts, onDismiss }: { toasts: any[], onDismiss: (id: number) => void }) {
  const router = useRouter();

  const handleClick = useCallback((type: string) => {
    if (type === 'wallet') router.push('/wallet');
    else if (type === 'new_order' || type === 'order_status') router.push('/orders');
    else if (type === 'chat') router.push('/orders');
    else router.push('/notifications');
  }, [router]);

  if (toasts.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={{ position: 'absolute', top: 50, left: 0, right: 0, zIndex: 9999, alignItems: 'center' }} pointerEvents="box-none">
        {toasts.slice(0, 3).map((t, index) => (
          <Toast
            key={t.id}
            {...t}
            onDismiss={onDismiss}
            onClick={handleClick}
          />
        ))}
      </View>
    </View>
  );
}
