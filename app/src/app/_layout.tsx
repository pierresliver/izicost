import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRootNavigationState, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
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
  const router = useRouter();
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  // Tapping a notification opens the screen it is about (price drop -> product page, recap -> the story).
  // The route is parked until the root stack is mounted (a cold start can deliver the tap before that), and
  // each tap is handled once (Android reports a cold-start tap through both channels).
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const handled = useRef<Set<string>>(new Set());
  const navState = useRootNavigationState();
  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      const id = r.notification.request.identifier;
      if (handled.current.has(id)) return;
      handled.current.add(id);
      const route = r.notification.request.content.data?.route;
      if (typeof route === 'string' && route.startsWith('/')) setPendingRoute(route);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!pendingRoute || showIntro !== false || !navState?.key) return;
    const route = pendingRoute;
    const id = setTimeout(() => {
      setPendingRoute((cur) => (cur === route ? null : cur));
      try { router.push(route as Href); } catch { /* route gone */ }
    }, 150);
    return () => clearTimeout(id);
  }, [pendingRoute, showIntro, navState?.key, router]);

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
        <Stack.Screen name="camera" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="confirm" options={{ title: t('Check what we read'), presentation: 'modal' }} />
        <Stack.Screen name="receipt/[id]" options={{ title: t('Receipt') }} />
        <Stack.Screen name="product/[key]" options={{ title: t('Prices') }} />
        <Stack.Screen name="quick-add" options={{ title: t('Add a market price'), presentation: 'modal' }} />
        <Stack.Screen name="recap" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack>
    </ThemeProvider>
  );
}
