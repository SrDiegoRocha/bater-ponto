import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

/** Conteúdo padrão dos form sheets (altura = conteúdo): fundo elevado, margens e espaço para a barra de navegação */
export function SheetContainer({ children }: { children?: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.content, { backgroundColor: colors.surfaceRaised, paddingBottom: insets.bottom + spacing.xl }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg },
});
