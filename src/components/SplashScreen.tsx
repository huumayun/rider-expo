import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions, StatusBar,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish?: () => void;
}

export function AppSplashScreen({ onFinish }: SplashScreenProps) {
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo pop in
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      // Text fade in
      Animated.timing(textOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      // Loading dots pulse
      Animated.timing(dotAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      // Exit fade
      Animated.delay(200),
      Animated.timing(exitOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => onFinish?.());
  }, []);

  const dot1Opacity = dotAnim.interpolate({ inputRange: [0, 0.33, 1], outputRange: [0.2, 1, 0.2] });
  const dot2Opacity = dotAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1, 0.2] });
  const dot3Opacity = dotAnim.interpolate({ inputRange: [0, 0.66, 1], outputRange: [0.2, 1, 0.2] });

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor="#07070f" />

      {/* Ambient blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, {
        transform: [{ scale: logoScale }],
        opacity: logoOpacity,
      }]}>
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>🛵</Text>
        </View>
      </Animated.View>

      {/* Brand name */}
      <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
        <Text style={styles.brand}>
          Graam<Text style={{ color: '#22d47a' }}>Bazaar</Text>
        </Text>
        <Text style={styles.tagline}>রাইডার পোর্টাল</Text>
      </Animated.View>

      {/* Loading dots */}
      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, { opacity: dot1Opacity }]} />
        <Animated.View style={[styles.dot, { opacity: dot2Opacity }]} />
        <Animated.View style={[styles.dot, { opacity: dot3Opacity }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#07070f',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    gap: 16,
  },
  blob1: {
    position: 'absolute',
    width: width * 0.7, height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: '#22d47a',
    opacity: 0.04,
    top: -width * 0.2, left: -width * 0.15,
  },
  blob2: {
    position: 'absolute',
    width: width * 0.8, height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: '#0ea5e9',
    opacity: 0.04,
    bottom: -width * 0.3, right: -width * 0.2,
  },
  logoWrap: { marginBottom: 8 },
  logoBox: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoEmoji: { fontSize: 44 },
  brand: {
    fontSize: 32, fontWeight: '900',
    color: '#f8fafc', letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 13, color: '#64748b',
    marginTop: 4, letterSpacing: 2,
  },
  dotsRow: {
    flexDirection: 'row', gap: 8,
    position: 'absolute', bottom: height * 0.12,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#22d47a',
  },
});
