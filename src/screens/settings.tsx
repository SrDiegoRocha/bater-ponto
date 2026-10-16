import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { BrandLockup } from '@/components/brand/brand-mark';
import { Illustration } from '@/components/brand/illustrations';
import { Banner, Button, Card, ChoiceChips, Divider, ListRow, Screen, SectionHeader, Stepper, SwitchRow, Text } from '@/components/ui';
import { TimeField } from '@/components/time/time-field';
import { MoneyInput } from '@/components/ui/money-input';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { getPeriodContaining, periodLabel, periodRangeLabel } from '@/domain/period';
import { MINUTE, toDateKey } from '@/domain/time';
import type { Settings, ThemePreference } from '@/db/settings-repo';
import type { ReminderSettings as ReminderConfig } from '@/domain/reminders';
import { TAX_YEAR } from '@/domain/tax-2026';
import { CLT_RULES, describeRules, type WorkRules } from '@/domain/work-rules';
import { formatDuration, formatMoney, formatShortDate, formatTime } from '@/lib/format';
import { toCents } from '@/domain/salary';
import { authenticate, getLockAvailability } from '@/services/auth-service';
import { backupFlow, eraseFlow, restoreFlow, restoreStoredFlow } from '@/services/backup-flows';
import { listStoredBackups, type StoredBackup } from '@/services/backup-service';
import { remindersAvailable, requestReminderPermission } from '@/services/reminders';
import { useLockStore } from '@/stores/lock-store';
import { showToast } from '@/stores/ui-store';
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
        <ListRow title="Regras da jornada" subtitle={describeRules(s.workRules) + (s.workRules.compensation ? ' · compensação' : '')} icon="schedule" onPress={() => router.push('/ajustes/jornada')} />
        <Divider inset={36} />
        <ListRow title="Escalas" subtitle="Turnos que você repete" icon="view_timeline" onPress={() => router.push('/ajustes/escalas')} />
        <Divider inset={36} />
        <ListRow title="Salário" subtitle={s.salaryMode === 'clt' ? 'Valor da hora · modo CLT' : 'Valor da hora'} icon="payments" value={s.hourlyRate > 0 ? formatMoney(toCents(s.hourlyRate)) : '—'} onPress={() => router.push('/ajustes/salario')} />
        <Divider inset={36} />
        <ListRow title="Feriados" subtitle={s.optionalHolidays ? 'Nacionais + facultativos' : 'Nacionais automáticos'} icon="celebration" onPress={() => router.push('/ajustes/feriados')} />
        <Divider inset={36} />
        <ListRow title="Lembretes" subtitle="Avisos para não esquecer de anotar" icon="notifications" value={s.reminders.enabled ? 'Ligados' : 'Desligados'} onPress={() => router.push('/ajustes/lembretes')} />
        <Divider inset={36} />
        <ListRow title="Segurança" subtitle={s.biometricLock ? 'Trava ligada' : 'Trava desligada'} icon="fingerprint" onPress={() => router.push('/ajustes/seguranca')} />
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
  const { workRules: rules, splitBreak } = useSettings();
  const update = useSettingsStore((st) => st.update);
  const hours = (m: number) => formatDuration(m * MINUTE);
  const set = (patch: Partial<WorkRules>) => update(db, { workRules: { ...rules, ...patch } });
  const isClt =
    rules.dailyLimitMinutes === CLT_RULES.dailyLimitMinutes &&
    rules.weeklyLimitMinutes === CLT_RULES.weeklyLimitMinutes &&
    rules.compensation === CLT_RULES.compensation &&
    rules.tolerance === CLT_RULES.tolerance;

  return (
    <Screen nativeHeader>
      <Text variant="body" color="textMuted">
        Hora extra é o que passar do limite do dia ou do limite da semana. Pela CLT são 8h por dia e 44h por semana. Mude só se o
        seu contrato disser outra coisa.
      </Text>

      <Card style={styles.gap}>
        <Text variant="body" color="textMuted">
          Limite por dia
        </Text>
        <Stepper
          label="Limite por dia"
          value={rules.dailyLimitMinutes}
          min={60}
          max={12 * 60}
          step={10}
          format={hours}
          onChange={(v) => set({ dailyLimitMinutes: v })}
        />
        <Divider />
        <Text variant="body" color="textMuted">
          Limite por semana
        </Text>
        <Stepper
          label="Limite por semana"
          value={rules.weeklyLimitMinutes}
          min={60}
          max={60 * 60}
          step={30}
          format={hours}
          onChange={(v) => set({ weeklyLimitMinutes: v })}
        />
      </Card>

      <Card style={styles.gap}>
        <SwitchRow
          title="Tolerância de 10 min"
          subtitle="Até 10 min a mais no dia não viram hora extra. Passou disso, conta tudo. É regra da CLT."
          value={rules.tolerance}
          onValueChange={(v) => set({ tolerance: v })}
        />
        <Divider />
        <SwitchRow
          title="Acordo de compensação"
          subtitle="Ex.: 8h48 de segunda a sexta para folgar no sábado. Só conta extra o que passar do limite da semana (ou de 10h no dia). Ligue só se tiver esse acordo por escrito."
          value={rules.compensation}
          onValueChange={(v) => set({ compensation: v })}
        />
      </Card>

      <Card style={styles.gap}>
        <SwitchRow
          title="Intervalo fracionado (motorista)"
          subtitle="Para motoristas, cobradores e fiscais de transporte coletivo com convenção coletiva (CLT art. 71 §5º): o intervalo pode ser dividido em vários e ter menos de 1h, desde que fique depois da 1ª hora e antes da última hora de trabalho."
          value={splitBreak}
          onValueChange={(v) => update(db, { splitBreak: v })}
        />
      </Card>

      {!isClt ? <Button label="Voltar ao padrão da CLT" icon="restart_alt" variant="ghost" onPress={() => set(CLT_RULES)} /> : null}

      <Text variant="caption" color="textMuted">
        Em feriados, folgas e domingos (se marcado em Salário) todas as horas são extra 100%. A semana vai de segunda a domingo.
        Não tem jornada fixa? Não precisa configurar nada: o app usa só esses limites.
      </Text>
    </Screen>
  );
}

export function ReminderSettings() {
  const db = useSQLiteContext();
  const { reminders: r, workRules } = useSettings();
  const update = useSettingsStore((st) => st.update);
  const set = (patch: Partial<ReminderConfig>) => update(db, { reminders: { ...r, ...patch } });

  const available = remindersAvailable();

  async function toggle(on: boolean) {
    if (!on) return set({ enabled: false });
    if (await requestReminderPermission()) {
      await set({ enabled: true });
      showToast('Lembretes ligados');
      return;
    }
    Alert.alert('Notificações bloqueadas', 'Permita as notificações do Bater Ponto nas configurações do Android para receber os lembretes.', [
      { text: 'Agora não', style: 'cancel' },
      { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
    ]);
  }

  return (
    <Screen nativeHeader>
      {!available ? (
        <Banner
          tone="warning"
          icon="notifications_off"
          title="Lembretes indisponíveis nesta versão"
          description="Este app não tem o recurso de notificações. Atualize o Expo Go na Play Store ou use a versão instalada do app."
        />
      ) : null}
      <Card style={styles.gap}>
        <SwitchRow
          title="Lembretes"
          subtitle="Avisos para você não esquecer de anotar o ponto"
          value={r.enabled && available}
          onValueChange={toggle}
          disabled={!available}
        />
      </Card>

      {r.enabled && available ? (
        <Card style={styles.gap}>
          <SwitchRow
            title="Passou do limite do dia"
            subtitle={`Avisa se o dia passar de ${formatDuration(workRules.dailyLimitMinutes * MINUTE)} trabalhadas e você ainda não anotou a saída`}
            value={r.overLimit}
            onValueChange={(v) => set({ overLimit: v })}
          />
          <Divider />
          <SwitchRow
            title="Fim do intervalo"
            subtitle="Avisa quando o intervalo completar esse tempo, para você saber a hora de voltar"
            value={r.breakEnd}
            onValueChange={(v) => set({ breakEnd: v })}
          />
          {r.breakEnd ? (
            <Stepper
              label="Duração do intervalo"
              value={r.breakEndMinutes}
              min={15}
              max={4 * 60}
              step={15}
              format={(m) => formatDuration(m * MINUTE)}
              onChange={(v) => set({ breakEndMinutes: v })}
            />
          ) : null}
          <Divider />
          <SwitchRow
            title="Intervalo longo"
            subtitle="Avisa se o intervalo passar desse tempo sem você anotar a volta"
            value={r.longBreak}
            onValueChange={(v) => set({ longBreak: v })}
          />
          {r.longBreak ? (
            <Stepper
              label="Tempo de intervalo"
              value={r.longBreakMinutes}
              min={30}
              max={8 * 60}
              step={30}
              format={(m) => formatDuration(m * MINUTE)}
              onChange={(v) => set({ longBreakMinutes: v })}
            />
          ) : null}
          <Divider />
          <SwitchRow
            title="Fim do dia"
            subtitle="Avisa nesse horário se você não anotou nada no dia. Só nos dias da semana em que costuma trabalhar, fora folgas e feriados."
            value={r.endOfDay}
            onValueChange={(v) => set({ endOfDay: v })}
          />
          {r.endOfDay ? (
            <View style={styles.fieldRow}>
              <TimeField label="Horário do aviso" value={r.endOfDayMinutes} onChange={(v) => set({ endOfDayMinutes: v })} />
            </View>
          ) : null}
        </Card>
      ) : null}

      <Text variant="caption" color="textMuted">
        Os lembretes são do próprio celular e não precisam de internet. Em alguns aparelhos, a economia de bateria pode atrasar o aviso
        alguns minutos.
      </Text>
    </Screen>
  );
}

const LOCK_AFTER = [
  { value: '0', label: 'Na hora' },
  { value: '60', label: '1 min' },
  { value: '300', label: '5 min' },
  { value: '900', label: '15 min' },
] as const;

export function SecuritySettings() {
  const db = useSQLiteContext();
  const { biometricLock, lockAfterSec } = useSettings();
  const update = useSettingsStore((st) => st.update);
  const { data: availability } = useDbQuery(() => getLockAvailability(), []);

  async function toggle(on: boolean) {
    if (!on) {
      if (await authenticate('Confirme para desligar a trava')) update(db, { biometricLock: false });
      return;
    }
    // L1: autenticação de teste antes de ligar — evita trancar o usuário fora
    if (await authenticate('Confirme para ligar a trava')) {
      useLockStore.getState().setLocked(false);
      await update(db, { biometricLock: true });
      showToast('Trava ligada');
    }
  }

  return (
    <Screen nativeHeader>
      <Card style={styles.gap}>
        <SwitchRow
          title="Bloquear com biometria"
          subtitle={
            availability && !availability.available
              ? availability.reason
              : 'Digital, rosto ou o bloqueio de tela do Android'
          }
          value={biometricLock}
          disabled={!availability?.available}
          onValueChange={toggle}
        />
      </Card>
      {biometricLock ? (
        <>
          <SectionHeader title="Pedir de novo após" />
          <ChoiceChips
            options={LOCK_AFTER}
            value={String(lockAfterSec) as (typeof LOCK_AFTER)[number]['value']}
            onChange={(v) => update(db, { lockAfterSec: Number(v) })}
          />
        </>
      ) : null}
      <Text variant="caption" color="textMuted">
        Com a trava ligada, o app pede autenticação ao abrir e ao voltar do segundo plano, esconde o conteúdo na tela de apps
        recentes e confirma de novo antes de restaurar um backup ou apagar os dados. Essa configuração fica só neste aparelho e
        não vai no backup.
      </Text>
    </Screen>
  );
}

export function SalarySettings() {
  const db = useSQLiteContext();
  const s = useSettings();
  const update = useSettingsStore((st) => st.update);
  const set = (patch: Partial<Settings>) => update(db, patch);
  const pct = (v: number) => `+${v}%`;

  return (
    <Screen nativeHeader keyboardShouldPersistTaps="handled">
      <Card style={styles.gap}>
        <Text variant="body" color="textMuted">
          Valor da sua hora
        </Text>
        <MoneyInput label="Valor da hora" value={s.hourlyRate} onCommit={(v) => set({ hourlyRate: v })} />
        <ChoiceChips
          options={[
            { value: 'simple', label: 'Simples', icon: 'calculate' },
            { value: 'clt', label: 'CLT', icon: 'gavel' },
          ]}
          value={s.salaryMode}
          onChange={(v) => set({ salaryMode: v })}
        />
      </Card>

      {s.salaryMode === 'clt' ? (
        <>
          <SectionHeader title="Horas extras" />
          <Card style={styles.gap}>
            <Text variant="body" color="textMuted">
              Hora extra comum (acima do limite do dia ou da semana)
            </Text>
            <Stepper label="Hora extra comum" value={s.overtimePct} min={0} max={200} step={5} format={pct} onChange={(v) => set({ overtimePct: v })} />
            <Text variant="body" color="textMuted">
              Hora extra em feriado ou folga
            </Text>
            <Stepper label="Hora extra em feriado" value={s.holidayOvertimePct} min={0} max={200} step={5} format={pct} onChange={(v) => set({ holidayOvertimePct: v })} />
            <SwitchRow
              title="Domingo conta como feriado"
              subtitle="Horas trabalhadas no domingo pagas como extra de feriado"
              value={s.sundayDouble}
              onValueChange={(v) => set({ sundayDouble: v })}
            />
            <SwitchRow
              title="DSR sobre horas extras"
              subtitle="Reflexo das extras no descanso semanal remunerado"
              value={s.dsrOnExtras}
              onValueChange={(v) => set({ dsrOnExtras: v })}
            />
          </Card>

          <SectionHeader title="Adicional noturno (22h–5h)" />
          <Card style={styles.gap}>
            <Stepper label="Adicional noturno" value={s.nightPct} min={0} max={100} step={5} format={pct} onChange={(v) => set({ nightPct: v })} />
            <SwitchRow
              title="Hora noturna reduzida"
              subtitle="Cada 52min30s noturnos contam como 1 hora"
              value={s.nightReduced}
              onValueChange={(v) => set({ nightReduced: v })}
            />
          </Card>

          <SectionHeader title="Descontos" />
          <Card style={styles.gap}>
            <Text variant="body" color="textMuted">
              Dependentes no Imposto de Renda
            </Text>
            <Stepper label="Dependentes" value={s.dependents} min={0} max={10} onChange={(v) => set({ dependents: v })} />
          </Card>
          <Text variant="caption" color="textMuted">
            INSS e IRRF calculados pelas tabelas de {TAX_YEAR}, incluindo a isenção de IR até R$ 5.000. Os valores são uma
            estimativa: convenções coletivas, benefícios e outros descontos não entram.
          </Text>
        </>
      ) : (
        <Text variant="caption" color="textMuted">
          Modo simples: horas trabalhadas × valor da hora. Intervalos não contam. Ative o modo CLT para horas extras, adicional
          noturno, DSR e descontos.
        </Text>
      )}
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
  const { lastBackupAt, autoBackup } = useSettings();
  const update = useSettingsStore((st) => st.update);
  const [stored, setStored] = useState<StoredBackup[]>(() => {
    try {
      return listStoredBackups();
    } catch {
      return [];
    }
  });
  return (
    <Screen nativeHeader>
      <Card style={styles.gap}>
        <Illustration name={lastBackupAt ? 'done' : 'empty'} size={64} />
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

      <SectionHeader title="Exportar" />
      <Button label="Exportar espelho de ponto (PDF)" icon="picture_as_pdf" variant="secondary" block onPress={() => router.push('/exportar')} />

      <SectionHeader title="Restaurar" />
      <Card style={styles.gap}>
        <Text variant="caption" color="textMuted">
          Substitui os dados atuais pelos do arquivo. Antes, o app guarda uma cópia do que existe agora.
        </Text>
        <Button label="Restaurar backup" icon="restore" variant="secondary" block onPress={() => restoreFlow(db)} />
      </Card>

      <SectionHeader title="Backups guardados no app" />
      <Card style={styles.list}>
        <SwitchRow
          title="Backup automático semanal"
          subtitle="Guarda as 4 cópias mais recentes neste aparelho"
          value={autoBackup}
          onValueChange={(v) => update(db, { autoBackup: v })}
        />
        {stored.map((b) => (
          <View key={b.uri}>
            <Divider />
            <ListRow
              title={b.kind === 'auto' ? 'Automático' : 'Antes de restaurar/apagar'}
              subtitle={b.createdAt ? `${formatShortDate(b.createdAt)} às ${formatTime(b.createdAt)}` : b.name}
              icon={b.kind === 'auto' ? 'schedule' : 'shield'}
              onPress={async () => {
                await restoreStoredFlow(db, b.uri);
                setStored(listStoredBackups());
              }}
            />
          </View>
        ))}
      </Card>
      <Text variant="caption" color="textMuted">
        Estas cópias ficam só neste aparelho. Para trocar de celular, use “Fazer backup agora” e guarde o arquivo fora dele.
      </Text>

      <SectionHeader title="Zona de perigo" />
      <Button label="Apagar todos os dados" icon="delete_forever" variant="destructive" onPress={() => eraseFlow(db)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.xs },
  gap: { gap: spacing.md },
  about: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
  fieldRow: { flexDirection: 'row' },
});
