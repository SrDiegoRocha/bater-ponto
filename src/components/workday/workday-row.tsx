import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import { Alert, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Card, Icon, Text, type IconName } from '@/components/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { fromDateKey, MINUTE, toDateKey } from '@/domain/time';
import type { Punch, Workday } from '@/domain/types';
import type { WorkdaySummary } from '@/domain/workday';
import { formatDuration, formatTime, formatWeekdayShort } from '@/lib/format';
import { radius, spacing, useTheme, withAlpha, type ColorTokens } from '@/theme';

import { TimelineBar } from './timeline-bar';

// Card de jornada do histórico (§5.3): data em destaque, horário de entrada e saída, total e a
// parte extra na cor de hora extra. Toque abre o detalhe; deslizar para a esquerda ou segurar exclui.

type Props = {
  workday: Workday & { punches: Punch[] };
  summary: WorkdaySummary;
  /** Horas extras do dia (já pelas regras da jornada) */
  extraMs?: number;
  /** Feriado, folga ou domingo pago em dobro */
  premium?: boolean;
  holidayName?: string | null;
  night?: boolean;
  onPress: () => void;
  onDelete: () => void;
};

export function WorkdayRow({ workday: w, summary: s, extraMs = 0, premium = false, holidayName, night = false, onPress, onDelete }: Props) {
  const { colors } = useTheme();
  const first = w.punches[0];
  const last = w.punches.at(-1);
  const crosses = last && toDateKey(last.at) !== w.refDate;
  const incomplete = w.status === 'incomplete' || !s.isConsistent;
  const open = w.status === 'open';
  const edited = w.punches.some((p) => p.originalAt !== null);
  const hasExtra = !incomplete && extraMs >= MINUTE;
  const date = fromDateKey(w.refDate);

  const tags: { label: string; icon: IconName; color: keyof ColorTokens }[] = [];
  if (incomplete) tags.push({ label: 'Incompleta', icon: 'error', color: 'danger' });
  if (open) tags.push({ label: 'Em andamento', icon: 'play_arrow', color: 'work' });
  if (holidayName) tags.push({ label: holidayName, icon: 'celebration', color: 'holiday' });
  if (night) tags.push({ label: 'Noturno', icon: 'dark_mode', color: 'night' });
  if (edited) tags.push({ label: 'Editada', icon: 'edit', color: 'textMuted' });

  const longPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert('Excluir jornada?', `Todas as batidas de ${format(date, "EEEE, d 'de' MMMM", { locale: ptBR })} serão removidas.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={56}
      overshootRight={false}
      onSwipeableWillOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}
      renderRightActions={(_, __, methods) => (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Excluir jornada"
          onPress={() => {
            methods.close();
            onDelete();
          }}
          style={[styles.action, { backgroundColor: colors.danger }]}
        >
          <Icon name="delete" color="onPrimary" />
          <Text variant="caption" color="onPrimary">
            Excluir
          </Text>
        </PressableScale>
      )}
    >
      <PressableScale
        scaleTo={0.98}
        onPress={onPress}
        onLongPress={longPress}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={`${format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}: ${incomplete ? 'incompleta' : formatDuration(s.workedMs)}${hasExtra ? `, ${formatDuration(extraMs)} de extra` : ''}`}
        accessibilityHint="Toque para ver. Segure ou deslize para a esquerda para excluir."
      >
        <Card style={styles.card}>
          <View style={styles.top}>
            <View style={[styles.dateBlock, { backgroundColor: premium ? withAlpha(colors.holiday, 0.14) : colors.surfaceRaised, borderColor: colors.border }]}>
              <Text variant="micro" color={premium ? 'holiday' : 'textMuted'} style={styles.weekday}>
                {formatWeekdayShort(w.refDate)}
              </Text>
              <Text variant="title2" tabular style={styles.day}>
                {date.getDate()}
              </Text>
            </View>

            {/* Esquerda: horários e turnos (podem quebrar linha). Direita: total e extra, sempre inteiros. */}
            <View style={styles.main}>
              <Text variant="headline" tabular>
                {first ? formatTime(first.at) : '--:--'} → {open ? 'agora' : last ? formatTime(last.at) : '--:--'}
                {crosses ? <Text variant="caption" color="break"> +1</Text> : null}
              </Text>
              <Text variant="caption" color="textMuted" tabular>
                {s.segments.length} {s.segments.length === 1 ? 'turno' : 'turnos'} · intervalo {formatDuration(s.breakMs)}
              </Text>
            </View>
            <View style={styles.totals}>
              <Text variant="headline" tabular color={incomplete ? 'danger' : 'text'}>
                {incomplete ? '—' : formatDuration(s.workedMs)}
              </Text>
              {hasExtra ? (
                <View style={[styles.extraPill, { backgroundColor: withAlpha(colors.extra, 0.14) }]}>
                  <Text variant="caption" color="extra" tabular>
                    +{formatDuration(extraMs)}
                    {premium ? ' 100%' : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <TimelineBar refDate={w.refDate} segments={s.segments} extraMs={hasExtra ? extraMs : 0} />

          {tags.length > 0 ? (
            <View style={styles.tags}>
              {tags.map((t) => (
                <View key={t.label} style={[styles.tag, { backgroundColor: t.color === 'textMuted' ? colors.surfaceRaised : withAlpha(colors[t.color], 0.12) }]}>
                  <Icon name={t.icon} size={20} color={t.color} />
                  <Text variant="caption" color={t.color} style={styles.tagText}>
                    {t.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </PressableScale>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  top: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  dateBlock: {
    width: 52,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  weekday: { fontSize: 10, lineHeight: 12, letterSpacing: 0.4 },
  day: { lineHeight: 26 },
  main: { flex: 1, gap: 2 },
  totals: { alignItems: 'flex-end', gap: 4 },
  extraPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 6,
    paddingRight: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    maxWidth: '100%',
  },
  tagText: { flexShrink: 1 },
  action: {
    width: 88,
    marginLeft: spacing.sm,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
