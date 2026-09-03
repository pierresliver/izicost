// Search receipts (store name) and items (item name) with a date-range chip; results open the receipt.
import '@/features/reports/i18n';

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { search, type SearchHit, type SearchRange } from '@/features/reports/search';
import { Chip, Empty, ErrorText, styles as ui } from '@/features/reports/ui';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';
import { ScopeCaption } from '@/features/household/components/scope-caption';

const RANGES: { key: SearchRange; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: '3months', label: 'Last 3 months' },
  { key: 'all', label: 'All time' },
];

export default function SearchScreen() {
  useLang();
  const router = useRouter();
  const theme = useTheme();
  const [q, setQ] = useState('');
  const [range, setRange] = useState<SearchRange>('3months');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setSearched(false); return; }
    let alive = true;
    const timer = setTimeout(async () => {
      try { const r = await search(term, range); if (alive) { setHits(r); setError(null); setSearched(true); } }
      catch (e) { if (alive) setError(String((e as Error).message ?? e)); }
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [q, range]);

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t('Search') }} />
      <ScopeCaption />
      <View style={{ padding: Spacing.three, gap: Spacing.two }}>
        <View style={[s.box, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('Store or item name…')}
            placeholderTextColor={theme.textSecondary}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            style={[s.input, { color: theme.text }]}
          />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={theme.textSecondary} /></Pressable> : null}
        </View>
        <View style={ui.chips}>
          {RANGES.map((r) => <Chip key={r.key} label={t(r.label)} active={range === r.key} onPress={() => setRange(r.key)} />)}
        </View>
        <ErrorText error={error} />
      </View>
      <FlatList
        data={hits}
        keyExtractor={(h) => h.id}
        contentContainerStyle={{ paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Empty text={q.trim().length < 2 ? t('Type at least 2 characters.') : searched ? t('No results.') : t('Loading…')} />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: item.receiptId } })}>
            <ThemedView type="backgroundElement" style={s.row}>
              <Ionicons name={item.kind === 'receipt' ? 'receipt' : 'pricetag'} size={20} color={Brand.primary} style={{ width: 28 }} />
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" numberOfLines={1}>{item.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.subtitle ? `${item.subtitle} · ` : ''}{item.date || '—'}
                </ThemedText>
              </View>
              <ThemedText type="smallBold">{formatMoney(item.amount, item.currency)}</ThemedText>
            </ThemedView>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const s = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 12, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 14, padding: Spacing.three },
});
