import React, { useEffect, useRef } from 'react';
import {
  View, StyleSheet, Animated, Dimensions, StatusBar, Text, Image,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish?: () => void;
}

export function AppSplashScreen({ onFinish }: SplashScreenProps) {
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const iconScale      = useRef(new Animated.Value(0.5)).current;
  const iconOpacity    = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY       = useRef(new Animated.Value(10)).current;
  const glowOpacity    = useRef(new Animated.Value(0)).current;
  const glowScale      = useRef(new Animated.Value(0.6)).current;
  const dotsOpacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Glow ring expands first
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(glowScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      ]),
      // 2. Icon pops in with spring bounce
      Animated.parallel([
        Animated.spring(iconScale, { toValue: 1, tension: 55, friction: 6, useNativeDriver: true }),
        Animated.timing(iconOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      // 3. Tagline slides up
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(taglineY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      // 4. Loading dots
      Animated.delay(100),
      Animated.timing(dotsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      // 5. Hold
      Animated.delay(900),
      // 6. Fade out
      Animated.timing(containerOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start(() => onFinish?.());
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor="#07070f" />

      {/* Ambient blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      {/* Glow ring behind icon */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* App icon — full image, no clipping */}
      <Animated.View
        style={[
          styles.iconWrap,
          {
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          },
        ]}
      >
        <Image
          source={require('../../assets/adaptive-icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Tagline */}
      <Animated.View
        style={[
          styles.taglineWrap,
          { opacity: taglineOpacity, transform: [{ translateY: taglineY }] },
        ]}
      >
        <Text style={styles.tagline}>রাইডার পোর্টাল</Text>
      </Animated.View>

      {/* Loading dots */}
      <Animated.View style={[styles.dotsRow, { opacity: dotsOpacity }]}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotMid]} />
        <View style={styles.dot} />
      </Animated.View>

      {/* Bottom brand */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomDot} />
        <Text style={styles.bottomText}>
          Graam<Text style={styles.bottomGreen}>Bazaar</Text>
        </Text>
        <View style={styles.bottomDot} />
      </View>
    </Animated.View>
  );
}

const ICON_SIZE = width * 0.52;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#07070f',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  blob1: {
    position: 'absolute',
    width: width * 0.8, height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: '#22d47a',
    opacity: 0.05,
    top: -width * 0.25, left: -width * 0.2,
  },
  blob2: {
    position: 'absolute',
    width: width * 0.9, height: width * 0.9,
    borderRadius: width * 0.45,
    backgroundColor: '#0ea5e9',
    opacity: 0.04,
    bottom: -width * 0.35, right: -width * 0.25,
  },
  glowRing: {
    position: 'absolute',
    width: ICON_SIZE + 40,
    height: ICON_SIZE + 40,
    borderRadius: (ICON_SIZE + 40) / 2,
    borderWidth: 1.5,
    borderColor: '#22d47a',
    opacity: 0.25,
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  taglineWrap: {
    marginTop: 20,
    alignItems: 'center',
  },
  tagline: {
    fontSize: 13,
    color: '#64748b',
    letterSpacing: 3,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 28,
  },
  dot: {
    width: 5, height: 5,
    borderRadius: 2.5,
    backgroundColor: '#22d47a',
    opacity: 0.5,
  },
  dotMid: {
    opacity: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: height * 0.08,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bottomDot: {
    width: 4, height: 4,
    borderRadius: 2,
    backgroundColor: '#22d47a',
    opacity: 0.5,
  },
  bottomText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  bottomGreen: { color: '#22d47a' },
});
