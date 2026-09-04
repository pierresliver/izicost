// Where is it cheapest? — per-store basket totals ranked, the best two-store split, cheapest store per item,
// a whole-basket estimate for stores missing items, latest vs typical prices, and "worth the trip?".
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { basketQuote, getActiveList, listItems, type BasketItem, type StoreQuote } from '@/features/basket/api';
import { SplitCard } from '@/features/basket/components/split-card';
import { Pill, StoreQuoteCard } from '@/features/basket/components/store-quote-card';
import '@/features/basket/i18n';
import { bestPerItem, estimateFull, missingItems, rankQuotes, savingVsNext, splitPlan, tripAdvice, type LatLng } from '@/features/basket/optimise';
import { priceCities, type CityRow } from '@/features/prices/api';
import { CityPicker } from '@/features/prices/components/city-picker';
import { RadiusPicker } from '@/features/prices/components/radius-picker';
import '@/features/prices/i18n';
import { Segmented } from '@/features/prices/components/segmented';
import { captureLocation } from '@/features/prices/location';
import { useScope, type ScopeMode } from '@/features/prices/use-scope';
import { BigNumber, Rows, ShareButton, ShareCard, ShareCardModal } from '@/features/share/share-card';
import '@/features/share/i18n';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

/** Position without any prompt: only when permission was already granted. */
async function silentPosition(): Promise<LatLng | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const p = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return p ? { lat: p.coords.latitude, lng: p.coords.longitude } : null;
  } catch { return null; }
}

type RankBy = 'found' | 'estimate';

export default function QuoteScreen() {
  useLang();
  const theme = useTheme();
  const params = useLocalSearchParams<{ city?: string; country?: string }>();
  const scope = useScope();
  const [cities, setCities] = useState<CityRow[]>([]);
  const [picker, setPicker] = useState<'my' | 'other' | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [typical, setTypical] = useState(false);
  const [rankBy, setRankBy] = useState<RankBy>('found');
  const [listName, setListName] = useState<string | null>(null);
  const [items, setItems] = useState<BasketItem[]>([]);
  const [quotes, setQuotes] = useState<StoreQuote[]>([]);
  const [pos, setPos] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

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
      const list = await getActiveList();
      setListName(list.name);
      const [its, p] = await Promise.all([listItems(list.id), scope.mode === 'near' ? (scope.pos ?? captureLocation()) : silentPosition()]);
      setItems(its); setPos(p);
      setQuotes(its.length ? await basketQuote(list.id, cityScope.city, cur, typical) : []); setError(null);
    } catch (e) { setError(String((e as Error).message ?? e)); }
    finally { setLoading(false); }
  }, [cityScope, cur, scope.mode, scope.pos, typical]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const nearFilter = scope.mode === 'near' && scope.nearStatus === 'ok' && pos ? scope.radiusKm : undefined;
  const { ranked: byFound, partial: partialByFound } = useMemo(() => rankQuotes(quotes, pos, nearFilter), [quotes, pos, nearFilter]);
  const inScope = useMemo(() => [...byFound, ...partialByFound], [byFound, partialByFound]);
  const estimates = useMemo(() => estimateFull(inScope), [inScope]); // typical prices from the stores in scope only
  // "Estimated total" puts every store in scope on one list, cheapest full basket first.
  const { ranked, partial } = useMemo(() => {
    if (rankBy === 'found') return { ranked: byFound, partial: partialByFound };
    const all = [...byFound, ...partialByFound].sort((a, b) => (estimates.get(a.store_id)?.total ?? 1e12) - (estimates.get(b.store_id)?.total ?? 1e12));
    return { ranked: all, partial: [] as typeof all };
  }, [rankBy, byFound, partialByFound, estimates]);
  const plan = useMemo(() => splitPlan(inScope, byFound[0] ?? inScope[0]), [inScope, byFound]); // a split helps even when every store is partial
  const perItem = useMemo(() => bestPerItem(inScope), [inScope]);
  const missing = useMemo(() => missingItems(inScope, items.filter((i) => !i.checked)), [inScope, items]); // ticked items are not quoted
  const saving = savingVsNext(ranked[0], ranked[1]);
  const trip = useMemo(() => tripAdvice(byFound, cur === 'ZAR' ? 1.5 : 15), [byFound, cur]); // saving per extra km worth a detour

  const onMode = (m: ScopeMode) => {
    scope.setMode(m);
    if (m === 'mycity' && !scope.myCity) setPicker('my');
    if (m === 'bycity') setPicker('other');
  };
  const scopeText = (() => {
    switch (scope.mode) {
      case 'near':
        if (scope.nearStatus === 'locating' || scope.nearStatus === 'idle') return t('Finding stores near you…');
        if (scope.nearStatus === 'ok') return nearFilter ? t('Stores within %km% km', { km: scope.radiusKm }) : t('No location — showing everywhere');
        return scope.myCity ? t('No location — showing %city%', { city: scope.myCity.city }) : t('No location — showing everywhere');
      case 'mycity': return scope.myCity?.city ?? t('Choose your city');
      case 'bycity': return scope.otherCity?.city ?? t('Choose a city');
      default: return t('All cities');
    }
  })();
  const openItems = items.filter((i) => !i.checked).length;

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: listName ? `${t('Where is it cheapest?')} · ${listName}` : t('Where is it cheapest?') }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Segmented
          options={[{ key: 'near', label: t('Near me') }, { key: 'mycity', label: t('My city') }, { key: 'bycity', label: t('By city') }, { key: 'anywhere', label: t('Anywhere') }]}
          value={scope.mode} onChange={onMode}
        />
        {scope.mode === 'near' ? <RadiusPicker value={scope.radiusKm} onChange={scope.setRadiusKm} /> : null}
        <View style={styles.scopeLine}>
          <Ionicons name={scope.mode === 'near' ? 'navigate' : scope.mode === 'anywhere' ? 'globe-outline' : 'location'} size={14} color={Brand.primary} />
          <Pressable onPress={() => setPicker(scope.mode === 'bycity' ? 'other' : scope.mode === 'mycity' ? 'my' : null)} disabled={scope.mode === 'near' || scope.mode === 'anywhere'} style={{ flex: 1 }}>
            <ThemedText type="small" themeColor="textSecondary">{scopeText}</ThemedText>
          </Pressable>
          <View style={{ width: 120 }}>
            <Segmented options={[{ key: 'MZN', label: 'MZN' }, { key: 'ZAR', label: 'ZAR' }]} value={cur} onChange={setCurrency} />
          </View>
        </View>
        <View style={styles.optionRow}>
          <View style={{ flex: 1 }}>
            <Segmented<'latest' | 'typical'> options={[{ key: 'latest', label: t('Latest price') }, { key: 'typical', label: t('Typical price') }]} value={typical ? 'typical' : 'latest'} onChange={(k) => setTypical(k === 'typical')} />
          </View>
          <View style={{ flex: 1 }}>
            <Segmented<RankBy> options={[{ key: 'found', label: t('Items found') }, { key: 'estimate', label: t('Estimated total') }]} value={rankBy} onChange={setRankBy} />
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={Brand.primary} /><ThemedText type="small" themeColor="textSecondary">{t('Comparing stores…')}</ThemedText></View>
        ) : error ? (
          <ThemedText style={{ color: Brand.danger }}>{error}</ThemedText>
        ) : !openItems ? (
          <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.four }}>{t('Add items to your basket first.')}</ThemedText>
        ) : !inScope.length ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}><Ionicons name="basket" size={30} color={Brand.primary} /></View>
            <ThemedText type="smallBold" style={{ fontSize: 17, textAlign: 'center' }}>
              {quotes.length ? t('No community prices for your basket here yet') : missing.length === 1 ? t('None of your items has a community price yet') : t('None of your %n% items has a community price yet', { n: missing.length })}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {quotes.length
                ? t('Prices come from receipts scanned in the last 60 days. Try another city, or scan receipts to add prices.')
                : t('Prices come from receipts and shelf scans of the last 60 days. Nobody has reported these products yet, or they are written differently from how the shops print them. Short, common names match best ("cebola", "leite 1L").')}
            </ThemedText>
            {!quotes.length && missing.length ? (
              <ThemedView type="backgroundElement" style={{ borderRadius: 14, padding: Spacing.two, gap: 4, alignSelf: 'stretch' }}>
                {missing.map((name) => (
                  <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="help-circle-outline" size={14} color={theme.textSecondary} />
                    <ThemedText type="small" numberOfLines={1} style={{ flex: 1 }}>{name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{t('no price yet')}</ThemedText>
                  </View>
                ))}
              </ThemedView>
            ) : null}
          </View>
        ) : (
          <>
            {plan ? <SplitCard plan={plan} currency={cur} /> : null}

            {trip && trip.saving > 0 ? (
              <View style={[styles.trip, { backgroundColor: trip.worthIt ? 'rgba(30,158,90,0.12)' : 'rgba(224,161,0,0.14)' }]}>
                <Ionicons name={trip.worthIt ? 'car' : 'walk'} size={22} color={trip.worthIt ? Brand.success : '#B57F00'} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold" style={{ color: trip.worthIt ? Brand.success : '#B57F00' }}>{trip.worthIt ? t('Worth the trip') : t('Maybe not worth the trip')}</ThemedText>
                  <ThemedText type="small">
                    {trip.worthIt
                      ? t('%best% saves %x% over %nearest%, %km% km further away (about %perkm% per extra km).', { best: trip.best.store_name, x: formatMoney(trip.saving, cur), nearest: trip.nearest.store_name, km: trip.extraKm, perkm: formatMoney(trip.perKm, cur) })
                      : t('%nearest% is %km% km closer and costs only %x% more than %best%.', { nearest: trip.nearest.store_name, km: trip.extraKm, x: formatMoney(trip.saving, cur), best: trip.best.store_name })}
                  </ThemedText>
                </View>
              </View>
            ) : null}

            {ranked.length ? (
              <>
                <View style={styles.sectionHead}>
                  <ThemedText type="smallBold" style={{ fontSize: 16, flex: 1 }}>{rankBy === 'found' ? t('Best single store') : t('Estimated total')}</ThemedText>
                  <ShareButton onPress={() => setShareOpen(true)} label={t('Share')} />
                </View>
                {rankBy === 'estimate' ? <ThemedText type="small" themeColor="textSecondary">{t('Missing items are counted at their typical price so every store can be compared on the full list.')}</ThemedText> : null}
                <ShareCardModal visible={shareOpen} onClose={() => setShareOpen(false)}>
                  <ShareCard title={t('Where is it cheapest?')} subtitle={t('%n% items', { n: openItems })}>
                    {rankBy === 'estimate' ? (
                      <BigNumber value={formatMoney(estimates.get(ranked[0].store_id)?.total ?? ranked[0].basket_total, cur)} label={`${t('Estimated total')} · ${ranked[0].store_name}${ranked[0].city ? ` · ${ranked[0].city}` : ''}`} tone="down" />
                    ) : saving !== null && saving > 0.5 && ranked[1] ? (
                      <BigNumber value={formatMoney(saving, cur)} label={`${t('You save')} ${t('by shopping at %store%', { store: ranked[0].store_name })} ${t('vs %store%', { store: ranked[1].store_name })}`} tone="down" />
                    ) : (
                      <BigNumber value={formatMoney(ranked[0].basket_total, cur)} label={`${ranked[0].store_name}${ranked[0].city ? ` · ${ranked[0].city}` : ''}`} tone="down" />
                    )}
                    <Rows highlightFirst rows={ranked.slice(0, 4).map((q) => ({ left: q.store_name, sub: `${q.items_found}/${q.items_total} ${t('items found')}${q.city ? ` · ${q.city}` : ''}`, right: formatMoney(rankBy === 'estimate' ? estimates.get(q.store_id)?.total ?? q.basket_total : q.basket_total, cur) }))} />
                  </ShareCard>
                </ShareCardModal>
                {ranked.map((q, i) => (
                  <StoreQuoteCard key={q.store_id} quote={q} rank={i + 1} currency={cur} saving={i === 0 ? saving : null} nextStore={ranked[1]?.store_name ?? null} estimate={estimates.get(q.store_id) ?? null} />
                ))}
              </>
            ) : null}

            {partial.length ? (
              <>
                <View style={{ gap: 2, marginTop: Spacing.one }}>
                  <ThemedText type="smallBold" style={{ fontSize: 16 }}>{t('Partial matches')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{t('These stores have fewer than half of your items.')}</ThemedText>
                </View>
                {partial.map((q) => <StoreQuoteCard key={q.store_id} quote={q} rank={null} currency={cur} estimate={estimates.get(q.store_id) ?? null} />)}
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
  optionRow: { flexDirection: 'row', gap: Spacing.two },
  center: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(11,110,79,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  trip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 14, padding: 12 },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  itemLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  missing: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
});
