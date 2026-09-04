// Store page: where this shop is cheap and where it is dear (vs its city), and how it moves its prices.
import '@/features/prices/i18n';
import '@/features/reports/i18n';
import '@/features/share/i18n';

import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { getStore, storeIndex, storeOverview } from '@/features/prices/api';
import { FreshnessBadge } from '@/features/prices/components/freshness-badge';
import { sizeLabel } from '@/features/prices/format';
import { IndexChart } from '@/features/reports/charts';
import { Card, Delta, ErrorText, Loading, SectionTitle, styles as ui, useLoader } from '@/features/reports/ui';
import { BigNumber, Rows, ShareButton, ShareCard, ShareCardModal } from '@/features/share/share-card';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

export default function StoreScreen() {
  useLang();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [shareOpen, setShareOpen] = useState(false);
  const { data, error, refreshing, refresh } = useLoader(async () => {
    if (!id) return null;
    const store = await getStore(id);
    const cur = store?.country === 'ZA' ? 'ZAR' : 'MZN'; // the store's country decides the currency shown
    const [rows, idx] = await Promise.all([storeOverview(id, cur), storeIndex(id, cur)]);
    return { store, rows, idx, cur };
  }, [id]);

  const store = data?.store ?? null;
  const rows = data?.rows ?? [];
  const idx = data?.idx ?? [];
  const cur = data?.cur ?? 'MZN';
  const compared = rows.filter((r) => r.diff_pct !== null);
  const cheaper = compared.filter((r) => Math.round(r.diff_pct!) < 0).length; // same rounding as the Delta arrows below
  const dearer = compared.filter((r) => Math.round(r.diff_pct!) > 0).length;
  const overall = compared.length ? compared.map((r) => r.diff_pct!).sort((a, b) => a - b)[Math.floor(compared.length / 2)] : null;
  const last = idx[idx.length - 1];
  const movePct = last ? last.index - 100 : null; // the index is 100 when each product was first seen here
  const title = store ? store.name : t('Store');

  return (
    <ScrollView contentContainerStyle={ui.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Stack.Screen options={{ title }} />
      <ErrorText error={error} />
      {!data && !error ? <Loading /> : null}
      {store ? (
        <>
          <View style={[styles.hero, { backgroundColor: overall === null ? Brand.primary : overall <= -2 ? Brand.success : overall >= 2 ? '#B5542F' : Brand.primary }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two }}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.heroTitle}>{store.name}</ThemedText>
                <ThemedText style={styles.heroSub} numberOfLines={2}>{[store.branch_address, store.city].filter(Boolean).join(' · ')}</ThemedText>
              </View>
              <ShareButton onPress={() => setShareOpen(true)} />
            </View>
            {overall !== null ? (
              <>
                <ThemedText style={styles.heroBig}>{overall > 0 ? '+' : ''}{overall.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</ThemedText>
                <ThemedText style={styles.heroSub}>{t('vs the typical price in %city% · %n% products compared', { city: store.city ?? '—', n: compared.length })}</ThemedText>
                <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one }}>
                  <View style={styles.pill}><ThemedText type="smallBold" style={{ color: '#fff' }}>▼ {cheaper} {t('cheaper here')}</ThemedText></View>
                  <View style={styles.pill}><ThemedText type="smallBold" style={{ color: '#fff' }}>▲ {dearer} {t('dearer here')}</ThemedText></View>
                </View>
              </>
            ) : (
              <ThemedText style={styles.heroSub}>{t('Not enough reports yet to compare this shop with its city.')}</ThemedText>
            )}
          </View>

          {idx.length >= 3 ? (
            <Card>
              <SectionTitle>{t('How this shop moves its prices')}</SectionTitle>
              <ThemedText type="small" themeColor="textSecondary">
                {movePct !== null ? t('Prices here are %pct%% %dir% than when we first saw them, across %n% products.', { pct: Math.abs(Math.round(movePct * 10) / 10), dir: movePct >= 0 ? t('higher') : t('lower'), n: last.products }) : ''}
              </ThemedText>
              <IndexChart series={[{ key: 'idx', label: store.name, color: Brand.primary, points: idx.map((p) => ({ x: p.week_start, y: p.index })) }]} formatX={(x) => { const d = new Date(`${x}T00:00:00`); return `${d.getDate()}/${d.getMonth() + 1}`; }} />
            </Card>
          ) : null}

          <Card>
            <SectionTitle>{t('Prices at this shop')}</SectionTitle>
            <ThemedText type="small" themeColor="textSecondary">{t('Latest community price here, and how it compares with the typical price in the city. Tap a product for its page.')}</ThemedText>
            {rows.length === 0 ? <ThemedText type="small" themeColor="textSecondary">{t('Nothing here yet.')}</ThemedText> : null}
            {rows.map((r) => (
              <Pressable key={r.product_key} onPress={() => router.push({ pathname: '/product/[key]', params: { key: r.product_key } })} style={({ pressed }) => [styles.row, { borderTopColor: theme.backgroundSelected }, pressed && { opacity: 0.7 }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="small" style={{ fontWeight: '600' }} numberOfLines={1}>{r.display_name}{sizeLabel(r.size_value, r.size_unit) ? <ThemedText type="small" themeColor="textSecondary"> {sizeLabel(r.size_value, r.size_unit)}</ThemedText> : null}</ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <FreshnessBadge observedOn={r.observed_on} reports={r.report_count} />
                    {r.city_median !== null ? <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>{t('city %price%', { price: formatMoney(r.city_median) })}</ThemedText> : null}
                  </View>
                </View>
                <ThemedText type="smallBold">{formatMoney(r.price, cur)}</ThemedText>
                <View style={{ width: 62, alignItems: 'flex-end' }}><Delta pct={r.diff_pct} size={13} /></View>
              </Pressable>
            ))}
          </Card>

          <ShareCardModal visible={shareOpen} onClose={() => setShareOpen(false)}>
            <ShareCard title={store.name} subtitle={[store.branch_address, store.city].filter(Boolean).join(' · ')}>
              {overall !== null ? <BigNumber value={`${overall > 0 ? '+' : ''}${overall.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`} label={t('vs the typical price in %city% · %n% products compared', { city: store.city ?? '—', n: compared.length })} tone={overall <= -2 ? 'down' : overall >= 2 ? 'up' : 'neutral'} /> : null}
              <Rows rows={[...compared].sort((a, b) => a.diff_pct! - b.diff_pct!).slice(0, 5).map((r) => ({ left: r.display_name, sub: formatMoney(r.price, cur), right: `${r.diff_pct! > 0 ? '▲ +' : '▼ '}${Math.abs(r.diff_pct!).toLocaleString()}%` }))} />
            </ShareCard>
          </ShareCardModal>
        </>
      ) : data && !store ? <ThemedText themeColor="textSecondary">{t('Store not found.')}</ThemedText> : null}
      <View style={{ height: Spacing.two }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Ionicons name="lock-closed-outline" size={12} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">{t('Prices from real receipts, shared anonymously.')}</ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: Spacing.three, gap: 4 },
  heroTitle: { color: '#fff', fontSize: 24, lineHeight: 30, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 18 },
  heroBig: { color: '#fff', fontSize: 40, lineHeight: 46, fontWeight: '900', marginTop: Spacing.one },
  pill: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
