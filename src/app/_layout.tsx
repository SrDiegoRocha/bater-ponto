import { useFonts } from 'expo-font';
import { Stack } from 'expo-router/stack';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/migrations';
import { useSettingsStore } from '@/stores/settings-store';
import { ThemeProvider, useTheme } from '@/theme';

// Splash fica até o banco migrar, as configurações carregarem e as fontes estarem prontas (§6.8).
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

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

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </NavigationThemeProvider>
  );
}
