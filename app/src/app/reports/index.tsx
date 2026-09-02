// Reports hub: links to every report plus CSV export.
import '@/features/reports/i18n';

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { ym } from '@/features/reports/dates';
import { exportCsv } from '@/features/reports/export';
import { styles as ui } from '@/features/reports/ui';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';

type Entry = { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; href: string };

export default function ReportsHub() {
  useLang();
  const router = useRouter();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  const entries: Entry[] = [
    { icon: 'calendar', title: t('By month'), sub: t('Spend, stores and categories for any month'), href: `/reports/month?ym=${ym(new Date())}` },
    { icon: 'pie-chart', title: t('By category'), sub: t('Spend per category with trends'), href: '/reports/categories' },
    { icon: 'storefront', title: t('By store'), sub: t('Where you shop and your average basket'), href: '/reports/stores' },
    { icon: 'flag', title: t('Budgets'), sub: t('Monthly limits with left-per-day'), href: '/reports/budgets' },
    { icon: 'trending-up', title: t('Inflation'), sub: t('Are your usual items getting pricier?'), href: '/reports/inflation' },
    { icon: 'search', title: t('Search'), sub: t('Find any receipt or item'), href: '/reports/search' },
  ];

  async function onExport() {
    setBusy(true);
    try {
      const n = await exportCsv(t('Export CSV'));
      if (n === 0) Alert.alert(t('Export CSV'), t('Nothing to export yet.'));
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      Alert.alert(t('Could not export'), msg === 'sharing unavailable' ? t('Sharing is not available on this device.') : msg);
    } finally { setBusy(false); }
  }

  return (
    <ScrollView contentContainerStyle={ui.screen}>
      <Stack.Screen options={{ title: t('Reports') }} />
      {entries.map((e) => (
        <Pressable key={e.href} onPress={() => router.push(e.href as Href)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
          <ThemedView type="backgroundElement" style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: Spacing.three }]}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.backgroundSelected, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={e.icon} size={20} color={Brand.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" style={{ fontSize: 16 }}>{e.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{e.sub}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </ThemedView>
        </Pressable>
      ))}

      <Pressable onPress={onExport} disabled={busy} style={[ui.primaryBtn, { marginTop: Spacing.two, opacity: busy ? 0.7 : 1 }]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="download-outline" color="#fff" size={20} />}
        <ThemedText style={ui.primaryBtnText}>{busy ? t('Preparing file…') : t('Export CSV')}</ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>{t('All receipts and items as a spreadsheet file')}</ThemedText>
    </ScrollView>
  );
}
