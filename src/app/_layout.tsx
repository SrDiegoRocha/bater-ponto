import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router/stack';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/migrations';
import { runAutoBackupIfDue } from '@/services/backup-service';
import { LockGate } from '@/components/lock/lock-gate';
import { ToastHost } from '@/components/ui';
import { useSettingsStore } from '@/stores/settings-store';
import { fonts, ThemeProvider, useTheme } from '@/theme';

// Splash fica até o banco migrar, as configurações carregarem e as fontes estarem prontas (§6.8).
SplashScreen.preventAutoHideAsync();
// Animação de saída só existe em builds próprios; no Expo Go a chamada gera aviso.
if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  SplashScreen.setOptions({ duration: 300, fade: true });
}

// Fora do componente de propósito: o SQLiteProvider fecha e reabre o banco sempre que a identidade
// de onInit muda, e um re-render (ex.: fontes carregando) derrubaria a conexão no meio da migração.
async function initDatabase(db: SQLiteDatabase) {
  await migrateDbIfNeeded(db);
  await useSettingsStore.getState().hydrate(db);
  // Backup semanal silencioso: não segura a abertura do app
  runAutoBackupIfDue(db).catch(() => {});
}

export default function RootLayout() {
  // Sem isto, um erro no onInit fica escondido atrás do splash para sempre
  const [dbError, setDbError] = useState<Error | null>(null);
  useEffect(() => {
    if (dbError) {
      console.error('Falha ao abrir o banco', dbError);
      SplashScreen.hide();
    }
  }, [dbError]);

  if (dbError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Não foi possível abrir o banco</Text>
        <Text selectable>{String(dbError.message ?? dbError)}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider
        databaseName={DATABASE_NAME}
        onInit={initDatabase}
        onError={setDbError}
      >
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigator() {
  const { scheme, colors } = useTheme();

  // Fica abaixo do SQLiteProvider de propósito: o memo dele ignora `children`, então estado do
  // RootLayout (como fontes carregadas) nunca chegaria aqui depois que o banco abre.
  // Em builds as fontes já vêm embutidas pelo config plugin (no-op); no Expo Go são carregadas aqui.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular: require('../../assets/fonts/Inter_400Regular.ttf'),
    Inter_500Medium: require('../../assets/fonts/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('../../assets/fonts/Inter_600SemiBold.ttf'),
    Inter_700Bold: require('../../assets/fonts/Inter_700Bold.ttf'),
  });
  const ready = fontsLoaded || !!fontError;

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
        <Stack.Screen name="copiar" options={sheet} />
        <Stack.Screen name="mover" options={sheet} />
        <Stack.Screen name="aplicar" options={{ ...header, title: 'Preencher dias', presentation: 'modal' }} />
        <Stack.Screen name="escala" options={{ ...header, title: 'Escala', presentation: 'modal' }} />
        <Stack.Screen name="feriado-novo" options={sheet} />
        <Stack.Screen name="ajustes/index" options={{ ...header, title: 'Ajustes' }} />
        <Stack.Screen name="ajustes/periodo" options={{ ...header, title: 'Período' }} />
        <Stack.Screen name="ajustes/jornada" options={{ ...header, title: 'Jornada' }} />
        <Stack.Screen name="ajustes/salario" options={{ ...header, title: 'Salário' }} />
        <Stack.Screen name="ajustes/escalas" options={{ ...header, title: 'Escalas' }} />
        <Stack.Screen name="ajustes/feriados" options={{ ...header, title: 'Feriados' }} />
        <Stack.Screen name="ajustes/aparencia" options={{ ...header, title: 'Aparência' }} />
        <Stack.Screen name="ajustes/seguranca" options={{ ...header, title: 'Segurança' }} />
        <Stack.Screen name="ajustes/dados" options={{ ...header, title: 'Dados e backup' }} />
      </Stack>
      <QuickActionRouting />
      <ToastHost />
      <LockGate />
    </NavigationThemeProvider>
  );
}

/** Atalhos do ícone do app: navega para o href do atalho tocado */
function QuickActionRouting() {
  useQuickActionRouting();
  return null;
}
