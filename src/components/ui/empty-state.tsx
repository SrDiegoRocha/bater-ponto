import { StyleSheet, View } from 'react-native';

import { Illustration, type IllustrationName } from '@/components/brand/illustrations';
import { spacing } from '@/theme';

import { Text } from './text';

// Estado vazio com ilustração na geometria do logo (§6.7).

export function EmptyState({
  title,
  description,
  illustration = 'empty',
}: {
  title: string;
  description?: string;
  illustration?: IllustrationName;
}) {
  return (
    <View style={styles.container}>
      <Illustration name={illustration} size={96} />
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
