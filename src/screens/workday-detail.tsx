import { router, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { Banner, Button, Card, EmptyState, Screen, StatCard, StatGrid, StatusPill, SwitchRow, Text } from '@/components/ui';
import { Timeline } from '@/components/workday/timeline';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { checkBreak, describeBreakIssue } from '@/domain/break-rules';
import { holidaysInRange } from '@/domain/holidays';
import { nightMs } from '@/domain/night-hours';
import { MIN_REST_MS } from '@/domain/validation';
import { summarizeWorkday } from '@/domain/workday';
import { listHolidayOverrides } from '@/db/holiday-repo';
import { getNeighborBounds, getWorkday, setWorkdayNote } from '@/db/workday-repo';
import { formatDuration, formatLongDay } from '@/lib/format';
import { setHolidayOnDates } from '@/services/holiday-service';
import { endWorkdayAtLastPunch, removeWorkday } from '@/services/punch-service';
import { useSettings } from '@/stores/settings-store';
import { bumpData } from '@/stores/data-store';
import { showToast } from '@/stores/ui-store';
import { radius, spacing, useTheme } from '@/theme';

// Detalhe da jornada (§5.4): totais, timeline editável, turnos, interjornada e observação.

export function WorkdayDetail({ workdayId }: { workdayId: string }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const now = useNow();
  const { optionalHolidays, splitBreak } = useSettings();
  const { data, loading } = useDbQuery(async (d) => {
    const workday = await getWorkday(d, workdayId);
    if (!workday) return null;
    const first = workday.punches[0]?.at;
    const last = workday.punches.at(-1)?.at;
    const neighbors = first != null ? await getNeighborBounds(d, first, workdayId) : null;
    return {
      workday,
      overrides: await listHolidayOverrides(d),
      restBefore: neighbors?.previousWorkdayEnd != null && first != null ? first - neighbors.previousWorkdayEnd : null,
      restAfter: neighbors?.nextWorkdayStart != null && last != null ? neighbors.nextWorkdayStart - last : null,
    };
  }, [workdayId]);
  const [note, setNote] = useState<string | null>(null);

  if (loading) return <Screen nativeHeader />;
  if (!data) {
    return (
      <Screen nativeHeader>
        <Stack.Screen options={{ title: 'Jornada' }} />
        <EmptyState title="Jornada não encontrada" description="Ela pode ter sido excluída." />
      </Screen>
    );
  }

  const { workday, restBefore, restAfter } = data;
  const holiday = holidaysInRange(workday.refDate, workday.refDate, data.overrides, { includeOptional: optionalHolidays }).get(workday.refDate);
  const summary = summarizeWorkday(workday.punches, now);
  // Só confere o intervalo de jornada encerrada e coerente
  const breakIssue = workday.status === 'closed' && summary.isConsistent ? checkBreak(summary, { splitBreak }) : null;
  const night = summary.segments.reduce((sum, s) => sum + nightMs(s), 0);
  const last = workday.punches.at(-1);

  async function toggleHoliday(on: boolean) {
    const undo = await setHolidayOnDates(db, [workday.refDate], on, { includeOptional: optionalHolidays });
    showToast(on ? 'Dia marcado como feriado' : 'Feriado removido', { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
  }

  async function saveNote() {
    if (note === null || note === (workday.note ?? '')) return;
    await setWorkdayNote(db, workdayId, note.trim() || null);
    bumpData();
  }

  function confirmDelete() {
    Alert.alert('Excluir jornada?', `Todas as batidas de ${formatLongDay(workday.refDate)} serão removidas.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const undo = await removeWorkday(db, workdayId);
          router.back();
          showToast('Jornada excluída', { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
        },
      },
    ]);
  }

  async function endAtLast() {
    try {
      const undo = await endWorkdayAtLastPunch(db, workdayId);
      showToast('Dia encerrado na última saída', { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
    } catch (e) {
      Alert.alert('Não foi possível encerrar', (e as Error).message);
    }
  }

  return (
    <Screen nativeHeader>
      <Stack.Screen options={{ title: formatLongDay(workday.refDate) }} />

      <StatusPill
        status={workday.status === 'open' ? 'work' : 'off'}
        label={workday.status === 'open' ? 'Em andamento' : workday.status === 'closed' ? 'Encerrada' : 'Incompleta'}
      />

      {!summary.isConsistent ? (
        <Banner
          tone="danger"
          icon="error"
          title="Falta uma batida"
          description="Entradas e saídas precisam alternar. Adicione a batida que faltou ou exclua a que sobrou."
          actionLabel="Adicionar"
          onPress={() => router.push({ pathname: '/turno', params: { workdayId } })}
        />
      ) : workday.status === 'incomplete' ? (
        <Banner
          tone="warning"
          icon="schedule"
          title="Jornada sem fim do dia"
          description={last?.kind === 'out' ? 'Encerrar na última saída?' : 'Adicione a saída que faltou.'}
          actionLabel={last?.kind === 'out' ? 'Encerrar' : 'Adicionar'}
          onPress={last?.kind === 'out' ? endAtLast : () => router.push({ pathname: '/turno', params: { workdayId } })}
        />
      ) : null}

      {breakIssue ? (
        <Banner tone="warning" icon="coffee" title="Intervalo fora da regra" description={describeBreakIssue(breakIssue, formatDuration)} />
      ) : null}

      <StatGrid>
        <StatCard label="Trabalhado" value={formatDuration(summary.workedMs)} icon="work" color="work" />
        <StatCard label="Intervalo" value={formatDuration(summary.breakMs)} icon="pause" color="break" />
        <StatCard
          label="Amplitude"
          value={summary.span ? formatDuration(summary.span.end - summary.span.start) : '—'}
          icon="straighten"
        />
        <StatCard label="Noturno" value={formatDuration(night)} icon="dark_mode" color="night" />
      </StatGrid>

      <Card style={styles.holidayCard}>
        <SwitchRow
          title={holiday ? `Feriado · ${holiday.name}` : 'Feriado neste dia'}
          subtitle="Trabalho em feriado conta como extra 100%. Marque também os municipais e estaduais."
          value={!!holiday}
          onValueChange={toggleHoliday}
        />
      </Card>

      <Card>
        <Timeline punches={workday.punches} now={now} editable live={workday.status === 'open'} />
        <Text variant="caption" color="textMuted" align="center" style={styles.hint}>
          Toque numa batida para ajustar · segure para excluir
        </Text>
        <View style={styles.actions}>
          <Button
            label="Adicionar turno ou batida"
            icon="add"
            variant="secondary"
            block
            onPress={() => router.push({ pathname: '/turno', params: { workdayId } })}
          />
          {workday.status === 'closed' && summary.isConsistent ? (
            <Button
              label="Copiar para outros dias"
              icon="content_copy"
              variant="ghost"
              block
              onPress={() => router.push({ pathname: '/copiar', params: { workdayId } })}
            />
          ) : null}
          {workday.status === 'closed' && summary.isConsistent ? (
            <Button
              label="Salvar como escala"
              icon="view_timeline"
              variant="ghost"
              block
              onPress={() => router.push({ pathname: '/escala', params: { fromWorkday: workdayId } })}
            />
          ) : null}
          {workday.punches.length > 0 ? (
            <Button
              label="Mover jornada inteira"
              icon="swap_horiz"
              variant="ghost"
              block
              onPress={() => router.push({ pathname: '/mover', params: { workdayId } })}
            />
          ) : null}
        </View>
      </Card>

      {restBefore !== null || restAfter !== null ? (
        <Card style={styles.gap}>
          <Text variant="micro" color="textMuted">
            Interjornada
          </Text>
          {restBefore !== null ? <RestLine label="Antes" ms={restBefore} /> : null}
          {restAfter !== null ? <RestLine label="Depois" ms={restAfter} /> : null}
        </Card>
      ) : null}

      <Card style={styles.gap}>
        <Text variant="micro" color="textMuted">
          Observação
        </Text>
        <TextInput
          value={note ?? workday.note ?? ''}
          onChangeText={setNote}
          onEndEditing={saveNote}
          placeholder="Ex.: cobri o turno do colega"
          placeholderTextColor={colors.textMuted}
          multiline
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
      </Card>

      <Button label="Excluir jornada" icon="delete" variant="destructive" onPress={confirmDelete} />
    </Screen>
  );
}

function RestLine({ label, ms }: { label: string; ms: number }) {
  const short = ms < MIN_REST_MS;
  return (
    <Text variant="body" color={short ? 'break' : 'text'} tabular>
      {label}: {formatDuration(ms)}
      {short ? ' · abaixo de 11h' : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  actions: { marginTop: spacing.md, gap: spacing.sm },
  hint: { marginTop: spacing.sm },
  holidayCard: { paddingVertical: spacing.sm },
  gap: { gap: spacing.sm },
  input: {
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    textAlignVertical: 'top',
  },
});
