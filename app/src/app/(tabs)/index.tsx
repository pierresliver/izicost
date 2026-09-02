import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { t, useLang } from '@/lib/i18n';
import { formatMoney, monthSummary, type MonthSummary } from '@/lib/receipts';
import { supabaseConfigured } from '@/lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const { lang } = useLang();
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabaseConfigured) { setError('Supabase is not configured (app/.env missing).'); return; }
    try { setSummary(await monthSummary()); setError(null); }
    catch (e) { setError(String((e as Error).message ?? e)); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const monthName = new Date().toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB', { month: 'long', year: 'numeric' });

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText themeColor="textSecondary">{t('This month')} · {monthName}</ThemedText>
        <ThemedText type="title" style={styles.big}>
          {summary ? formatMoney(summary.total, summary.currency) : '—'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{summary?.count ?? 0} {t('receipts')}</ThemedText>
      </ThemedView>

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      {summary && summary.count === 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.center}>{t('No receipts yet. Scan your first one!')}</ThemedText>
      ) : null}

      <Pressable style={styles.scanBtn} onPress={() => router.navigate('/scan')}>
        <Ionicons name="camera" color="#fff" size={22} />
        <ThemedText style={styles.scanBtnText}>{t('Scan a receipt')}</ThemedText>
      </Pressable>

      {summary && summary.byStore.length > 0 ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">{t('Top stores')}</ThemedText>
          {summary.byStore.map((s) => (
            <View key={s.name} style={styles.row}>
              <ThemedText>{s.name}</ThemedText>
              <ThemedText>{formatMoney(s.total)}</ThemedText>
            </View>
          ))}
        </ThemedView>
      ) : null}

      {summary && summary.byCategory.length > 0 ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">{t('By category')}</ThemedText>
          {summary.byCategory.map((c) => (
            <View key={c.name} style={styles.row}>
              <ThemedText>{t(c.name)}</ThemedText>
              <ThemedText>{formatMoney(c.total)}</ThemedText>
            </View>
          ))}
        </ThemedView>
      ) : null}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.one },
  big: { fontSize: 34, lineHeight: 40, marginVertical: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  scanBtn: {
    flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.primary, borderRadius: 14, paddingVertical: 14,
  },
  scanBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  center: { textAlign: 'center' },
  error: { color: Brand.danger },
});
