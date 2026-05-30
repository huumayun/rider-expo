import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { useApp } from '../../context/AppContext';

export default function TypingIndicator() {
  const { T, t, theme, font } = useApp();
  const isDark = theme === 'dark';
  const surf = isDark ? '#141428' : '#ffffff';

  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start();

    let loops: Animated.CompositeAnimation[] = [];
    const animateDot = (dot: Animated.Value, delay: number) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: -6, duration: 375, delay, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 375, useNativeDriver: true })
        ])
      );
      loops.push(loop);
      loop.start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 140);
    animateDot(dot3, 280);

    return () => {
      loops.forEach(l => l.stop());
    };
  }, []);

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 16, paddingLeft: 16 }}>
      <Animated.View style={{
        backgroundColor: surf,
        borderColor: T.border,
        borderWidth: 1,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        borderBottomLeftRadius: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        opacity: opacityAnim,
        transform: [{ translateY: slideAnim }]
      }}>
        <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.accent, transform: [{ translateY: dot1 }] }} />
        <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.accent, transform: [{ translateY: dot2 }] }} />
        <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.accent, transform: [{ translateY: dot3 }] }} />
        
        <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, color: T.sub, marginLeft: 5, fontFamily: font }}>
          {t('chat_typing')}
        </Text>
      </Animated.View>
    </View>
  );
}
