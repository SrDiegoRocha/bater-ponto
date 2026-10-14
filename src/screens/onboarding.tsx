import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

import { BrandLockup, BrandSymbol } from '@/components/brand/brand-mark';
import { Button, Card, Screen, Stepper, Text } from '@/components/ui';
import { MoneyInput } from '@/components/ui/money-input';
import { useNow } from '@/hooks/use-now';
import { getPeriodContaining, periodLabel, periodRangeLabel } from '@/domain/period';
import { MINUTE, toDateKey } from '@/domain/time';
import { formatDuration } from '@/lib/format';
import { restoreFlow } from '@/services/backup-flows';
import { useSettings, useSettingsStore } from '@/stores/settings-store';
import { radius, spacing, useTheme } from '@/theme';

// Onboarding (§5.1): 4 passos, pulável. Tudo pode ser mudado depois em Ajustes.

const STEPS = 4;

export function Onboarding() {
  const db = useSQLiteContext();
  const settings = useSettings();
  const update = useSettingsStore((s) => s.update);
  const [step, setStep] = useState(0);
  const [startDay, setStartDay] = useState(settings.periodStartDay);
  const [goal, setGoal] = useState(settings.dailyGoal.defaultMinutes);
  const [rate, setRate] = useState(settings.hourlyRate);

  const now = useNow();
  const preview = getPeriodContaining(toDateKey(now), startDay);

  async function finish() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await update(db, {
      onboardingDone: true,
      periodStartDay: startDay,
      dailyGoal: { ...settings.dailyGoal, defaultMinutes: goal },
      hourlyRate: rate,
    });
    router.replace('/');
  }

  async function restore() {
    if (await restoreFlow(db)) {
      await update(db, { onboardingDone: true });
      router.replace('/');
    }
  }

  const next = () => (step < STEPS - 1 ? setStep(step + 1) : finish());

  return (
    <Screen scroll={false} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <Dots step={step} />
        {step < STEPS - 1 ? <Button label="Pular" variant="ghost" size="sm" onPress={finish} /> : <View />}
      </View>

      <Animated.View key={step} entering={FadeInRight.duration(250)} exiting={FadeOutLeft.duration(150)} style={styles.body}>
        {step === 0 ? (
          <View style={styles.center}>
            <BrandSymbol size={120} />
            <BrandLockup size={36} />
            <Text variant="title2" align="center">
              Bata o ponto em um toque.
            </Text>
            <Text variant="body" color="textMuted" align="center">
              Registre entradas, pausas e o fim do dia, mesmo quando a jornada passa da meia-noite. Seus dados ficam só no seu
              celular.
            </Text>
          </View>
        ) : step === 1 ? (
          <View style={styles.gap}>
            <Text variant="title1">Seu mês começa no dia…</Text>
            <Text variant="body" color="textMuted">
              Os totais e o salário são calculados nesse período.
            </Text>
            <Card style={styles.gap}>
              <Stepper label="Dia de início" value={startDay} min={1} max={31} onChange={setStartDay} />
              <Text variant="headline" align="center">
                {periodLabel(preview)} · {periodRangeLabel(preview)}
              </Text>
            </Card>
          </View>
        ) : step === 2 ? (
          <View style={styles.gap}>
            <Text variant="title1">Sua jornada</Text>
            <Card style={styles.gap}>
              <Text variant="body" color="textMuted">
                Meta de horas por dia
              </Text>
              <Stepper label="Meta diária" value={goal} min={0} max={16 * 60} step={15} format={(m) => formatDuration(m * MINUTE)} onChange={setGoal} />
            </Card>
            <Card style={styles.gap}>
              <Text variant="body" color="textMuted">
                Valor da sua hora (opcional)
              </Text>
              <MoneyInput label="Valor da hora" value={rate} onCommit={setRate} />
            </Card>
          </View>
        ) : (
          <View style={styles.gap}>
            <Text variant="title1">Tudo pronto</Text>
            <Text variant="body" color="textMuted">
              Já usou o Bater Ponto em outro celular? Restaure seu backup para trazer todas as jornadas.
            </Text>
            <Button label="Restaurar um backup" icon="restore" variant="secondary" block onPress={restore} />
          </View>
        )}
      </Animated.View>

      <Button label={step === STEPS - 1 ? 'Começar' : 'Continuar'} size="lg" block onPress={next} />
    </Screen>
  );
}

function Dots({ step }: { step: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dots} accessibilityLabel={`Passo ${step + 1} de ${STEPS}`}>
      {Array.from({ length: STEPS }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, { backgroundColor: i <= step ? colors.primary : colors.border, width: i === step ? 24 : 8 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  body: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center', gap: spacing.lg },
  gap: { gap: spacing.lg },
  dots: { flexDirection: 'row', gap: spacing.xs },
  dot: { height: 8, borderRadius: radius.full },
});
