// Where is it cheapest? — per-store basket totals ranked, plus the best two-store split.
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { basketQuote, getDefaultList, listItems, type BasketItem, type StoreQuote } from '@/features/basket/api';
import { SplitCard } from '@/features/basket/components/split-card';
import { Pill, StoreQuoteCard } from '@/features/basket/components/store-quote-card';
import '@/features/basket/i18n';
import { bestPerItem, missingItems, rankQuotes, savingVsNext, splitPlan, type LatLng } from '@/features/basket/optimise';
import { priceCities, type CityRow } from '@/features/prices/api';
import { CityPicker } from '@/features/prices/components/city-picker';
import { Segmented } from '@/features/prices/components/segmented';
import { captureLocation } from '@/features/prices/location';
import { useScope, type ScopeMode } from '@/features/prices/use-scope';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

const NEAR_KM = 15;

/** Position without any prompt: only when permission was already granted. */
async function silentPosition(): Promise<LatLng | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const p = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return p ? { lat: p.coords.latitude, lng: p.coords.longitude } : null;
  } catch { return null; }
}

export default function QuoteScreen() {
  useLang();
  const theme = useTheme();
  const params = useLocalSearchParams<{ city?: string; country?: string }>();
  const scope = useScope();
  const [cities, setCities] = useState<CityRow[]>([]);
  const [picker, setPicker] = useState<'my' | 'other' | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [items, setItems] = useState<BasketItem[]>([]);
  const [quotes, setQuotes] = useState<StoreQuote[]>([]);
  const [pos, setPos] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (params.city) { scope.setOtherCity({ city: params.city, country: params.country ?? null }); scope.setMode('bycity'); } }, [params.city]); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { priceCities().then(setCities).catch(() => {}); }, []));

  // City to send to the backend (null = anywhere; "near me" filters by distance in JS instead).
  const cityScope = useMemo<{ ready: boolean; city: string | null; country: string | null }>(() => {
    switch (scope.mode) {
      case 'anywhere': return { ready: true, city: null, country: null };
      case 'mycity': return { ready: !!scope.myCity, city: scope.myCity?.city ?? null, country: scope.myCity?.country ?? null };
      case 'bycity': return { ready: !!scope.otherCity, city: scope.otherCity?.city ?? null, country: scope.otherCity?.country ?? null };
      case 'near':
        if (scope.nearStatus === 'locating' || scope.nearStatus === 'idle') return { ready: false, city: null, country: null };
        if (scope.nearStatus === 'ok') return { ready: true, city: null, country: null };
        return { ready: true, city: scope.myCity?.city ?? null, country: scope.myCity?.country ?? null };
    }
  }, [scope.mode, scope.myCity, scope.otherCity, scope.nearStatus]);
  const cur = currency ?? (cityScope.country === 'ZA' ? 'ZAR' : 'MZN');

  const load = useCallback(async () => {
    if (!cityScope.ready) { setLoading(false); return; } // e.g. city picker dismissed: don't spin forever
    setLoading(true);
    try {
      const list = await getDefaultList();
      const [its, p] = await Promise.all([listItems(list.id), scope.mode === 'near' ? captureLocation() : silentPosition()]);
      setItems(its); setPos(p);
      setQuotes(its.length ? await basketQuote(list.id, cityScope.city, cur) : []); setError(null);
    } catch (e) { setError(String((e as Error).message ?? e)); }
    finally { setLoading(false); }
  }, [cityScope, cur, scope.mode]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const nearFilter = scope.mode === 'near' && scope.nearStatus === 'ok' && pos ? NEAR_KM : undefined;
  const { ranked, partial } = useMemo(() => rankQuotes(quotes, pos, nearFilter), [quotes, pos, nearFilter]);
  const inScope = useMemo(() => [...ranked, ...partial], [ranked, partial]);
  const plan = useMemo(() => splitPlan(inScope, ranked[0] ?? inScope[0]), [inScope, ranked]); // a split helps even when every store is partial
  const perItem = useMemo(() => bestPerItem(inScope), [inScope]);
  const missing = useMemo(() => missingItems(inScope, items.filter((i) => !i.checked)), [inScope, items]); // ticked items are not quoted
  const saving = savingVsNext(ranked[0], ranked[1]);

  const onMode = (m: ScopeMode) => {
    scope.setMode(m);
    if (m === 'mycity' && !scope.myCity) setPicker('my');
    if (m === 'bycity') setPicker('other');
  };
  const scopeText = (() => {
    switch (scope.mode) {
      case 'near':
        if (scope.nearStatus === 'locating' || scope.nearStatus === 'idle') return t('Finding stores near you…');
        if (scope.nearStatus === 'ok') return nearFilter ? t('Stores within 15 km') : t('No location — showing everywhere');
        return scope.myCity ? t('No location — showing %city%', { city: scope.myCity.city }) : t('No location — showing everywhere');
      case 'mycity': return scope.myCity?.city ?? t('Choose your city');
      case 'bycity': return scope.otherCity?.city ?? t('Choose a city');
      default: return t('All cities');
    }
  })();

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t('Where is it cheapest?') }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Segmented
          options={[{ key: 'near', label: t('Near me') }, { key: 'mycity', label: t('My city') }, { key: 'bycity', label: t('By city') }, { key: 'anywhere', label: t('Anywhere') }]}
          value={scope.mode} onChange={onMode}
        />
        <View style={styles.scopeLine}>
          <Ionicons name={scope.mode === 'near' ? 'navigate' : scope.mode === 'anywhere' ? 'globe-outline' : 'location'} size={14} color={Brand.primary} />
          <Pressable onPress={() => setPicker(scope.mode === 'bycity' ? 'other' : scope.mode === 'mycity' ? 'my' : null)} disabled={scope.mode === 'near' || scope.mode === 'anywhere'} style={{ flex: 1 }}>
            <ThemedText type="small" themeColor="textSecondary">{scopeText}</ThemedText>
          </Pressable>
          <View style={{ width: 120 }}>
            <Segmented options={[{ key: 'MZN', label: 'MZN' }, { key: 'ZAR', label: 'ZAR' }]} value={cur} onChange={setCurrency} />
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={Brand.primary} /><ThemedText type="small" themeColor="textSecondary">{t('Comparing stores…')}</ThemedText></View>
        ) : error ? (
          <ThemedText style={{ color: Brand.danger }}>{error}</ThemedText>
        ) : !items.length ? (
          <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.four }}>{t('Add items to your basket first.')}</ThemedText>
        ) : !inScope.length ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}><Ionicons name="basket" size={30} color={Brand.primary} /></View>
            <ThemedText type="smallBold" style={{ fontSize: 17, textAlign: 'center' }}>{t('No community prices for your basket here yet')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {t('Prices come from receipts scanned in the last 60 days. Try another city, or scan receipts to add prices.')}
            </ThemedText>
          </View>
        ) : (
          <>
            {plan ? <SplitCard plan={plan} currency={cur} /> : null}

            {ranked.length ? (
              <>
                <View style={styles.sectionHead}>
                  <ThemedText type="smallBold" style={{ fontSize: 16, flex: 1 }}>{t('Best single store')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{t('Tap a store to see its prices')}</ThemedText>
                </View>
                {ranked.map((q, i) => (
                  <StoreQuoteCard key={q.store_id} quote={q} rank={i + 1} currency={cur} saving={i === 0 ? saving : null} nextStore={ranked[1]?.store_name ?? null} />
                ))}
              </>
            ) : null}

            {partial.length ? (
              <>
                <View style={{ gap: 2, marginTop: Spacing.one }}>
                  <ThemedText type="smallBold" style={{ fontSize: 16 }}>{t('Partial matches')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{t('These stores have fewer than half of your items.')}</ThemedText>
                </View>
                {partial.map((q) => <StoreQuoteCard key={q.store_id} quote={q} rank={null} currency={cur} />)}
              </>
            ) : null}

            {perItem.length ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold" style={{ fontSize: 16 }}>{t('Cheapest store per item')}</ThemedText>
                {perItem.map((b) => (
                  <View key={b.item_id} style={styles.itemLine}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="small" numberOfLines={1}>{b.name}{b.qty !== 1 ? ` × ${b.qty}` : ''}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }} numberOfLines={1}>{[b.store.store_name, b.store.city].filter(Boolean).join(' · ')}</ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={{ color: Brand.primary }}>{formatMoney(b.line_total, cur)}</ThemedText>
                  </View>
                ))}
                {missing.length ? (
                  <View style={[styles.missing, { borderTopColor: theme.backgroundSelected }]}>
                    <Pill tone="warning" text={t('No price yet for: %names%', { names: missing.join(', ') })} />
                  </View>
                ) : null}
              </ThemedView>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>{t('Prices are the latest community reports; check the shelf before you travel.')}</ThemedText>
          </>
        )}
      </ScrollView>
      <CityPicker
        visible={picker !== null} title={picker === 'my' ? t('Your city') : t('Choose a city')} cities={cities} onClose={() => setPicker(null)}
        onSelect={(c) => { if (picker === 'my') scope.setMyCity(c); else scope.setOtherCity(c); setPicker(null); }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  scopeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 },
  center: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(11,110,79,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, marginTop: Spacing.one },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  itemLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  missing: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
});
