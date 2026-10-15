import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { Banner, Button, Card, ChoiceChips, Divider, Screen, Text } from '@/components/ui';
import { useCltBreakdown } from '@/hooks/use-clt-breakdown';
import { useDbQuery } from '@/hooks/use-db-query';
import { useSelectedPeriod } from '@/hooks/use-period-stats';
import {
  comparePayslip,
  EMPTY_PAYSLIP,
  formatHoursInput,
  parseHours,
  type CheckRow,
  type HoursFormat,
  type Payslip,
  type PayslipValues,
} from '@/domain/payslip';
import { periodLabel, periodRangeLabel, type Period } from '@/domain/period';
import { deletePayslip, getPayslip, savePayslip } from '@/db/payslip-repo';
import { formatDuration, formatMoney } from '@/lib/format';
import { parseMoney } from '@/lib/money';
import { bumpData } from '@/stores/data-store';
import { useSettings } from '@/stores/settings-store';
import { showToast } from '@/stores/ui-store';
import { fonts, radius, spacing, useTheme } from '@/theme';

// Conferência do holerite (CLT): o que a empresa pagou × o que o app calculou pelas batidas anotadas.

type Fields = {
  extraHours: string;
  extraValue: string;
  extraDoubleHours: string;
  extraDoubleValue: string;
  nightHours: string;
  nightValue: string;
  dsrValue: string;
};

const moneyText = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2).replace('.', ','));
const parseCents = (text: string) => {
  const reais = text.trim() ? parseMoney(text) : null;
  return reais === null ? null : Math.round(reais * 100);
};

function toFields(v: PayslipValues): Fields {
  return {
    extraHours: formatHoursInput(v.extraMs, v.hoursFormat),
    extraValue: moneyText(v.extraCents),
    extraDoubleHours: formatHoursInput(v.extraDoubleMs, v.hoursFormat),
    extraDoubleValue: moneyText(v.extraDoubleCents),
    nightHours: formatHoursInput(v.nightMs, v.hoursFormat),
    nightValue: moneyText(v.nightCents),
    dsrValue: moneyText(v.dsrCents),
  };
}

function toValues(f: Fields, hoursFormat: HoursFormat): PayslipValues {
  return {
    hoursFormat,
    extraMs: parseHours(f.extraHours, hoursFormat),
    extraCents: parseCents(f.extraValue),
    extraDoubleMs: parseHours(f.extraDoubleHours, hoursFormat),
    extraDoubleCents: parseCents(f.extraDoubleValue),
    nightMs: parseHours(f.nightHours, hoursFormat),
    nightCents: parseCents(f.nightValue),
    dsrCents: parseCents(f.dsrValue),
  };
}

export function PayslipCheck() {
  const period = useSelectedPeriod();
  const { data: saved } = useDbQuery((d) => getPayslip(d, period), [period.start]);
  // Espera o que já foi salvo para preencher o formulário uma vez só
  if (saved === undefined) return <Screen nativeHeader />;
  return <PayslipForm period={period} saved={saved} />;
}

function PayslipForm({ period, saved }: { period: Period; saved: Payslip | null }) {
  const db = useSQLiteContext();
  const settings = useSettings();
  const breakdown = useCltBreakdown(period);

  const [format, setFormat] = useState<HoursFormat>(saved?.hoursFormat ?? 'decimal');
  const [fields, setFields] = useState<Fields>(() => toFields(saved ?? EMPTY_PAYSLIP));

  const set = (key: keyof Fields) => (text: string) => setFields((f) => ({ ...f, [key]: text }));
  const values = toValues(fields, format);
  const hasRate = settings.hourlyRate > 0;
  // Sem valor da hora o app não sabe quanto em R$ deveria ser: confere só as horas
  const compared: PayslipValues = hasRate
    ? values
    : { ...values, extraCents: null, extraDoubleCents: null, nightCents: null, dsrCents: null };
  const check = breakdown ? comparePayslip(compared, breakdown, settings) : null;

  const invalidHours = (text: string) => text.trim() !== '' && parseHours(text, format) === null;

  function changeFormat(next: HoursFormat) {
    // Converte o que já foi digitado para o novo formato
    setFields((f) => toFields({ ...toValues(f, format), hoursFormat: next }));
    setFormat(next);
  }

  async function save() {
    await savePayslip(db, period, values);
    bumpData();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
    showToast('Conferência do holerite salva');
  }

  function remove() {
    Alert.alert('Apagar conferência?', 'Os valores digitados deste holerite serão apagados.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await deletePayslip(db, period);
          bumpData();
          router.back();
          showToast('Conferência apagada');
        },
      },
    ]);
  }

  return (
    <Screen nativeHeader keyboardShouldPersistTaps="handled">
      <View style={styles.gapXs}>
        <Text variant="headline">
          {periodLabel(period)} · {periodRangeLabel(period)}
        </Text>
        <Text variant="body" color="textMuted">
          Pegue o holerite que paga as horas deste período e copie só o que aparecer nele. Campo vazio não é conferido.
        </Text>
      </View>

      <Card style={styles.gap}>
        <Text variant="micro" color="textMuted">
          Como o holerite mostra as horas?
        </Text>
        <ChoiceChips
          options={[
            { value: 'decimal', label: 'Decimal · 12,50' },
            { value: 'clock', label: 'Relógio · 12:30' },
          ]}
          value={format}
          onChange={changeFormat}
        />
      </Card>

      <Card style={styles.gap}>
        <Text variant="micro" color="textMuted">
          Horas extras {settings.overtimePct}%
        </Text>
        <FieldRow>
          <HoursInput label="Horas" value={fields.extraHours} onChange={set('extraHours')} format={format} invalid={invalidHours(fields.extraHours)} />
          <MoneyField label="Valor" value={fields.extraValue} onChange={set('extraValue')} />
        </FieldRow>
        <Divider />
        <Text variant="micro" color="textMuted">
          Horas extras {settings.holidayOvertimePct}% (feriado, folga)
        </Text>
        <FieldRow>
          <HoursInput
            label="Horas"
            value={fields.extraDoubleHours}
            onChange={set('extraDoubleHours')}
            format={format}
            invalid={invalidHours(fields.extraDoubleHours)}
          />
          <MoneyField label="Valor" value={fields.extraDoubleValue} onChange={set('extraDoubleValue')} />
        </FieldRow>
        <Divider />
        <Text variant="micro" color="textMuted">
          Adicional noturno
        </Text>
        <FieldRow>
          <HoursInput label="Horas" value={fields.nightHours} onChange={set('nightHours')} format={format} invalid={invalidHours(fields.nightHours)} />
          <MoneyField label="Valor" value={fields.nightValue} onChange={set('nightValue')} />
        </FieldRow>
        <Divider />
        <Text variant="micro" color="textMuted">
          DSR sobre horas extras
        </Text>
        <FieldRow>
          <MoneyField label="Valor" value={fields.dsrValue} onChange={set('dsrValue')} />
        </FieldRow>
      </Card>

      {!hasRate ? (
        <Banner
          tone="warning"
          icon="info"
          title="Sem valor da hora"
          description="Informe o valor da sua hora na aba Salário para conferir os valores em R$. Por enquanto só as horas são conferidas."
        />
      ) : null}

      {check && check.rows.length > 0 ? <Result rows={check.rows} missingCents={check.missingCents} missingHoursRows={check.missingHoursRows} /> : null}

      <Button label="Salvar conferência" size="lg" block onPress={save} />
      {saved ? <Button label="Apagar conferência" variant="destructive" onPress={remove} /> : null}
      <Text variant="caption" color="textMuted" align="center">
        O cálculo usa as batidas anotadas e as regras em Ajustes → Salário. Diferenças de até 5 min ou R$ 1,00 são tratadas como
        arredondamento.
      </Text>
    </Screen>
  );
}

function Result({ rows, missingCents, missingHoursRows }: { rows: CheckRow[]; missingCents: number; missingHoursRows: number }) {
  const underpaid = rows.some((r) => r.status === 'underpaid');
  const title = !underpaid
    ? 'O holerite bate com as suas horas'
    : missingCents > 0
      ? `Pode estar faltando ${formatMoney(missingCents)}`
      : `${missingHoursRows === 1 ? '1 item de horas pago' : `${missingHoursRows} itens de horas pagos`} a menos`;

  return (
    <Card style={styles.gap}>
      <Text variant="title2" color={underpaid ? 'danger' : 'work'}>
        {title}
      </Text>
      {rows.map((r) => (
        <View key={r.key} style={styles.resultRow}>
          <View style={styles.flex}>
            <Text variant="body">{r.label}</Text>
            <Text variant="caption" color="textMuted" tabular>
              holerite {show(r, r.paid)} · app {show(r, r.expected)}
            </Text>
          </View>
          <Text variant="headline" tabular color={r.status === 'ok' ? 'work' : r.status === 'underpaid' ? 'danger' : 'break'}>
            {r.status === 'ok' ? 'bate' : `${r.status === 'underpaid' ? 'faltou' : 'a mais'} ${show(r, Math.abs(r.diff))}`}
          </Text>
        </View>
      ))}
      {underpaid ? (
        <Text variant="caption" color="textMuted">
          Antes de procurar o RH, confira se todas as batidas do período foram anotadas e se as regras da CLT em Ajustes batem com
          as da sua empresa.
        </Text>
      ) : null}
    </Card>
  );
}

const show = (r: CheckRow, v: number) => (r.unit === 'hours' ? formatDuration(v) : formatMoney(v));

function FieldRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.fieldRow}>{children}</View>;
}

function HoursInput({
  label,
  value,
  onChange,
  format,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  format: HoursFormat;
  invalid: boolean;
}) {
  return <Field label={label} value={value} onChange={onChange} placeholder={format === 'decimal' ? '0,00' : '0:00'} invalid={invalid} />;
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (text: string) => void }) {
  return <Field label={label} value={value} onChange={onChange} placeholder="0,00" prefix="R$" invalid={value.trim() !== '' && parseMoney(value) === null} />;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  prefix?: string;
  invalid: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <View style={[styles.box, { borderColor: invalid ? colors.danger : colors.border, backgroundColor: colors.surfaceRaised }]}>
        {prefix ? (
          <Text variant="body" color="textMuted">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          style={[styles.input, { color: colors.text }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.md },
  gapXs: { gap: spacing.xs },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1, gap: spacing.xs },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 18, fontVariant: ['tabular-nums'], paddingVertical: spacing.sm },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
