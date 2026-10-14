import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { TimeAdjuster } from '@/components/time/time-adjuster';
import { Button, Divider, Icon, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { punchLabel } from '@/components/workday/timeline';
import { useDbQuery } from '@/hooks/use-db-query';
import { toDateKey } from '@/domain/time';
import { summarizeWorkday } from '@/domain/workday';
import { formatDuration, formatShortDate, formatTime } from '@/lib/format';
import { editPunchTime, getEditContext, removePunch, restoreOriginalTime } from '@/services/punch-service';
import { showToast } from '@/stores/ui-store';
import { minTouch, spacing } from '@/theme';

import { SheetContainer } from './sheet-container';

// Editor de horário (PLANEJAMENTO.md §5.11 / §3.11).

export function PunchEditor({ punchId }: { punchId: string }) {
  const db = useSQLiteContext();
  // Contexto carregado uma vez: o editor não muda sob o dedo do usuário
  const [now] = useState(() => Date.now());
  const { data: ctx, loading } = useDbQuery((d) => getEditContext(d, punchId, now), [punchId]);
  const [value, setValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading) return <SheetContainer />;
  if (!ctx) {
    return (
      <SheetContainer>
        <Text variant="body" color="textMuted" align="center">
          Esta batida não existe mais.
        </Text>
        <Button label="Fechar" variant="secondary" onPress={() => router.back()} />
      </SheetContainer>
    );
  }

  const current = value ?? ctx.punch.at;
  const changed = current !== ctx.punch.at;
  const before = summarizeWorkday(ctx.workday.punches, now);
  const after = summarizeWorkday(
    ctx.workday.punches.map((p) => (p.id === punchId ? { ...p, at: current } : p)),
    now,
  );
  const changesRefDate = ctx.punch.isDayStart && toDateKey(current) !== ctx.workday.refDate;

  async function save() {
    if (!changed) return router.back();
    setSaving(true);
    try {
      const undo = await editPunchTime(db, punchId, current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
      showToast(`Horário alterado para ${formatTime(current)}`, { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
    } catch (e) {
      setSaving(false);
      Alert.alert('Não foi possível salvar', (e as Error).message);
    }
  }

  function confirmDelete() {
    Alert.alert('Excluir batida?', `${punchLabel(ctx!.punch)} às ${formatTime(ctx!.punch.at)}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const undo = await removePunch(db, punchId);
          router.back();
          showToast('Batida excluída', { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
        },
      },
    ]);
  }

  async function restore() {
    const undo = await restoreOriginalTime(db, punchId);
    router.back();
    showToast(`Horário original restaurado (${formatTime(ctx!.punch.originalAt!)})`, {
      actions: [{ label: 'Desfazer', onPress: () => undo() }],
    });
  }

  return (
    <SheetContainer>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="title2">{punchLabel(ctx.punch)}</Text>
          <Text variant="caption" color="textMuted">
            Jornada de {formatShortDate(ctx.workday.refDate)}
          </Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Excluir batida"
          onPress={confirmDelete}
          style={styles.iconButton}
        >
          <Icon name="delete" color="danger" />
        </PressableScale>
      </View>

      <TimeAdjuster initialValue={ctx.punch.at} bounds={ctx.bounds} onChange={setValue} originalAt={ctx.punch.originalAt} />

      {changesRefDate ? (
        <Text variant="caption" color="break" align="center">
          Esta jornada passará para {formatShortDate(current)}.
        </Text>
      ) : null}

      <Divider />
      <PreviewRow label="Trabalhado" before={before.workedMs} after={after.workedMs} />
      <PreviewRow label="Intervalo" before={before.breakMs} after={after.breakMs} />

      <Button label={changed ? 'Salvar' : 'Fechar'} size="lg" block disabled={saving} onPress={save} />
      {ctx.punch.originalAt !== null ? (
        <Button label={`Voltar ao original (${formatTime(ctx.punch.originalAt)})`} variant="ghost" icon="undo" onPress={restore} />
      ) : null}
    </SheetContainer>
  );
}

function PreviewRow({ label, before, after }: { label: string; before: number; after: number }) {
  const changed = before !== after;
  return (
    <View style={styles.preview}>
      <Text variant="body" color="textMuted" style={styles.previewLabel}>
        {label}
      </Text>
      <Text variant="body" tabular color={changed ? 'textMuted' : 'text'}>
        {formatDuration(before)}
      </Text>
      {changed ? (
        <>
          <Icon name="arrow_forward" size={20} color="textMuted" />
          <Text variant="headline" tabular>
            {formatDuration(after)}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1, gap: 2 },
  iconButton: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewLabel: { flex: 1 },
});
