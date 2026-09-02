import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { t, useLang } from '@/lib/i18n';
import { formatMoney, listReceipts } from '@/lib/receipts';
import type { ReceiptRow } from '@/lib/types';

export default function ReceiptsScreen() {
  useLang();
  const router = useRouter();
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await listReceipts()); setError(null); }
    catch (e) { setError(String((e as Error).message ?? e)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>{error ?? t('No receipts saved yet.')}</ThemedText>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: item.id } })}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.icon}><Ionicons name={iconFor(item.store_type)} size={22} color={Brand.primary} /></View>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{item.store_name ?? '?'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.purchased_on ?? '—'} · {item.item_count ?? 0} {t('items')}
                </ThemedText>
              </View>
              <ThemedText type="smallBold">{formatMoney(item.total, item.currency)}</ThemedText>
            </ThemedView>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

function iconFor(storeType: string | null): keyof typeof Ionicons.glyphMap {
  switch (storeType) {
    case 'restaurant': case 'bar_cafe': return 'restaurant';
    case 'fuel_station': return 'car';
    case 'parking': return 'car-sport';
    case 'pharmacy': return 'medkit';
    case 'utility_provider': return 'flash';
    case 'clothing_store': return 'shirt';
    default: return 'cart';
  }
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 14, padding: Spacing.three },
  icon: { width: 36, alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
});
