import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { memberName, useHousehold } from '@/features/household/api';
import { ScopeToggle } from '@/features/household/components/scope-toggle';
import { t, useLang } from '@/lib/i18n';
import { formatMoney, listReceipts } from '@/lib/receipts';
import { ensureSession } from '@/lib/supabase';
import type { ReceiptRow } from '@/lib/types';

export default function ReceiptsScreen() {
  useLang();
  const router = useRouter();
  const { household, scope } = useHousehold();
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setUid(await ensureSession()); setRows(await listReceipts()); setError(null); }
    catch (e) { setError(String((e as Error).message ?? e)); }
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps -- reload when the Me / Household switch changes
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        ListHeaderComponent={household ? <View style={{ marginBottom: Spacing.two }}><ScopeToggle /></View> : null}
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
                  {uid && item.user_id !== uid && memberName(item.user_id) ? ` · ${memberName(item.user_id)}` : ''}
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
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 16, padding: Spacing.three },
  icon: { width: 36, alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
});
