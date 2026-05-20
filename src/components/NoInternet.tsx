import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { useNetInfo } from '../hooks/useNetInfo';

const { width } = Dimensions.get('window');

export function NoInternet() {
  const { t, font } = useApp();
  const { isConnected, isInternetReachable } = useNetInfo();
  const offline = !isConnected || isInternetReachable === false;

  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (offline) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -120, duration: 350, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    }
  }, [offline]);

  if (!offline) return null;

  return (
    <Animated.View style={[styles.container, {
      transform: [{ translateY: slideAnim }],
      opacity: opacityAnim,
    }]}>
      <View style={styles.pill}>
        <Text style={styles.icon}>📡</Text>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { fontFamily: 'Nunito_700Bold' }]}>
            {t('no_internet')}
          </Text>
          <Text style={[styles.sub, { fontFamily: font }]}>
            {t('no_internet_sub')}
          </Text>
        </View>
        <View style={styles.dot} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingTop: 56,
    pointerEvents: 'none' as any,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e2e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.4)',
    shadowColor: '#f43f5e',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    maxWidth: width - 40,
  },
  icon: { fontSize: 22 },
  textWrap: { flex: 1 },
  title: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  sub: { color: '#64748b', fontSize: 11, marginTop: 1 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#f43f5e',
  },
});
