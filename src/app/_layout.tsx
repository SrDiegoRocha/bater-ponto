import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router/stack';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/migrations';
import { ToastHost } from '@/components/ui';
import { useSettingsStore } from '@/stores/settings-store';
import { fonts, ThemeProvider, useTheme } from '@/theme';

// Splash fica até o banco migrar, as configurações carregarem e as fontes estarem prontas (§6.8).
SplashScreen.preventAutoHideAsync();
// Animação de saída só existe em builds próprios; no Expo Go a chamada gera aviso.
if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  SplashScreen.setOptions({ duration: 300, fade: true });
}

export default function RootLayout() {
  // Em builds as fontes já vêm embutidas pelo config plugin (no-op); no Expo Go são carregadas aqui.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular: require('../../assets/fonts/Inter_400Regular.ttf'),
    Inter_500Medium: require('../../assets/fonts/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('../../assets/fonts/Inter_600SemiBold.ttf'),
    Inter_700Bold: require('../../assets/fonts/Inter_700Bold.ttf'),
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider
        databaseName={DATABASE_NAME}
        onInit={async (db) => {
          await migrateDbIfNeeded(db);
          await useSettingsStore.getState().hydrate(db);
        }}
      >
        <ThemeProvider>
          <AppNavigator ready={fontsLoaded || !!fontError} />
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigator({ ready }: { ready: boolean }) {
  const { scheme, colors } = useTheme();

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [scheme, colors]);

  if (!ready) return null;

  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.text,
    headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 18 },
    headerShadowVisible: false,
  } as const;

  // Form sheets com altura do conteúdo (§5.11)
  const sheet = {
    presentation: 'formSheet',
    sheetAllowedDetents: 'fitToContents',
    sheetGrabberVisible: true,
    sheetCornerRadius: 28,
    contentStyle: { backgroundColor: colors.surfaceRaised },
  } as const;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="jornada/[id]" options={{ ...header, title: 'Jornada' }} />
        <Stack.Screen name="jornada/nova" options={{ ...header, title: 'Registrar jornada', presentation: 'modal' }} />
        <Stack.Screen name="batida/[id]" options={sheet} />
        <Stack.Screen name="bater" options={sheet} />
        <Stack.Screen name="folga" options={sheet} />
        <Stack.Screen name="turno" options={sheet} />
        <Stack.Screen name="exportar" options={sheet} />
        <Stack.Screen name="feriado-novo" options={sheet} />
        <Stack.Screen name="ajustes/index" options={{ ...header, title: 'Ajustes' }} />
        <Stack.Screen name="ajustes/periodo" options={{ ...header, title: 'Período' }} />
        <Stack.Screen name="ajustes/jornada" options={{ ...header, title: 'Jornada' }} />
        <Stack.Screen name="ajustes/salario" options={{ ...header, title: 'Salário' }} />
        <Stack.Screen name="ajustes/feriados" options={{ ...header, title: 'Feriados' }} />
        <Stack.Screen name="ajustes/aparencia" options={{ ...header, title: 'Aparência' }} />
        <Stack.Screen name="ajustes/dados" options={{ ...header, title: 'Dados e backup' }} />
      </Stack>
      <ToastHost />
    </NavigationThemeProvider>
  );
}
