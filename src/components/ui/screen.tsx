import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

import { Text } from './text';

// Container de toda tela: fundo do tema, safe areas (edge-to-edge) e título grande opcional.

export type ScreenProps = ScrollViewProps & {
  title?: string;
  subtitle?: string;
  /** Ação no canto do título (ex.: botão de Ajustes) */
  headerRight?: React.ReactNode;
  scroll?: boolean;
};

export function Screen({ title, subtitle, headerRight, scroll = true, children, contentContainerStyle, ...rest }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const header = title ? (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text variant="title1" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {headerRight}
    </View>
  ) : null;

  const contentStyle = [
    styles.content,
    { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing['2xl'] },
    contentContainerStyle,
  ];

  if (!scroll) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.bg }, contentStyle]}>
        {header}
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: colors.bg }]}
      contentContainerStyle={contentStyle}
      contentInsetAdjustmentBehavior="never"
      {...rest}
    >
      {header}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.gutter, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
});
