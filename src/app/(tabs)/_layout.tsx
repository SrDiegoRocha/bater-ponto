import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { fonts, useTheme } from '@/theme';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      tintColor={colors.primary}
      iconColor={{ default: colors.textMuted, selected: colors.primary }}
      indicatorColor={colors.surfaceRaised}
      rippleColor={colors.border}
      labelStyle={{
        default: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12 },
        selected: { color: colors.text, fontFamily: fonts.semibold, fontSize: 12 },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon md="schedule" />
        <NativeTabs.Trigger.Label>Hoje</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="historico">
        <NativeTabs.Trigger.Icon md="calendar_month" />
        <NativeTabs.Trigger.Label>Histórico</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="resumo">
        <NativeTabs.Trigger.Icon md="insights" />
        <NativeTabs.Trigger.Label>Resumo</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="salario">
        <NativeTabs.Trigger.Icon md="payments" />
        <NativeTabs.Trigger.Label>Salário</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
