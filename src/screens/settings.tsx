import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StyleSheet, View } from 'react-native';

import { BrandLockup } from '@/components/brand/brand-mark';
import { Button, Card, ChoiceChips, Divider, ListRow, Screen, SectionHeader, Stepper, Text } from '@/components/ui';
import { MoneyInput } from '@/components/ui/money-input';
import { useNow } from '@/hooks/use-now';
import { getPeriodContaining, periodLabel, periodRangeLabel } from '@/domain/period';
import { MINUTE, toDateKey } from '@/domain/time';
import type { ThemePreference } from '@/db/settings-repo';
import { formatDuration, formatMoney } from '@/lib/format';
import { toCents } from '@/domain/salary';
import { backupFlow, eraseFlow, restoreFlow } from '@/services/backup-flows';
import { useSettings, useSettingsStore } from '@/stores/settings-store';
import { spacing } from '@/theme';

// Ajustes (§5.7) e subtelas.

const themeLabel: Record<ThemePreference, string> = { system: 'Sistema', light: 'Claro', dark: 'Escuro' };

export function SettingsHome() {
  const s = useSettings();
  return (
    <Screen nativeHeader>
      <Card style={styles.list}>
        <ListRow title="Período" subtitle="Dia em que seu mês começa" icon="date_range" value={`dia ${s.periodStartDay}`} onPress={() => router.push('/ajustes/periodo')} />
        <Divider inset={36} />
        <ListRow title="Jornada" subtitle="Meta diária" icon="schedule" value={formatDuration(s.dailyGoal.defaultMinutes * MINUTE)} onPress={() => router.push('/ajustes/jornada')} />
        <Divider inset={36} />
        <ListRow title="Salário" subtitle="Valor da hora" icon="payments" value={s.hourlyRate > 0 ? formatMoney(toCents(s.hourlyRate)) : '—'} onPress={() => router.push('/ajustes/salario')} />
        <Divider inset={36} />
        <ListRow title="Aparência" icon="contrast" value={themeLabel[s.theme]} onPress={() => router.push('/ajustes/aparencia')} />
        <Divider inset={36} />
        <ListRow
          title="Dados e backup"
          icon="cloud_upload"
          subtitle={s.lastBackupAt ? `Último backup ${formatDistanceToNow(s.lastBackupAt, { locale: ptBR, addSuffix: true })}` : 'Nenhum backup ainda'}
          onPress={() => router.push('/ajustes/dados')}
        />
      </Card>
      <View style={styles.about}>
        <BrandLockup size={28} />
        <Text variant="caption" color="textMuted">
          Versão {Constants.expoConfig?.version ?? '1.0.0'} · seus dados ficam só neste aparelho
        </Text>
      </View>
    </Screen>
  );
}

export function PeriodSettings() {
  const db = useSQLiteContext();
  const { periodStartDay } = useSettings();
  const update = useSettingsStore((st) => st.update);
  const now = useNow();
  const preview = getPeriodContaining(toDateKey(now), periodStartDay);

  return (
    <Screen nativeHeader>
      <Card style={styles.gap}>
        <Text variant="body" color="textMuted">
          Seu mês começa no dia
        </Text>
        <Stepper label="Dia de início" value={periodStartDay} min={1} max={31} onChange={(v) => update(db, { periodStartDay: v })} />
        <Text variant="headline" align="center">
          {periodLabel(preview)} · {periodRangeLabel(preview)}
        </Text>
      </Card>
      <Text variant="caption" color="textMuted">
        O período vai do dia escolhido até a véspera do mesmo dia no mês seguinte. Em meses mais curtos, os dias 29, 30 e 31
        viram o último dia do mês. Mudar aqui só muda a forma de agrupar: nenhum registro é alterado.
      </Text>
    </Screen>
  );
}

export function WorkdaySettings() {
  const db = useSQLiteContext();
  const { dailyGoal } = useSettings();
  const update = useSettingsStore((st) => st.update);
  return (
    <Screen nativeHeader>
      <Card style={styles.gap}>
        <Text variant="body" color="textMuted">
          Meta diária
        </Text>
        <Stepper
          label="Meta diária"
          value={dailyGoal.defaultMinutes}
          min={0}
          max={16 * 60}
          step={15}
          format={(m) => formatDuration(m * MINUTE)}
          onChange={(v) => update(db, { dailyGoal: { ...dailyGoal, defaultMinutes: v } })}
        />
      </Card>
      <Text variant="caption" color="textMuted">
        Usada no anel da tela Hoje e no banco de horas. Em folgas, férias, atestados e feriados a meta é zero, então qualquer hora
        trabalhada nesses dias vira saldo positivo.
      </Text>
    </Screen>
  );
}

export function SalarySettings() {
  const db = useSQLiteContext();
  const { hourlyRate } = useSettings();
  const update = useSettingsStore((st) => st.update);
  return (
    <Screen nativeHeader keyboardShouldPersistTaps="handled">
      <Card style={styles.gap}>
        <Text variant="body" color="textMuted">
          Valor da sua hora
        </Text>
        <MoneyInput label="Valor da hora" value={hourlyRate} onCommit={(v) => update(db, { hourlyRate: v })} />
      </Card>
      <Text variant="caption" color="textMuted">
        Usado para estimar o salário bruto do período (horas trabalhadas × valor da hora). Intervalos não contam.
      </Text>
    </Screen>
  );
}

export function AppearanceSettings() {
  const db = useSQLiteContext();
  const { theme } = useSettings();
  const update = useSettingsStore((st) => st.update);
  return (
    <Screen nativeHeader>
      <ChoiceChips
        options={[
          { value: 'system', label: 'Sistema', icon: 'brightness_auto' },
          { value: 'light', label: 'Claro', icon: 'light_mode' },
          { value: 'dark', label: 'Escuro', icon: 'dark_mode' },
        ]}
        value={theme}
        onChange={(v: ThemePreference) => update(db, { theme: v })}
      />
      <Text variant="caption" color="textMuted">
        “Sistema” acompanha o modo claro/escuro do Android automaticamente.
      </Text>
    </Screen>
  );
}

export function DataSettings() {
  const db = useSQLiteContext();
  const { lastBackupAt } = useSettings();
  return (
    <Screen nativeHeader>
      <Card style={styles.gap}>
        <Text variant="headline">
          {lastBackupAt
            ? `Último backup ${formatDistanceToNow(lastBackupAt, { locale: ptBR, addSuffix: true })}`
            : 'Você ainda não fez backup'}
        </Text>
        <Text variant="caption" color="textMuted">
          O backup é um arquivo com todas as suas jornadas, folgas e configurações. Salve no Google Drive ou envie para você
          mesmo para não perder nada ao trocar de celular.
        </Text>
        <Button label="Fazer backup agora" icon="cloud_upload" block onPress={() => backupFlow(db)} />
      </Card>

      <SectionHeader title="Restaurar" />
      <Card style={styles.gap}>
        <Text variant="caption" color="textMuted">
          Substitui os dados atuais pelos do arquivo. Antes, o app guarda uma cópia do que existe agora.
        </Text>
        <Button label="Restaurar backup" icon="restore" variant="secondary" block onPress={() => restoreFlow(db)} />
      </Card>

      <SectionHeader title="Zona de perigo" />
      <Button label="Apagar todos os dados" icon="delete_forever" variant="destructive" onPress={() => eraseFlow(db)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.xs },
  gap: { gap: spacing.md },
  about: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
});
