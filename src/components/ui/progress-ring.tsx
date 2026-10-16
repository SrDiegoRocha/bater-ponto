import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { spring, useTheme, type ColorTokens } from '@/theme';

// Anel de progresso com a mesma geometria do logo: começa às 12h e corre no sentido horário (§6.2).
// Progresso > 1 desenha uma segunda volta na cor de hora extra (passou do limite).

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type ProgressRingProps = {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: keyof ColorTokens;
  children?: React.ReactNode;
  style?: ViewStyle;
};

export function ProgressRing({ progress, size = 240, strokeWidth, color = 'primary', children, style }: ProgressRingProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  // Proporção do logo: traço = 2.5/18 do diâmetro
  const stroke = strokeWidth ?? Math.round(size * (2.5 / 18) * 0.55);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const value = useSharedValue(0);
  useEffect(() => {
    const target = Math.max(0, progress);
    value.set(reduceMotion ? target : withSpring(target, spring.gentle));
  }, [progress, reduceMotion, value]);

  const firstLap = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - Math.min(value.value, 1)),
  }));
  const secondLap = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - Math.min(Math.max(value.value - 1, 0), 1)),
  }));

  const common = {
    cx: size / 2,
    cy: size / 2,
    r,
    strokeWidth: stroke,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeDasharray: `${circumference} ${circumference}`,
    // Rotaciona para começar às 12h
    transform: `rotate(-90 ${size / 2} ${size / 2})`,
  };

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(progress, 1) * 100) }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle {...common} stroke={colors.border} strokeDasharray={undefined} />
        <AnimatedCircle {...common} stroke={colors[color]} animatedProps={firstLap} />
        <AnimatedCircle {...common} stroke={colors.extra} animatedProps={secondLap} />
      </Svg>
      {children}
    </View>
  );
}
