import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme, type ColorTokens } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

// Estado sempre com cor + ícone + texto: nunca só cor (§6.3, acessível a daltônicos).

export type StatusKind = 'work' | 'break' | 'off' | 'dayOff' | 'vacation' | 'sickLeave' | 'holiday' | 'night';

const config: Record<StatusKind, { color: keyof ColorTokens; icon: IconName; label: string }> = {
  work: { color: 'work', icon: 'play_arrow', label: 'Trabalhando' },
  break: { color: 'break', icon: 'pause', label: 'Em intervalo' },
  off: { color: 'textMuted', icon: 'bedtime', label: 'Fora' },
  dayOff: { color: 'dayOff', icon: 'beach_access', label: 'Folga' },
  vacation: { color: 'vacation', icon: 'flight', label: 'Férias' },
  sickLeave: { color: 'sickLeave', icon: 'medical_services', label: 'Atestado' },
  holiday: { color: 'holiday', icon: 'celebration', label: 'Feriado' },
  night: { color: 'night', icon: 'dark_mode', label: 'Noturno' },
};

export function StatusPill({ status, label }: { status: StatusKind; label?: string }) {
  const { colors } = useTheme();
  const c = config[status];
  return (
    <View
      accessibilityRole="text"
      style={[styles.pill, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
    >
      <Icon name={c.icon} size={20} color={c.color} />
      <Text variant="micro" color={c.color}>
        {label ?? c.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
