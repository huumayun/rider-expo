import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  FadeIn,
  FadeOut,
  Easing,
  interpolate
} from 'react-native-reanimated';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';

interface Props {
  nextStep: any;
  isVisible: boolean;
}

const ChevronItem = ({ direction, animatedStyle }: { direction: 'left' | 'right'; animatedStyle: any }) => {
  const ChevronComponent = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <View style={{ width: 74, height: 74, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
      {/* Base/Inactive Chevron - subtle elegant background */}
      <ChevronComponent size={74} color="rgba(255, 255, 255, 0.15)" strokeWidth={5} />
      
      {/* Animated Glowing Green Chevron - 100% clean and crisp vector */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: 74, height: 74, justifyContent: 'center', alignItems: 'center' }, animatedStyle]}>
        <ChevronComponent 
          size={74} 
          color="#16a34a" 
          strokeWidth={6} 
        />
      </Animated.View>
    </View>
  );
};

export const LargeTurnIndicator = ({ nextStep, isVisible }: Props) => {
  const { lang } = useApp();
  const progress = useSharedValue(0);

  const isLeft = nextStep?.maneuver?.includes('left') || nextStep?.instruction?.toLowerCase().includes('left');
  const isRight = nextStep?.maneuver?.includes('right') || nextStep?.instruction?.toLowerCase().includes('right');
  const rawDist = nextStep?.rawDist;
  const isClose = rawDist !== undefined && rawDist <= 0.1; // 100 meters

  // Interpolate chevrons over a single timeline to guarantee perfect, bug-free repeating sequence
  const style0 = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0.0, 0.25, 0.5],
      [0, 1, 0],
      'clamp'
    );
    return { opacity };
  });

  const style1 = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0.25, 0.5, 0.75],
      [0, 1, 0],
      'clamp'
    );
    return { opacity };
  });

  const style2 = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0.5, 0.75, 1.0],
      [0, 1, 0],
      'clamp'
    );
    return { opacity };
  });

  useEffect(() => {
    if (isVisible && isClose) {
      progress.value = 0;
      progress.value = withRepeat(
        withTiming(1, { 
          duration: 1300, 
          easing: Easing.linear 
        }),
        -1,
        false
      );
    }
  }, [isVisible, isClose, isLeft, isRight]);

  if (!isVisible) return null;
  if (!isLeft && !isRight) return null;
  if (!isClose) return null;

  return (
    <Animated.View 
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(300)}
      style={[
        styles.container, 
        isLeft ? styles.leftSide : styles.rightSide
      ]}
    >
      <Animated.View style={styles.content}>
        {isLeft ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: -32 }}>
            <ChevronItem direction="left" animatedStyle={style2} />
            <ChevronItem direction="left" animatedStyle={style1} />
            <ChevronItem direction="left" animatedStyle={style0} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: -32 }}>
            <ChevronItem direction="right" animatedStyle={style0} />
            <ChevronItem direction="right" animatedStyle={style1} />
            <ChevronItem direction="right" animatedStyle={style2} />
          </View>
        )}

        <Text style={[styles.distText, { marginTop: 12 }]}>
          {lang === 'bn' ? `${nextStep?.distance} পর` : `After ${nextStep?.distance}`}
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 220, // Lower center coordinate
    zIndex: 1000,
    width: 180, 
    alignItems: 'center',
  },
  leftSide: {
    left: 20,
  },
  rightSide: {
    right: 20,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  distText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    textAlign: 'center',
  }
});
