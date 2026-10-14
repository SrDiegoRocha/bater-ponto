import { StyleSheet, View } from 'react-native';

import { BrandSymbol } from '@/components/brand/brand-mark';
import { spacing, useTheme } from '@/theme';

import { Text } from './text';

// Estado vazio com a geometria do logo (§6.7). As ilustrações dedicadas entram na fase 2.

export function EmptyState({ title, description }: { title: string; description?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <BrandSymbol size={72} color={colors.border} />
      <Text variant="headline" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="textMuted" align="center">
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing['3xl'], paddingHorizontal: spacing.xl },
});
