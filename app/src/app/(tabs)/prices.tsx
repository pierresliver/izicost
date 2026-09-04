// Prices tab — search the anonymous community price pool, scoped to Near me / My city / By city / Anywhere.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { AlertBanner } from '@/features/alerts/components/alert-banner';
import '@/features/alerts/i18n';
import { useAlertHits } from '@/features/alerts/use-alerts';
import '@/features/basket/i18n';
import { ALERTS_HREF, BASKET_HREF } from '@/features/basket/routes';
import { priceCities, searchPrices, type CityRow, type SearchRow } from '@/features/prices/api';
import { CityPicker } from '@/features/prices/components/city-picker';
import { ProductResultCard } from '@/features/prices/components/price-card';
import { RadiusPicker } from '@/features/prices/components/radius-picker';
import { Segmented } from '@/features/prices/components/segmented';
import { Ticker } from '@/features/prices/components/ticker';
import '@/features/prices/i18n';
import { useScope, type ScopeMode } from '@/features/prices/use-scope';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';

export default function PricesScreen() {
  useLang();
  const router = useRouter();
  const theme = useTheme();
  const scope = useScope();
  const alerts = useAlertHits();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [picker, setPicker] = useState<'my' | 'other' | null>(null);

  const load = useCallback(async () => {
    if (!scope.filter) { setRows([]); return; }
    setLoading(true);
    try { setRows(await searchPrices(query, scope.filter)); setError(null); }
    catch (e) { setError(String((e as Error).message ?? e)); }
    finally { setLoading(false); }
  }, [query, scope.filter]);

  // Debounced: covers typing, scope changes and returning to the tab.
  useFocusEffect(useCallback(() => { const h = setTimeout(load, 250); return () => clearTimeout(h); }, [load]));
  useFocusEffect(useCallback(() => { priceCities().then(setCities).catch(() => {}); }, []));

  const onMode = (m: ScopeMode) => {
    scope.setMode(m);
    if (m === 'mycity' && !scope.myCity) setPicker('my');
    if (m === 'bycity') setPicker('other');
  };

  const scopeLine = (() => {
    switch (scope.mode) {
      case 'near':
        if (scope.nearStatus === 'locating') return { icon: 'navigate' as const, text: t('Finding stores near you…') };
        if (scope.nearStatus === 'ok') return { icon: 'navigate' as const, text: t('Stores within %km% km', { km: scope.radiusKm }) };
        if (scope.nearStatus === 'denied') return { icon: 'alert-circle-outline' as const, text: scope.myCity ? t('No location — showing %city%', { city: scope.myCity.city }) : t('No location — showing everywhere') };
        return { icon: 'alert-circle-outline' as const, text: scope.myCity ? t('No known store nearby — showing %city%', { city: scope.myCity.city }) : t('No known store nearby — showing everywhere') };
      case 'mycity': return { icon: 'location' as const, text: scope.myCity?.city ?? t('Choose your city'), onPress: () => setPicker('my') };
      case 'bycity': return { icon: 'map' as const, text: scope.otherCity?.city ?? t('Choose a city'), onPress: () => setPicker('other') };
      default: return { icon: 'globe-outline' as const, text: t('All cities') };
    }
  })();

  const header = (
    <View style={{ gap: Spacing.two, marginBottom: Spacing.two }}>
      <Ticker />
      <AlertBanner hits={alerts.hits} onDismiss={alerts.dismiss} />
      <View style={[styles.basketCard, { backgroundColor: theme.backgroundElement }]}>
        <Pressable onPress={() => router.push(BASKET_HREF)} style={({ pressed }) => [styles.basketMain, pressed && { opacity: 0.8 }]} accessibilityRole="button">
          <View style={styles.basketIcon}><Ionicons name="basket" size={22} color="#fff" /></View>
          <View style={{ flex: 1, gap: 1 }}>
            <ThemedText type="smallBold" style={{ fontSize: 16 }}>{t('My basket')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{t('Make a list, then see which store sells the whole basket cheapest.')}</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>
        <Pressable onPress={() => router.push(ALERTS_HREF)} style={({ pressed }) => [styles.basketAlerts, { borderLeftColor: theme.backgroundSelected }, pressed && { opacity: 0.8 }]} accessibilityLabel={t('My alerts')}>
          <Ionicons name="notifications-outline" size={20} color={Brand.primary} />
          <ThemedText type="small" style={{ color: Brand.primary, fontSize: 11, lineHeight: 14 }}>{t('Alerts')}</ThemedText>
        </Pressable>
      </View>
      <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder={t('Search a product, e.g. rice 5kg')} placeholderTextColor="#888"
          value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing"
        />
        {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={theme.textSecondary} /></Pressable> : null}
      </View>
      <Segmented
        options={[
          { key: 'near', label: t('Near me') }, { key: 'mycity', label: t('My city') },
          { key: 'bycity', label: t('By city') }, { key: 'anywhere', label: t('Anywhere') },
        ]}
        value={scope.mode} onChange={onMode}
      />
      {scope.mode === 'near' ? <RadiusPicker value={scope.radiusKm} onChange={scope.setRadiusKm} /> : null}
      <Pressable onPress={scopeLine.onPress} disabled={!scopeLine.onPress} style={styles.scopeLine}>
        <Ionicons name={scopeLine.icon} size={14} color={Brand.primary} />
        <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>{scopeLine.text}</ThemedText>
        {scopeLine.onPress ? <ThemedText type="small" style={{ color: Brand.primary }}>{t('Change')}</ThemedText> : null}
        {scope.mode === 'near' && scope.nearStatus !== 'locating' ? (
          <Pressable onPress={scope.refreshNear} hitSlop={8}><Ionicons name="refresh" size={16} color={Brand.primary} /></Pressable>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.one }}>
        <ThemedText type="smallBold" style={{ fontSize: 16, flex: 1 }}>{query.trim() ? t('Results') : t('Recently seen')}</ThemedText>
        {loading ? <ActivityIndicator color={Brand.primary} /> : null}
      </View>
    </View>
  );

  const empty = (
    <View style={styles.empty}>
      {loading ? null : (
        <>
          <View style={styles.emptyIcon}><Ionicons name="pricetags" size={30} color={Brand.primary} /></View>
          <ThemedText type="smallBold" style={{ fontSize: 17, textAlign: 'center' }}>
            {error ?? (query.trim() ? t('No community price for “%q%” here yet', { q: query.trim() }) : t('No community prices here yet'))}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {t('Every receipt you scan adds anonymous price tags to the pool — product, store, city, date and price, never who bought it. Prices appear from the first report; more reports make them more reliable.')}
          </ThemedText>
          <Pressable onPress={() => router.navigate('/scan')} style={styles.emptyBtn}>
            <Ionicons name="camera-outline" size={18} color={Brand.primary} />
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>{t('Scan a receipt')}</ThemedText>
          </Pressable>
        </>
      )}
    </View>
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => `${r.product_key}|${r.currency}`}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) => (
          <ProductResultCard row={item} onPress={() => router.push({ pathname: '/product/[key]', params: { key: item.product_key } })} />
        )}
      />
      {/* Market quick-add is hidden for launch: an unchecked entry point lets one person poison the pool.
          The screen and RPC stay (app/quick-add.tsx) for when trust rules exist (new-account weighting, medians). */}
      <CityPicker
        visible={picker !== null}
        title={picker === 'my' ? t('Your city') : t('Choose a city')}
        cities={cities}
        onClose={() => setPicker(null)}
        onSelect={(c) => { if (picker === 'my') scope.setMyCity(c); else scope.setOtherCity(c); setPicker(null); }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  basketCard: { flexDirection: 'row', alignItems: 'stretch', borderRadius: 16, overflow: 'hidden' },
  basketMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 12 },
  basketIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  basketAlerts: { width: 64, alignItems: 'center', justifyContent: 'center', gap: 2, borderLeftWidth: StyleSheet.hairlineWidth },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 14, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  scopeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(11,110,79,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.two, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: Brand.primary },
});
