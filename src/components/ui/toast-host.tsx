import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUiStore } from '@/stores/ui-store';
import { darkColors, lightColors } from '@/theme/colors';
import { minTouch, radius, spacing, useTheme } from '@/theme';

import { Text } from './text';

// Toast global com ações ("Ajustar", "Desfazer"). Some sozinho depois de `duration` (padrão 5s).

const TAB_BAR_HEIGHT = 80;

export function ToastHost() {
  const toast = useUiStore((s) => s.toast);
  const hide = useUiStore((s) => s.hideToast);
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => hide(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  // Superfície invertida: destaca em ambos os temas. A ação usa a primária do tema oposto.
  const background = colors.text;
  const foreground = colors.bg;
  const actionColor = scheme === 'dark' ? lightColors.primary : darkColors.primary;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + spacing.sm }]}>
      {toast && (
      <Animated.View
        key={toast.id}
        entering={FadeInDown.springify().damping(18)}
        exiting={FadeOutDown.duration(150)}
        layout={LinearTransition}
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: background }]}
      >
        <Text variant="body" style={[styles.message, { color: foreground }]} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              hide(toast.id);
              action.onPress();
            }}
            style={styles.action}
          >
            <Text variant="headline" style={{ color: actionColor }}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouch + spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radius.md,
    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.25)',
  },
  message: { flex: 1, paddingVertical: spacing.sm },
  action: { minHeight: minTouch, justifyContent: 'center', paddingHorizontal: spacing.sm },
});
