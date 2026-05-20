import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { CornerUpLeft, CornerUpRight } from 'lucide-react-native';

interface Props {
  nextStep: any;
  isVisible: boolean;
}

export const LargeTurnIndicator = ({ nextStep, isVisible }: Props) => {
  const [mounted, setMounted] = React.useState(isVisible);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isVisible) {
      setMounted(true);
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Start Pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Fade out and then unmount
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setMounted(false);
      });
    }
  }, [isVisible]);

  if (!mounted) return null;

  const isLeft = nextStep?.maneuver?.includes('left') || nextStep?.instruction?.toLowerCase().includes('left');
  const isRight = nextStep?.maneuver?.includes('right') || nextStep?.instruction?.toLowerCase().includes('right');

  if (!isLeft && !isRight) return null;

  return (
    <Animated.View 
      style={[
        styles.container, 
        isLeft ? styles.leftSide : styles.rightSide,
        { opacity: fadeAnim }
      ]}
    >
      <Animated.View 
        style={[
          styles.content,
          { transform: [{ scale: pulseAnim }] }
        ]}
      >
        {isLeft ? (
          <CornerUpLeft size={90} color="#22c55e" strokeWidth={3} />
        ) : (
          <CornerUpRight size={90} color="#22c55e" strokeWidth={3} />
        )}
        <Text style={styles.text}>
          {isLeft ? 'TURN LEFT' : 'TURN RIGHT'}
        </Text>
        <Text style={styles.distText}>
          {nextStep?.distance}
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 140, // Below the header
    zIndex: 1000,
    width: 120,
    alignItems: 'center',
  },
  leftSide: {
    left: 15,
  },
  rightSide: {
    right: 15,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5
  },
  distText: {
    color: '#22c55e',
    fontSize: 24,
    fontWeight: '900',
    marginTop: -2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5
  }
});
