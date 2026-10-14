import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput } from 'react-native';

import { PeriodSwitcher } from '@/components/period/period-switcher';
import { Button, SwitchRow, Text } from '@/components/ui';
import { usePeriodStats, useSelectedPeriod } from '@/hooks/use-period-stats';
import { computeCltPay } from '@/domain/clt';
import { simpleGrossCents } from '@/domain/salary';
import { shareTimesheetPdf } from '@/services/pdf-service';
import { useSettings, useSettingsStore } from '@/stores/settings-store';
import { fonts, minTouch, radius, spacing, useTheme } from '@/theme';

import { SheetContainer } from './sheet-container';

// Opções do PDF (§3.8): período, nome no cabeçalho e bloco de salário opcional.

export function ExportSheet() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const settings = useSettings();
  const update = useSettingsStore((s) => s.update);
  const period = useSelectedPeriod();
  const { stats, workdays, dayOffs, holidays, now } = usePeriodStats(period);
  const [name, setName] = useState(settings.userName);
  const [withSalary, setWithSalary] = useState(settings.hourlyRate > 0);
  const [busy, setBusy] = useState(false);

  const pending = stats ? stats.incompleteCount + workdays.filter((w) => w.status === 'open').length : 0;

  async function generate() {
    if (!stats) return;
    setBusy(true);
    try {
      if (name !== settings.userName) await update(db, { userName: name.trim() });
      const rate = settings.hourlyRate;
      const salary =
        !withSalary || rate <= 0
          ? null
          : settings.salaryMode === 'clt'
            ? {
                mode: 'clt' as const,
                hourlyRate: rate,
                breakdown: computeCltPay({
                  period,
                  workdays,
                  dayOffs,
                  holidays,
                  now,
                  config: {
                    hourlyRate: rate,
                    goal: settings.dailyGoal,
                    overtimePct: settings.overtimePct,
                    holidayOvertimePct: settings.holidayOvertimePct,
                    nightPct: settings.nightPct,
                    nightReduced: settings.nightReduced,
                    dsrOnExtras: settings.dsrOnExtras,
                    sundayDouble: settings.sundayDouble,
                    dependents: settings.dependents,
                  },
                }),
              }
            : { mode: 'simple' as const, hourlyRate: rate, grossCents: simpleGrossCents(stats.workedMs, rate) };

      await shareTimesheetPdf({
        period,
        stats,
        workdays,
        dayOffs,
        holidays,
        goal: settings.dailyGoal,
        userName: name.trim(),
        generatedAt: Date.now(),
        salary,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      Alert.alert('Não foi possível gerar o PDF', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirmGenerate() {
    // E3: avisa sobre jornadas pendentes
    if (pending > 0) {
      Alert.alert(
        pending === 1 ? 'Há 1 jornada pendente' : `Há ${pending} jornadas pendentes`,
        'Jornadas incompletas ou em andamento aparecem marcadas no PDF. Exportar mesmo assim?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Exportar', onPress: generate },
        ],
      );
    } else {
      generate();
    }
  }

  return (
    <SheetContainer>
      <Text variant="title2">Exportar espelho de ponto</Text>
      <PeriodSwitcher period={period} />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Seu nome no cabeçalho (opcional)"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
      />
      <SwitchRow
        title="Incluir salário estimado"
        subtitle={settings.hourlyRate > 0 ? (settings.salaryMode === 'clt' ? 'Recibo CLT completo' : 'Horas × valor da hora') : 'Defina o valor da hora na aba Salário'}
        value={withSalary && settings.hourlyRate > 0}
        disabled={settings.hourlyRate <= 0}
        onValueChange={setWithSalary}
      />
      <Button label={busy ? 'Gerando…' : 'Gerar PDF'} icon="picture_as_pdf" size="lg" block disabled={busy || !stats} onPress={confirmGenerate} />
    </SheetContainer>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: minTouch + 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
});
