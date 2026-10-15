import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, StyleSheet, View } from 'react-native';

import { Card, Divider, ListRow, Screen, Text } from '@/components/ui';
import { useDbQuery } from '@/hooks/use-db-query';
import { describeTemplate, type ShiftTemplate } from '@/domain/templates';
import type { DateKey } from '@/domain/types';
import { summarizeWorkday } from '@/domain/workday';
import { listTemplates } from '@/db/template-repo';
import { listRecentClosedWorkdays, type WorkdayWithPunches } from '@/db/workday-repo';
import { formatDuration, formatShortDate, formatTime } from '@/lib/format';
import { applyTemplateToDates, copyWorkdayToDates, type CopyResult } from '@/services/punch-service';
import { showToast } from '@/stores/ui-store';
import { spacing } from '@/theme';

// Preencher dias escolhidos (seleção do calendário) com uma escala modelo ou uma jornada recente.

export function ApplySheet({ dates }: { dates: DateKey[] }) {
  const db = useSQLiteContext();
  const { data } = useDbQuery(
    async (d) => ({ templates: await listTemplates(d), recent: await listRecentClosedWorkdays(d, 8) }),
    [],
  );

  async function run(label: string, action: () => Promise<CopyResult>) {
    let result: CopyResult;
    try {
      result = await action();
    } catch (e) {
      Alert.alert('Não foi possível aplicar', (e as Error).message);
      return;
    }
    const { created, skipped, undo } = result;
    if (created.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
      showToast(`${label} em ${created.length} ${created.length === 1 ? 'dia' : 'dias'}${skipped.length ? ` · ${skipped.length} pulado` : ''}`, {
        actions: [{ label: 'Desfazer', onPress: () => undo() }],
      });
    }
    if (skipped.length > 0) {
      Alert.alert(
        created.length ? 'Alguns dias foram pulados' : 'Nenhum dia preenchido',
        skipped.map((s) => `• ${formatShortDate(s.date)}: ${s.reason}`).join('\n'),
      );
    }
  }

  const applyTemplate = (t: ShiftTemplate) => run(`“${t.name}” aplicada`, () => applyTemplateToDates(db, t, dates));
  const copyWorkday = (w: WorkdayWithPunches) =>
    run(`Jornada de ${formatShortDate(w.refDate)} copiada`, () => copyWorkdayToDates(db, w.id, dates));

  return (
    <Screen nativeHeader>
      <View style={styles.gapSm}>
        <Text variant="title2">{dates.length === 1 ? formatShortDate(dates[0]) : `${dates.length} dias selecionados`}</Text>
        <Text variant="caption" color="textMuted">
          Escolha uma escala ou uma jornada recente. Dias com folga ou que já têm jornada são pulados.
        </Text>
      </View>

      <Text variant="micro" color="textMuted">
        Escalas
      </Text>
      <Card style={styles.list}>
      {data && data.templates.length === 0 ? (
        <ListRow title="Criar uma escala" subtitle="Turnos que você repete com frequência" icon="add" iconColor="primary" onPress={() => router.replace('/escala')} />
      ) : (
        (data?.templates ?? []).map((t, i) => (
          <View key={t.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow title={t.name} subtitle={describeTemplate(t)} icon="view_timeline" iconColor="primary" onPress={() => applyTemplate(t)} />
          </View>
        ))
      )}
      </Card>

      <Text variant="micro" color="textMuted">
        Copiar uma jornada recente
      </Text>
      <Card style={styles.list}>
      {(data?.recent ?? []).map((w, i) => {
        const s = summarizeWorkday(w.punches);
        return (
          <View key={w.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={formatShortDate(w.refDate)}
              subtitle={`${formatTime(w.punches[0].at)} → ${formatTime(w.punches.at(-1)!.at)} · ${s.segments.length} ${s.segments.length === 1 ? 'turno' : 'turnos'}`}
              value={formatDuration(s.workedMs)}
              icon="content_copy"
              onPress={() => copyWorkday(w)}
            />
          </View>
        );
      })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gapSm: { gap: spacing.xs },
  list: { paddingVertical: spacing.xs },
});
