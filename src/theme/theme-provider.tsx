import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { useSettings } from '@/stores/settings-store';

import { darkColors, lightColors, type ColorTokens } from './colors';

// Tema claro/escuro. Padrão = sistema; o usuário pode fixar em Ajustes → Aparência (§6.1).

type Theme = { scheme: 'light' | 'dark'; colors: ColorTokens };

const ThemeContext = createContext<Theme>({ scheme: 'dark', colors: darkColors });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme: preference } = useSettings();

  // Aplica a preferência também aos componentes nativos (abas, seletores, sheets)
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const systemScheme = useColorScheme();
  const scheme: Theme['scheme'] =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<Theme>(
    () => ({ scheme, colors: scheme === 'dark' ? darkColors : lightColors }),
    [scheme],
  );

  // Fundo da janela nativa igual ao do app: sem "flash" branco em transições
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(value.colors.bg).catch(() => {});
  }, [value.colors.bg]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
