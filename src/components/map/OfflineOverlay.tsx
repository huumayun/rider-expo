import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';

export const OfflineOverlay = React.memo(({ T, lang, labels, font }: any) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <WifiOff size={28} color="#94a3b8" />
        </View>
        <Text style={[styles.title, { fontFamily: font }]}>
          {labels.offlineTitle?.[lang] ?? 'You are Offline'}
        </Text>
        <Text style={styles.sub}>
          {labels.offlineSub?.[lang] ?? 'Go online to start receiving and delivering orders.'}
        </Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 300,
  },
  card: {
    backgroundColor: '#1e1e2e',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 32,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(148,163,184,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
