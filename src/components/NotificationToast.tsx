import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, Animated, Dimensions, PanResponder, StyleSheet, Pressable } from 'react-native';
import { Bell, X, ChevronRight, MessageSquare, Banknote, Info, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

const COLORS: Record<string, string> = {
  new_order: '#10b981',
  order_status: '#e85d04',
  chat: '#06b6d4', 
  wallet: '#f59e0b',
  default: '#6366f1',
};

const GRADIENTS: Record<string, [string, string]> = {
  new_order: ['#10b981', '#34d399'],
  order_status: ['#f97316', '#fbbf24'],
  chat: ['#06b6d4', '#3b82f6'], 
  wallet: ['#f59e0b', '#fbbf24'],
  default: ['#8b5cf6', '#d946ef'],
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
  const gradient = GRADIENTS[type] || GRADIENTS.default;
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
        width: Math.min(width - 48, 340),
        alignSelf: 'center',
      }}
    >
      <Pressable
        onPress={() => { dismissAnimation(); onClick(type); }}
        style={({ pressed }) => [
          {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.25)' : 'rgba(255, 255, 255, 0.35)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
            borderRadius: 28,
            paddingVertical: 14,
            paddingHorizontal: 20,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: isDark ? 0.3 : 0.08,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
            elevation: 6,
            opacity: pressed ? 0.9 : 1
          }
        ]}
      >
        {/* Real Blur Backdrop */}
        <BlurView
          intensity={100}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />

        {/* Progress Bar Container */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          overflow: 'hidden',
        }}>
          <Animated.View style={{
            height: '100%',
            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}>
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: '100%', height: '100%' }}
            />
          </Animated.View>
        </View>

        {/* Symmetrical Centered Layout */}
        <View style={{ alignItems: 'center', gap: 8, width: '100%' }}>
          {/* Icon in the middle */}
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: color,
              shadowOpacity: 0.3,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
              elevation: 4,
            }}
          >
            <Icon size={20} color="#ffffff" strokeWidth={2.5} />
          </LinearGradient>

          {/* Texts also in the middle */}
          <View style={{ alignItems: 'center', width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '900',
                color: isDark ? '#ffffff' : '#0f172a',
                fontFamily: font,
                textAlign: 'center',
              }} numberOfLines={1}>
                {title}
              </Text>
              {type === 'new_order' && <Sparkles size={12} color={color} />}
            </View>
            <Text style={{
              fontSize: 12,
              color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(15, 23, 42, 0.65)',
              fontFamily: font,
              fontWeight: '600',
              textAlign: 'center',
            }} numberOfLines={2}>
              {body}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function NotificationToast({ toasts, onDismiss }: { toasts: any[], onDismiss: (id: number) => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toastEnabled } = useApp();

  const handleClick = useCallback((type: string) => {
    if (type === 'wallet') router.push('/wallet');
    else if (type === 'new_order' || type === 'order_status') router.push('/orders');
    else if (type === 'chat') router.push('/orders');
    else router.push('/notifications');
  }, [router]);

  if (!toastEnabled || toasts.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={{ position: 'absolute', top: insets.top + 10, left: 0, right: 0, zIndex: 9999, alignItems: 'center' }} pointerEvents="box-none">
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
