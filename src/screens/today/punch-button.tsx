import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon, Text, type IconName } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import type { DayState } from '@/domain/state-machine';
import { radius, spacing, timing, useTheme, type ColorTokens } from '@/theme';

// O botão principal (§3.1 / §7): muda de cor e rótulo conforme o estado. Toque longo = outro horário (R8).

const config: Record<DayState, { label: string; icon: IconName; color: keyof ColorTokens }> = {
  off: { label: 'Iniciar dia', icon: 'play_arrow', color: 'work' },
  working: { label: 'Pausar', icon: 'pause', color: 'break' },
  break: { label: 'Voltar ao trabalho', icon: 'play_arrow', color: 'work' },
};

type Props = {
  state: DayState;
  onPress: () => void;
  onLongPress: () => void;
  disabled?: boolean;
};

export function PunchButton({ state, onPress, onLongPress, disabled }: Props) {
  const { colors } = useTheme();
  const c = config[state];

  // Morph de cor entre trabalho (verde) e pausa (âmbar) — §7
  const isBreakColor = useSharedValue(c.color === 'break' ? 1 : 0);
  useEffect(() => {
    isBreakColor.set(withTiming(c.color === 'break' ? 1 : 0, timing.base));
  }, [c.color, isBreakColor]);
  const work = colors.work;
  const pause = colors.break;
  const colorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(isBreakColor.value, [0, 1], [work, pause]),
  }));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={c.label}
      accessibilityHint="Toque longo para escolher outro horário"
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      onLongPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onLongPress();
      }}
      delayLongPress={450}
      android_ripple={{ color: 'rgba(0,0,0,0.12)', foreground: true }}
      style={[styles.button, colorStyle, { opacity: disabled ? 0.6 : 1 }]}
    >
      {/* key = estado: o rótulo troca com crossfade */}
      <Animated.View key={state} entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)} style={styles.content}>
        <Icon name={c.icon} color="onPrimary" />
        <Text variant="headline" color="onPrimary" style={styles.label}>
          {c.label}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: 18 },
});
