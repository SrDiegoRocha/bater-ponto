import { StyleSheet, View, type ViewProps } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

export type CardProps = ViewProps & {
  variant?: 'default' | 'raised';
  padded?: boolean;
};

export function Card({ variant = 'default', padded = true, style, ...rest }: CardProps) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: variant === 'raised' ? colors.surfaceRaised : colors.surface },
        // No escuro, profundidade vem do contraste de superfície; no claro, de uma sombra única (§6.5)
        scheme === 'light' && styles.shadow,
        padded && styles.padded,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg },
  padded: { padding: spacing.lg },
  shadow: { boxShadow: '0 4px 16px rgba(11, 13, 16, 0.06)' },
});
