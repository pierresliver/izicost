// Home card "My items": your usual products with the cheapest current price, coloured by how it moved
// since you last bought it (green down, red up), an 8-week sparkline and a bell for price-drop alerts.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { freshnessText } from '@/features/prices/components/freshness-badge';
import { daysAgo, sizeLabel } from '@/features/prices/format';
import { Card, SectionTitle } from '@/features/reports/ui';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

import { autofill, isNewDrop, markNotified, movement, setNotify, unwatch, watchlist, type Movement, type WatchRow } from '../api';
import '../i18n';
import { enableDrops, getDropPref, notifyDrops, type DropPref } from '../notify';
import { Sparkline } from './sparkline';

const MAX_ROWS = 10;

export function WatchCard({ onEmptyScan }: { onEmptyScan: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<WatchRow[] | null>(null);
  const [drops, setDrops] = useState<WatchRow[]>([]);
  const [pref, setPref] = useState<DropPref>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      await autofill(8).catch(() => 0); // idempotent: usual items appear by themselves
      const [list, p] = await Promise.all([watchlist(), getDropPref()]);
      setRows(list); setPref(p); setError(null);
      const fresh = list.filter(isNewDrop);
      if (fresh.length) {
        setDrops(fresh);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        notifyDrops(fresh).catch(() => {});
        await Promise.all(fresh.map((r) => markNotified(r.watch_id, r.best_price!).catch(() => {})));
      }
    } catch (e) { setError(String((e as Error).message ?? e)); setRows((cur) => cur ?? []); }
  }, []); // stable: a dependency on `rows` would re-run this on every update
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleBell(r: WatchRow) {
    const next = !r.notify;
    setRows((cur) => (cur ?? []).map((x) => (x.watch_id === r.watch_id ? { ...x, notify: next } : x)));
    if (next && pref !== 'on') {
      const ok = await enableDrops();
      setPref(ok ? 'on' : 'off');
      if (!ok) Alert.alert(t('Alert me'), t('Notifications are off for IziCost. Enable them in the phone settings to get price alerts.'));
    }
    try { await setNotify(r.watch_id, next); } catch { load(); }
    Haptics.selectionAsync().catch(() => {});
  }
  function remove(r: WatchRow) {
    Alert.alert(t('Remove %name% from My items?', { name: r.display_name }), t('It will not be added back automatically.'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Remove'), style: 'destructive', onPress: async () => { setRows((cur) => (cur ?? []).filter((x) => x.watch_id !== r.watch_id)); try { await unwatch(r.watch_id); } catch { load(); } } },
    ]);
  }

  if (rows === null) return <Card><SectionTitle>{t('My items')}</SectionTitle><ActivityIndicator color={Brand.primary} /></Card>;

  return (
    <Card>
      <SectionTitle>{t('My items')}</SectionTitle>
      {error ? <ThemedText type="small" style={{ color: Brand.danger }}>{error}</ThemedText> : null}
      {drops.length ? (
        <Pressable onPress={() => setDrops([])} style={styles.dropBanner}>
          <ThemedText style={{ fontSize: 22 }}>🎉</ThemedText>
          <ThemedText type="smallBold" style={{ color: Brand.success, flex: 1 }}>
            {drops.length === 1 ? t('1 of your items got cheaper 🎉') : t('%n% of your items got cheaper 🎉', { n: drops.length })}
          </ThemedText>
          <Ionicons name="close" size={16} color={Brand.success} />
        </Pressable>
      ) : null}

      {rows.length === 0 ? (
        <Pressable onPress={onEmptyScan} style={styles.empty}>
          <Ionicons name="star-outline" size={28} color={Brand.primary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {t('Scan a few receipts and your usual items appear here with their best current price. You can also tap ☆ on any product to watch it.')}
          </ThemedText>
        </Pressable>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Your usual items fill this list by themselves. Green went down, red went up, since you last bought it.')}
          </ThemedText>
          {rows.slice(0, MAX_ROWS).map((r) => (
            <WatchRowView key={r.watch_id} row={r} m={movement(r)} onOpen={() => router.push({ pathname: '/product/[key]', params: { key: r.product_key } })} onBell={() => toggleBell(r)} onRemove={() => remove(r)} />
          ))}
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
            {t('Alerts arrive when you open the app; alerts while the app is closed are coming later.')}
          </ThemedText>
        </>
      )}
    </Card>
  );
}

function WatchRowView({ row: r, m, onOpen, onBell, onRemove }: { row: WatchRow; m: Movement; onOpen: () => void; onBell: () => void; onRemove: () => void }) {
  const theme = useTheme();
  const color = m.tone === 'down' ? Brand.success : m.tone === 'up' ? Brand.danger : theme.textSecondary;
  const arrow = m.tone === 'down' ? '▼' : m.tone === 'up' ? '▲' : m.tone === 'flat' ? '=' : '•';
  const where = [r.best_store, r.best_city].filter(Boolean).join(' · ');
  const when = r.best_on ? freshnessText(daysAgo(r.best_on)) : null;
  const size = sizeLabel(r.size_value, r.size_unit);
  return (
    <Pressable onPress={onOpen} onLongPress={onRemove} delayLongPress={450} style={({ pressed }) => [styles.row, { borderTopColor: theme.backgroundSelected }, pressed && { opacity: 0.8 }]}>
      <View style={[styles.pill, { backgroundColor: `${color}22` }]}>
        <ThemedText type="smallBold" style={{ color, fontSize: 12, lineHeight: 15 }}>
          {arrow}{m.pct !== null ? ` ${Math.abs(Math.round(m.pct))}%` : m.tone === 'new' ? ` ${t('new')}` : ''}
        </ThemedText>
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <ThemedText type="smallBold" numberOfLines={1}>{r.display_name}{size ? <ThemedText type="small" themeColor="textSecondary"> {size}</ThemedText> : null}</ThemedText>
        {r.best_price !== null ? (
          <ThemedText type="small" numberOfLines={1}>
            <ThemedText type="smallBold" style={{ color }}>{formatMoney(r.best_price, r.currency)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{where ? ` · ${where}` : ''}{when ? ` · ${when}` : ''}</ThemedText>
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">{t('No price yet')}</ThemedText>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {m.baseline !== null ? (
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
              {m.baselineKind === 'mine' ? t('you paid %price%', { price: formatMoney(m.baseline, r.currency) }) : t('usual %price%', { price: formatMoney(m.baseline, r.currency) })}
            </ThemedText>
          ) : null}
          {m.lowest && r.best_price !== null ? (
            <View style={styles.hot}><ThemedText type="small" style={{ fontSize: 11, lineHeight: 14, color: '#B5542F', fontWeight: '700' }}>🔥 {t('lowest in 60 days')}</ThemedText></View>
          ) : null}
        </View>
      </View>
      <Sparkline points={r.spark} color={color} />
      <Pressable onPress={onBell} hitSlop={10} accessibilityLabel={r.notify ? t('Alerts on') : t('Alerts off')} style={styles.bell}>
        <Ionicons name={r.notify ? 'notifications' : 'notifications-off-outline'} size={20} color={r.notify ? Brand.primary : theme.textSecondary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  pill: { minWidth: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 5 },
  hot: { backgroundColor: 'rgba(181,84,47,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  bell: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dropBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 12, padding: 10, backgroundColor: 'rgba(30,158,90,0.14)', borderWidth: 1, borderColor: 'rgba(30,158,90,0.45)' },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
});
