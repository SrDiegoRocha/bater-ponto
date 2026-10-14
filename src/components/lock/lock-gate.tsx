import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLockup, BrandSymbol } from '@/components/brand/brand-mark';
import { Button, Text } from '@/components/ui';
import { authenticate, getLockAvailability } from '@/services/auth-service';
import { useLockStore } from '@/stores/lock-store';
import { useSettings, useSettingsStore } from '@/stores/settings-store';
import { showToast } from '@/stores/ui-store';
import { spacing, useTheme } from '@/theme';

// Trava por biometria (§3.10 / §5.10): cobre o app ao abrir e ao voltar do segundo plano depois de
// `lockAfterSec`. Com a trava ligada, o conteúdo também some da tela de apps recentes (FLAG_SECURE).

const CAPTURE_KEY = 'biometric-lock';

export function LockGate() {
  const db = useSQLiteContext();
  const { biometricLock, lockAfterSec } = useSettings();
  const update = useSettingsStore((s) => s.update);
  const locked = useLockStore((s) => s.locked);
  const setLocked = useLockStore((s) => s.setLocked);
  const prompted = useRef(false);

  // L4: esconde o conteúdo na tela de recentes
  useEffect(() => {
    if (biometricLock) ScreenCapture.preventScreenCaptureAsync(CAPTURE_KEY).catch(() => {});
    else ScreenCapture.allowScreenCaptureAsync(CAPTURE_KEY).catch(() => {});
  }, [biometricLock]);

  // L3: trava ao voltar do segundo plano depois do tempo configurado
  useEffect(() => {
    if (!biometricLock) return;
    const sub = AppState.addEventListener('change', (state) => {
      const store = useLockStore.getState();
      if (store.authenticating) return;
      if (state === 'background') {
        store.setBackgroundAt(Date.now());
      } else if (state === 'active' && store.backgroundAt !== null) {
        if (Date.now() - store.backgroundAt >= lockAfterSec * 1000) {
          prompted.current = false;
          // Sheets e modais são janelas nativas por cima do app: fecha antes de travar
          if (router.canDismiss()) router.dismissAll();
          store.setLocked(true);
        }
        store.setBackgroundAt(null);
      }
    });
    return () => sub.remove();
  }, [biometricLock, lockAfterSec]);

  const unlock = useCallback(async () => {
    // L6: se o aparelho perdeu todo tipo de bloqueio, desliga a trava e avisa
    const availability = await getLockAvailability();
    if (!availability.available) {
      await update(db, { biometricLock: false });
      setLocked(false);
      showToast('Trava desligada: o aparelho não tem mais bloqueio de tela.');
      return;
    }
    if (await authenticate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setLocked(false);
    }
  }, [db, update, setLocked]);

  // Pede a digital automaticamente uma vez por bloqueio
  useEffect(() => {
    if (biometricLock && locked && !prompted.current) {
      prompted.current = true;
      unlock();
    }
  }, [biometricLock, locked, unlock]);

  if (!biometricLock || !locked) return null;
  return <LockScreen onUnlock={unlock} />;
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(1);

  useEffect(() => {
    if (!reduceMotion) breath.set(withRepeat(withTiming(1.03, { duration: 1400 }), -1, true));
  }, [breath, reduceMotion]);

  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  return (
    <Animated.View
      exiting={FadeOut.duration(250)}
      style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: colors.bg, paddingBottom: insets.bottom + spacing.xl }]}
      accessibilityViewIsModal
    >
      <View style={styles.center}>
        <Animated.View style={breathStyle}>
          <BrandSymbol size={96} />
        </Animated.View>
        <BrandLockup size={28} />
        <Text variant="body" color="textMuted" align="center">
          Use sua digital ou o bloqueio de tela para entrar.
        </Text>
      </View>
      <Button label="Desbloquear" icon="fingerprint" size="lg" block onPress={onUnlock} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { zIndex: 100, paddingHorizontal: spacing.xl, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
});
