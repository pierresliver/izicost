import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { hasSeenOnboarding, Onboarding } from '@/components/onboarding';
import { LanguageProvider, t, useLang } from '@/lib/i18n';
import { ensureSession, supabaseConfigured } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <LanguageProvider>
      <Root />
    </LanguageProvider>
  );
}

function Root() {
  useLang(); // re-render screen titles when the language changes
  const colorScheme = useColorScheme();
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    // Guest mode: start a silent anonymous session so the user can scan immediately.
    if (supabaseConfigured) ensureSession().catch((e) => console.warn('session', e));
    hasSeenOnboarding().then((seen) => { setShowIntro(!seen); SplashScreen.hideAsync(); });
  }, []);

  if (showIntro === null) return null; // splash still showing
  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  if (showIntro) {
    return (
      <ThemeProvider value={theme}>
        <Onboarding onDone={() => setShowIntro(false)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={theme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="confirm" options={{ title: t('Check what we read'), presentation: 'modal' }} />
        <Stack.Screen name="receipt/[id]" options={{ title: t('Receipt') }} />
      </Stack>
    </ThemeProvider>
  );
}
