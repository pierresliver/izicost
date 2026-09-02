// My alerts — the user's price alerts, with delete and a manual "check now".
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { deleteAlert, listAlerts, type AlertRow } from '@/features/alerts/api';
import { AlertBanner } from '@/features/alerts/components/alert-banner';
import '@/features/alerts/i18n';
import { useAlertHits } from '@/features/alerts/use-alerts';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

export default function AlertsScreen() {
  useLang();
  const router = useRouter();
  const theme = useTheme();
  const { hits, dismiss, refresh } = useAlertHits();
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows(await listAlerts()); setError(null); }
    catch (e) { setError(String((e as Error).message ?? e)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function checkNow() {
    setChecking(true);
    try {
      const found = await refresh(); await load();
      if (!found) Alert.alert(t('Nothing new — no alert has been reached.'));
    } catch (e) { Alert.alert(t('Error'), String((e as Error).message ?? e)); }
    finally { setChecking(false); }
  }
  function remove(a: AlertRow) {
    Alert.alert(t('Delete this alert?'), a.display_name ?? '', [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: async () => { setRows((c) => c.filter((r) => r.id !== a.id)); try { await deleteAlert(a.id); } catch { load(); } } },
    ]);
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t('My alerts') }} />
      <FlatList
        data={rows} keyExtractor={(r) => r.id} contentContainerStyle={styles.list}
        ListHeaderComponent={(
          <View style={{ gap: Spacing.two, marginBottom: Spacing.one }}>
            <AlertBanner hits={hits} onDismiss={dismiss} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ThemedText type="smallBold" style={{ fontSize: 16, flex: 1 }}>{t('Alerts')}</ThemedText>
              <Pressable onPress={checkNow} disabled={checking} style={styles.check}>
                {checking ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="refresh" size={14} color={Brand.primary} />}
                <ThemedText type="small" style={{ color: Brand.primary }}>{t('Check now')}</ThemedText>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={loading ? <ActivityIndicator color={Brand.primary} style={{ marginTop: Spacing.four }} /> : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="notifications" size={30} color={Brand.primary} /></View>
            <ThemedText type="smallBold" style={{ fontSize: 17, textAlign: 'center' }}>{error ? t('Could not load alerts') : t('No alerts yet')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>{error ?? t('Open a product and tap “Set alert” to be told when its price drops.')}</ThemedText>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => item.product_key && router.push({ pathname: '/product/[key]', params: { key: item.product_key } })}
            style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={[styles.icon, { backgroundColor: item.hit_at ? 'rgba(30,158,90,0.16)' : theme.backgroundSelected }]}>
                <Ionicons name={item.hit_at ? 'checkmark' : 'notifications-outline'} size={18} color={item.hit_at ? Brand.success : theme.textSecondary} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <ThemedText type="smallBold" style={{ fontSize: 16 }} numberOfLines={2}>{item.display_name ?? t('Product')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{t('Tell me when it drops to %price%', { price: formatMoney(item.target_price, item.currency) })}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                  {t('Set since %date%', { date: item.created_at.slice(0, 10) })}{item.hit_at ? ` · ${t('Reached')}` : ''}
                </ThemedText>
              </View>
              <Pressable onPress={() => remove(item)} hitSlop={10} accessibilityLabel={t('Delete')}>
                <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
              </Pressable>
            </ThemedView>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 16, padding: Spacing.three },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(11,110,79,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
});
