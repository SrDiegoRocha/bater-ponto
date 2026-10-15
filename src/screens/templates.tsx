import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { TimeField } from '@/components/time/time-field';
import { Button, Card, Divider, EmptyState, ListRow, Screen, Text } from '@/components/ui';
import { useDbQuery } from '@/hooks/use-db-query';
import { describeTemplate, shiftsFromPunches, templateToShifts, type TemplateShift } from '@/domain/templates';
import { toDateKey } from '@/domain/time';
import { summarizeWorkday } from '@/domain/workday';
import { deleteTemplate, listTemplates, saveTemplate } from '@/db/template-repo';
import { getWorkday } from '@/db/workday-repo';
import { formatDuration } from '@/lib/format';
import { bumpData } from '@/stores/data-store';
import { showToast } from '@/stores/ui-store';
import { fonts, minTouch, radius, spacing, useTheme } from '@/theme';

// Escalas modelo: lista (Ajustes → Escalas) e editor.

/** Duração total de trabalho de uma escala */
function templateWorkedMs(shifts: TemplateShift[]): number {
  const s = templateToShifts({ shifts }, toDateKey(new Date(2026, 0, 5)));
  return summarizeWorkday(s.flatMap((x) => [{ kind: 'in' as const, at: x.start }, { kind: 'out' as const, at: x.end }])).workedMs;
}

export function TemplateList() {
  const { data: templates } = useDbQuery((d) => listTemplates(d), []);
  return (
    <Screen nativeHeader>
      <Text variant="body" color="textMuted">
        Salve as escalas que você repete (ex.: “Escala A: 08–11 / 16–23”) e aplique em um ou vários dias com um toque, pelo
        calendário ou ao registrar uma jornada.
      </Text>
      {templates && templates.length === 0 ? (
        <EmptyState title="Nenhuma escala ainda" description="Crie uma aqui ou use “Salvar como escala” no detalhe de uma jornada." />
      ) : (
        <Card style={styles.list}>
          {(templates ?? []).map((t, i) => (
            <View key={t.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={t.name}
                subtitle={`${describeTemplate(t)} · ${formatDuration(templateWorkedMs(t.shifts))}`}
                icon="view_timeline"
                iconColor="primary"
                onPress={() => router.push({ pathname: '/escala', params: { id: t.id } })}
              />
            </View>
          ))}
        </Card>
      )}
      <Button label="Nova escala" icon="add" block onPress={() => router.push('/escala')} />
    </Screen>
  );
}

export function TemplateEditor({ id, fromWorkday }: { id?: string; fromWorkday?: string }) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { data } = useDbQuery(
    async (d) => ({
      existing: id ? (await listTemplates(d)).find((t) => t.id === id) ?? null : null,
      workday: fromWorkday ? await getWorkday(d, fromWorkday) : null,
    }),
    [id, fromWorkday],
  );
  const [name, setName] = useState<string | null>(null);
  const [shifts, setShifts] = useState<TemplateShift[] | null>(null);

  if (!data) return <Screen nativeHeader />;

  const initialShifts =
    data.existing?.shifts ?? (data.workday ? shiftsFromPunches(data.workday.punches) : null) ?? [{ start: 8 * 60, end: 12 * 60 }];
  const currentShifts = shifts ?? initialShifts;
  const currentName = name ?? data.existing?.name ?? '';

  const update = (i: number, patch: Partial<TemplateShift>) =>
    setShifts(currentShifts.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  async function save() {
    if (!currentName.trim()) return Alert.alert('Dê um nome para a escala');
    await saveTemplate(db, { id, name: currentName.trim(), shifts: currentShifts });
    bumpData();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
    showToast(`Escala “${currentName.trim()}” salva`);
  }

  function remove() {
    Alert.alert(`Excluir “${currentName}”?`, 'As jornadas já criadas com ela não mudam.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteTemplate(db, id!);
          bumpData();
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen nativeHeader keyboardShouldPersistTaps="handled">
      <TextInput
        value={currentName}
        onChangeText={setName}
        placeholder="Nome da escala (ex.: Escala A)"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      {currentShifts.map((shift, i) => (
        <Card key={i} style={styles.shift}>
          <View style={styles.shiftHeader}>
            <Text variant="micro" color="textMuted">
              Turno {i + 1}
            </Text>
            {currentShifts.length > 1 ? (
              <Button label="Remover" variant="destructive" size="sm" onPress={() => setShifts(currentShifts.filter((_, j) => j !== i))} />
            ) : null}
          </View>
          <TimeField label="Entrada" value={shift.start} onChange={(v) => update(i, { start: v })} />
          <TimeField label="Saída" value={shift.end} onChange={(v) => update(i, { end: v })} />
        </Card>
      ))}
      <Button
        label="Adicionar turno"
        icon="add"
        variant="secondary"
        block
        onPress={() => {
          const lastEnd = currentShifts.at(-1)!.end;
          setShifts([...currentShifts, { start: (lastEnd + 60) % 1440, end: (lastEnd + 180) % 1440 }]);
        }}
      />
      <Text variant="body" color="textMuted" align="center" tabular>
        {describeTemplate({ shifts: currentShifts })} · {formatDuration(templateWorkedMs(currentShifts))}
      </Text>
      <Button label="Salvar escala" size="lg" block onPress={save} />
      {id ? <Button label="Excluir escala" icon="delete" variant="destructive" onPress={remove} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.xs },
  shift: { gap: spacing.sm },
  shiftHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    minHeight: minTouch + 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.medium,
    fontSize: 17,
  },
});
