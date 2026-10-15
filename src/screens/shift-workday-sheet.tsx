import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useDbQuery } from '@/hooks/use-db-query';
import { MINUTE } from '@/domain/time';
import { getWorkday } from '@/db/workday-repo';
import { formatShortDate, formatTime } from '@/lib/format';
import { shiftWorkday } from '@/services/punch-service';
import { showToast } from '@/stores/ui-store';
import { spacing } from '@/theme';

import { SheetContainer } from './sheet-container';

// Mover todas as batidas do dia de uma vez (ex.: tudo ficou 10 min atrasado).

const STEPS = [-15, -5, -1, 1, 5, 15];

export function ShiftWorkdaySheet({ workdayId }: { workdayId: string }) {
  const db = useSQLiteContext();
  const { data: workday } = useDbQuery((d) => getWorkday(d, workdayId), [workdayId]);
  const [offset, setOffset] = useState(0);

  if (!workday || workday.punches.length === 0) return <SheetContainer />;

  const first = workday.punches[0].at + offset * MINUTE;
  const last = workday.punches.at(-1)!.at + offset * MINUTE;
  const sign = offset > 0 ? '+' : offset < 0 ? '−' : '';

  async function save() {
    try {
      const undo = await shiftWorkday(db, workdayId, offset * MINUTE);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
      showToast(`Jornada movida ${sign}${Math.abs(offset)} min`, { actions: [{ label: 'Desfazer', onPress: () => undo() }] });
    } catch (e) {
      Alert.alert('Não foi possível mover', (e as Error).message);
    }
  }

  return (
    <SheetContainer>
      <Text variant="title2">Mover jornada inteira</Text>
      <Text variant="caption" color="textMuted">
        Todas as batidas de {formatShortDate(workday.refDate)} andam juntas. Os intervalos não mudam.
      </Text>
      <Text variant="display" tabular align="center">
        {sign}
        {Math.abs(offset)} min
      </Text>
      <Text variant="body" color="textMuted" align="center" tabular>
        {formatTime(first)} → {formatTime(last)}
      </Text>
      <View style={styles.row}>
        {STEPS.map((s) => (
          <Button
            key={s}
            label={`${s > 0 ? '+' : '−'}${Math.abs(s)}`}
            variant="secondary"
            size="sm"
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setOffset(offset + s);
            }}
          />
        ))}
      </View>
      <Button label={offset === 0 ? 'Escolha quanto mover' : 'Mover'} size="lg" block disabled={offset === 0} onPress={save} />
    </SheetContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
});
