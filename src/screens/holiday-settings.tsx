import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Divider, Icon, Screen, SectionHeader, SwitchRow, Text } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useDbQuery } from '@/hooks/use-db-query';
import { nationalHolidays, type Holiday } from '@/domain/holidays';
import { fromDateKey, toDateKey } from '@/domain/time';
import { addCustomHoliday, deleteCustomHoliday, disableHoliday, enableHoliday, listHolidayOverrides } from '@/db/holiday-repo';
import { formatShortDate } from '@/lib/format';
import { bumpData } from '@/stores/data-store';
import { useSettings, useSettingsStore } from '@/stores/settings-store';
import { showToast } from '@/stores/ui-store';
import { fonts, minTouch, radius, spacing, useTheme } from '@/theme';

import { SheetContainer } from './sheet-container';

// Ajustes → Feriados (§5.8 / regras H4 e H5).

export function HolidaySettings() {
  const db = useSQLiteContext();
  const { optionalHolidays } = useSettings();
  const update = useSettingsStore((s) => s.update);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { data: overrides } = useDbQuery((d) => listHolidayOverrides(d), []);

  const disabled = (overrides ?? []).filter((o) => o.kind === 'disabled');
  const customs = (overrides ?? []).filter((o) => o.kind === 'custom');
  const isDisabled = (key: string) => disabled.some((d) => d.holidayKey === key && (d.year === null || d.year === year));

  const national = nationalHolidays(year, { includeOptional: optionalHolidays });

  async function toggle(h: Holiday, enabled: boolean) {
    if (enabled) {
      await enableHoliday(db, h.key, year);
      await enableHoliday(db, h.key, null);
      bumpData();
      return;
    }
    Alert.alert(`Desativar ${h.name}?`, 'O dia passa a contar como dia comum.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: `Só em ${year}`, onPress: () => disableHoliday(db, h.key, year).then(bumpData) },
      { text: 'Todos os anos', onPress: () => disableHoliday(db, h.key, null).then(bumpData) },
    ]);
  }

  function removeCustom(id: string, name: string) {
    Alert.alert(`Excluir “${name}”?`, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteCustomHoliday(db, id);
          bumpData();
          showToast('Feriado excluído');
        },
      },
    ]);
  }

  return (
    <Screen nativeHeader>
      <View style={styles.yearRow}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Ano anterior" onPress={() => setYear(year - 1)} style={styles.arrow}>
          <Icon name="chevron_left" />
        </PressableScale>
        <Text variant="title2" tabular>
          {year}
        </Text>
        <PressableScale accessibilityRole="button" accessibilityLabel="Próximo ano" onPress={() => setYear(year + 1)} style={styles.arrow}>
          <Icon name="chevron_right" />
        </PressableScale>
      </View>

      <Card>
        <SwitchRow
          title="Pontos facultativos"
          subtitle="Carnaval, Quarta de Cinzas e Corpus Christi"
          value={optionalHolidays}
          onValueChange={(v) => update(db, { optionalHolidays: v })}
        />
      </Card>

      <SectionHeader title="Nacionais" />
      <Card style={styles.list}>
        {national.map((h, i) => (
          <View key={h.key}>
            {i > 0 ? <Divider /> : null}
            <SwitchRow
              title={h.name}
              subtitle={`${formatShortDate(h.date)}${h.kind === 'optional' ? ' · facultativo' : ''}`}
              value={!isDisabled(h.key)}
              onValueChange={(v) => toggle(h, v)}
            />
          </View>
        ))}
      </Card>

      <SectionHeader
        title="Seus feriados"
        action={<Button label="Adicionar" icon="add" variant="ghost" size="sm" onPress={() => router.push('/feriado-novo')} />}
      />
      <Card style={styles.list}>
        {customs.length === 0 ? (
          <Text variant="caption" color="textMuted" style={styles.empty}>
            Adicione feriados da sua cidade ou estado (ex.: aniversário da cidade).
          </Text>
        ) : (
          customs.map((c, i) =>
            c.kind === 'custom' ? (
              <View key={c.id}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.customRow}>
                  <View style={styles.flex}>
                    <Text variant="body">{c.name}</Text>
                    <Text variant="caption" color="textMuted">
                      {c.monthDay ? `${c.monthDay.split('-').reverse().join('/')} · todo ano` : formatShortDate(c.date!)}
                    </Text>
                  </View>
                  <PressableScale accessibilityRole="button" accessibilityLabel={`Excluir ${c.name}`} onPress={() => removeCustom(c.id, c.name)} style={styles.arrow}>
                    <Icon name="delete" color="danger" />
                  </PressableScale>
                </View>
              </View>
            ) : null,
          )
        )}
      </Card>
    </Screen>
  );
}

/** Sheet: novo feriado próprio (H5) */
export function NewHoliday() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [date, setDate] = useState(() => toDateKey(Date.now()));
  const [recurring, setRecurring] = useState(true);
  const [picking, setPicking] = useState(false);

  async function save() {
    if (!name.trim()) return Alert.alert('Dê um nome ao feriado');
    await addCustomHoliday(db, { name: name.trim(), date, recurring });
    bumpData();
    router.back();
    showToast(`${name.trim()} adicionado`);
  }

  return (
    <SheetContainer>
      <Text variant="title2">Novo feriado</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Nome (ex.: Aniversário da cidade)"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        autoFocus
      />
      <Button label={formatShortDate(date)} icon="calendar_today" variant="secondary" block onPress={() => setPicking(true)} />
      <SwitchRow title="Repetir todo ano" value={recurring} onValueChange={setRecurring} />
      <Button label="Salvar" size="lg" block onPress={save} />
      {picking && (
        <DateTimePicker
          value={fromDateKey(date)}
          mode="date"
          accentColor={colors.primary}
          onValueChange={(_, d) => {
            setPicking(false);
            setDate(toDateKey(d));
          }}
          onDismiss={() => setPicking(false)}
        />
      )}
    </SheetContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  arrow: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: spacing.xs },
  empty: { paddingVertical: spacing.md },
  customRow: { flexDirection: 'row', alignItems: 'center', minHeight: minTouch + spacing.sm },
  input: {
    minHeight: minTouch + 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
});
