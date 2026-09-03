// Product page — cheapest now, price per store / per city, 90-day trend, your own last price.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { addToBasket } from '@/features/basket/api';
import '@/features/basket/i18n';
import { BASKET_HREF } from '@/features/basket/routes';
import {
  getProduct, myLastPrice, productPrices, productTrend, reportPrice, setPriceAlert,
  type CommunityPrice, type MyLastPrice, type ProductRow, type TrendPoint,
} from '@/features/prices/api';
import { FreshnessBadge } from '@/features/prices/components/freshness-badge';
import { BigPrice, StorePriceRow } from '@/features/prices/components/price-card';
import { PromptModal } from '@/features/prices/components/prompt-modal';
import { Segmented } from '@/features/prices/components/segmented';
import { TrendChart } from '@/features/prices/components/trend-chart';
import { sizeLabel, unitPriceLabel } from '@/features/prices/format';
import '@/features/prices/i18n';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

export default function ProductScreen() {
  useLang();
  const router = useRouter();
  const theme = useTheme();
  const { key } = useLocalSearchParams<{ key: string }>();
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [all, setAll] = useState<CommunityPrice[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [mine, setMine] = useState<MyLastPrice | null>(null);
  const [view, setView] = useState<'store' | 'city'>('store');
  const [reportTarget, setReportTarget] = useState<CommunityPrice | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [basketState, setBasketState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!key) return;
    try {
      const [p, rows, my] = await Promise.all([getProduct(key), productPrices(key), myLastPrice(key).catch(() => null)]);
      setProduct(p); setAll(rows); setMine(my); setError(null);
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.currency] = (counts[r.currency] ?? 0) + 1;
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? my?.currency ?? null;
      setCurrency((c) => c && counts[c] ? c : best);
    } catch (e) { setError(String((e as Error).message ?? e)); }
    finally { setLoaded(true); }
  }, [key]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!key || !currency) { setTrend([]); return; }
    productTrend(key, currency).then(setTrend).catch(() => setTrend([]));
  }, [key, currency]);

  const currencies = Array.from(new Set(all.map((r) => r.currency)));
  const rows = all.filter((r) => r.currency === currency).sort((a, b) => a.price - b.price);
  const cheapest = rows[0] ?? null;
  const byCity = (() => {
    const m = new Map<string, CommunityPrice>();
    for (const r of rows) { const c = r.city ?? t('unknown'); if (!m.has(c)) m.set(c, r); }
    return Array.from(m.values());
  })();
  const listRows = view === 'store' ? rows : byCity;
  const title = product?.display_name ?? cheapest?.display_name ?? key ?? '';
  const size = sizeLabel(product?.size_value ?? cheapest?.size_value, product?.size_unit ?? cheapest?.size_unit);

  function onReport(row: CommunityPrice) { setReportTarget(row); }
  async function sendReport(reason: string) {
    const target = reportTarget; setReportTarget(null);
    if (!target) return;
    try { await reportPrice(target.price_point_id, reason); Alert.alert(t('Thanks — we’ll check it')); }
    catch (e) { Alert.alert(t('Error'), String((e as Error).message ?? e)); }
  }
  useEffect(() => {
    if (!reportTarget) return;
    Alert.alert(t('Report wrong price'), `${reportTarget.store_name} · ${formatMoney(reportTarget.price, reportTarget.currency)}`, [
      { text: t('Cancel'), style: 'cancel', onPress: () => setReportTarget(null) },
      { text: t('Price is wrong'), onPress: () => sendReport('wrong_price') },
      { text: t('Wrong product'), onPress: () => sendReport('wrong_product') },
      { text: t('Store is wrong'), onPress: () => sendReport('wrong_store') },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportTarget]);

  async function saveAlert(v: string) {
    setAlertOpen(false);
    const target = Number(v.replace(',', '.'));
    const pid = product?.id ?? cheapest?.product_id;
    if (!pid || !currency || !Number.isFinite(target) || target <= 0) { Alert.alert(t('Check the form')); return; }
    try { await setPriceAlert(pid, currency, target); Alert.alert(t('Alert set'), t('We will tell you when %name% drops to %price%.', { name: title, price: formatMoney(target, currency) })); }
    catch (e) { Alert.alert(t('Error'), String((e as Error).message ?? e)); }
  }

  const mineDiff = mine && cheapest && mine.currency === currency ? mine.price - cheapest.price : null;

  async function onAddToBasket() {
    if (basketState !== 'idle' || !title) return;
    setBasketState('busy');
    try {
      await addToBasket(title, product?.id ?? cheapest?.product_id ?? null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setBasketState('done');
      setTimeout(() => setBasketState('idle'), 2500);
    } catch (e) { setBasketState('idle'); Alert.alert(t('Error'), String((e as Error).message ?? e)); }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: title || t('Product') }} />
      <View style={{ gap: 2 }}>
        <ThemedText style={{ fontSize: 24, lineHeight: 30, fontWeight: '700' }}>{title}</ThemedText>
        {size ? <ThemedText themeColor="textSecondary">{size}</ThemedText> : null}
      </View>
      {error ? <ThemedText style={{ color: Brand.danger }}>{error}</ThemedText> : null}

      {cheapest ? (
        <View style={styles.hero}>
          <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.8)' }}>{t('Cheapest now')}</ThemedText>
          <BigPrice value={cheapest.price} currency={cheapest.currency} size={40} color="#fff" />
          {cheapest.unit_price ? <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.85)' }}>{unitPriceLabel(cheapest.unit_price, cheapest.size_unit, cheapest.currency)}</ThemedText> : null}
          <ThemedText type="smallBold" style={{ color: '#fff', marginTop: Spacing.one }}>{cheapest.store_name}</ThemedText>
          <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>{[cheapest.branch_address, cheapest.city].filter(Boolean).join(' · ')}</ThemedText>
          <View style={{ marginTop: Spacing.one }}><FreshnessBadge observedOn={cheapest.observed_on} reports={cheapest.report_count} /></View>
        </View>
      ) : loaded ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{t('Not enough reports yet')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t('Community prices come from receipts scanned in the last 60 days; check the report count before you travel. Your own receipts are still private and shown below.')}</ThemedText>
        </ThemedView>
      ) : null}

      {mine ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <Ionicons name="lock-closed" size={14} color={theme.textSecondary} />
            <ThemedText type="smallBold" style={{ flex: 1 }}>{t('Your last price')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{t('private')}</ThemedText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two }}>
            <BigPrice value={mine.price} currency={mine.currency ?? ''} size={24} />
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }} numberOfLines={2}>{[mine.store_name, mine.purchased_on].filter(Boolean).join(' · ')}</ThemedText>
          </View>
          {mineDiff !== null && Math.abs(mineDiff) > 0.005 ? (
            <ThemedText type="small" style={{ color: mineDiff > 0 ? '#B57F00' : Brand.success }}>
              {mineDiff > 0 ? t('You paid %d% more than the cheapest store.', { d: formatMoney(mineDiff, currency) }) : t('You paid %d% less than the cheapest community price.', { d: formatMoney(-mineDiff, currency) })}
            </ThemedText>
          ) : null}
        </ThemedView>
      ) : null}

      {currencies.length > 1 && currency ? (
        <Segmented options={currencies.map((c) => ({ key: c, label: c }))} value={currency} onChange={setCurrency} />
      ) : null}

      {rows.length ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <ThemedText type="smallBold" style={{ fontSize: 16, flex: 1 }}>{t('Where to buy')}</ThemedText>
            <View style={{ width: 170 }}>
              <Segmented options={[{ key: 'store', label: t('By store') }, { key: 'city', label: t('By city') }]} value={view} onChange={setView} />
            </View>
          </View>
          {listRows.map((r, i) => (
            <StorePriceRow key={`${r.store_id}|${r.currency}`} row={r} rank={i + 1} best={i === 0} onReport={() => onReport(r)} />
          ))}
        </>
      ) : null}

      {currency ? <TrendChart points={trend} currency={currency} /> : null}

      <View style={styles.actions}>
        <Pressable onPress={() => setAlertOpen(true)} style={[styles.btn, { backgroundColor: Brand.primary }]} disabled={!(product?.id ?? cheapest)}>
          <Ionicons name="notifications-outline" size={18} color="#fff" />
          <ThemedText type="smallBold" style={{ color: '#fff' }}>{t('Set alert')}</ThemedText>
        </Pressable>
        <Pressable onPress={onAddToBasket} disabled={basketState !== 'idle' || !title} style={[styles.btn, { backgroundColor: basketState === 'done' ? Brand.success : Brand.primary }]}>
          <Ionicons name={basketState === 'done' ? 'checkmark' : 'basket-outline'} size={18} color="#fff" />
          <ThemedText type="smallBold" style={{ color: '#fff' }}>{basketState === 'done' ? t('Added') : t('Add to basket')}</ThemedText>
        </Pressable>
      </View>
      {basketState === 'done' ? (
        <Pressable onPress={() => router.push(BASKET_HREF)} style={{ alignSelf: 'center' }} hitSlop={6}>
          <ThemedText type="small" style={{ color: Brand.primary }}>{t('Added to your basket')} · {t('View basket')}</ThemedText>
        </Pressable>
      ) : null}
      <Pressable onPress={() => router.push({ pathname: '/quick-add', params: { name: title } })} style={[styles.btnWide, { borderWidth: 1.5, borderColor: Brand.primary }]}>
        <Ionicons name="add-circle-outline" size={18} color={Brand.primary} />
        <ThemedText type="smallBold" style={{ color: Brand.primary }}>{t('Add a market price')}</ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {t('Prices are pooled anonymously from receipts scanned by IziCost users. Only the price, store, city and date are shared.')}
      </ThemedText>

      <PromptModal
        visible={alertOpen} onClose={() => setAlertOpen(false)} onSubmit={saveAlert}
        title={t('Set alert')} message={t('Tell me when the price drops to (%cur%):', { cur: currency ?? '' })}
        placeholder={cheapest ? String(Math.floor(cheapest.price * 0.9)) : '0.00'} keyboardType="decimal-pad" confirmLabel={t('Set alert')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  hero: { backgroundColor: Brand.primary, borderRadius: 20, padding: Spacing.four, gap: 2 },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  btnWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
});
