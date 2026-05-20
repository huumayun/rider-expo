import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const GRAD_MAP: Record<string, [string, string]> = {
  primary: ['#22d47a', '#16a85a'],
  danger:  ['#f43f5e', '#e11d48'],
  secondary: ['#0ea5e9', '#0284c7'],
};

const SIZE_MAP: Record<ButtonSize, { height: number; fontSize: number; iconSize: number; px: number }> = {
  sm: { height: 38, fontSize: 13, iconSize: 14, px: 16 },
  md: { height: 50, fontSize: 15, iconSize: 16, px: 20 },
  lg: { height: 58, fontSize: 17, iconSize: 18, px: 26 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  fullWidth = true,
}: ButtonProps) {
  const { T, font } = useApp();
  const sz = SIZE_MAP[size];
  const isGrad = variant === 'primary' || variant === 'danger' || variant === 'secondary';
  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle = {
    height: sz.height,
    borderRadius: sz.height / 2.2,
    overflow: 'hidden',
    opacity: isDisabled ? 0.5 : 1,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    ...(style as object),
  };

  const innerStyle: ViewStyle = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: sz.px,
  };

  const labelStyle: TextStyle = {
    color: variant === 'ghost' ? T.text as string
      : variant === 'outline' ? '#22d47a'
      : '#fff',
    fontSize: sz.fontSize,
    fontWeight: '800',
    fontFamily: font,
  };

  const flatStyle: ViewStyle = {
    ...innerStyle,
    backgroundColor:
      variant === 'ghost' ? 'transparent'
      : variant === 'outline' ? 'transparent'
      : undefined,
    borderWidth: variant === 'outline' ? 1.5 : 0,
    borderColor: variant === 'outline' ? '#22d47a' : undefined,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={containerStyle}
    >
      {isGrad ? (
        <LinearGradient
          colors={GRAD_MAP[variant] || GRAD_MAP.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={innerStyle}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                {icon && <Text style={{ fontSize: sz.iconSize }}>{icon}</Text>}
                <Text style={labelStyle}>{label}</Text>
              </>
          }
        </LinearGradient>
      ) : (
        <TouchableOpacity
          onPress={onPress}
          disabled={isDisabled}
          activeOpacity={0.75}
          style={flatStyle}
        >
          {loading
            ? <ActivityIndicator color={variant === 'ghost' ? T.text as string : '#22d47a'} size="small" />
            : <>
                {icon && <Text style={{ fontSize: sz.iconSize }}>{icon}</Text>}
                <Text style={labelStyle}>{label}</Text>
              </>
          }
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
