// Community price index per city: base 100 at the first month, one line per city, biggest movers listed.
import '@/features/prices/i18n';
import '@/features/reports/i18n';

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { cityPriceIndex, type CityIndexPoint } from '@/features/prices/api';
import { latestByCity } from '@/features/prices/components/city-index-teaser';
import { IndexChart, type IndexSeries } from '@/features/reports/charts';
import { monthShort } from '@/features/reports/dates';
import { assignColors, useChartPalette } from '@/features/reports/palette';
import { Card, Delta, ErrorText, Loading, SectionTitle, styles as ui, useLoader } from '@/features/reports/ui';
import { t, useLang } from '@/lib/i18n';

export default function PriceIndexScreen() {
  useLang();
  const p = useChartPalette();
  const { data, error, refreshing, refresh } = useLoader(() => cityPriceIndex(12), []);
  const points: CityIndexPoint[] = data ?? [];
  const latest = latestByCity(points);
  const shown = latest.slice(0, 5);
  const colors = assignColors(shown.map((r) => r.city), p);
  const series: IndexSeries[] = shown.map((r) => ({
    key: `${r.city}|${r.currency}`, label: `${r.city} (${r.currency})`, color: colors[r.city],
    points: points.filter((x) => x.city === r.city && x.currency === r.currency).map((x) => ({ x: x.month, y: x.index })),
  }));

  return (
    <ScrollView contentContainerStyle={ui.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Stack.Screen options={{ title: t('Price index by city') }} />
      <ErrorText error={error} />
      {!data && !error ? <Loading /> : null}
      {data && !points.length ? (
        <Card style={{ alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four }}>
          <Ionicons name="analytics-outline" size={36} color={Brand.primary} />
          <ThemedText type="smallBold" style={{ fontSize: 17, textAlign: 'center' }}>{t('The index is warming up')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {t('A city gets an index once at least three products have prices in two consecutive months. Every receipt scanned in that city brings it closer.')}
          </ThemedText>
        </Card>
      ) : null}
      {points.length ? (
        <>
          <Card>
            <SectionTitle>{t('Community price index')}</SectionTitle>
            <ThemedText type="small" themeColor="textSecondary">{t('100 = the first month with data. Median change of the same products, month over month, from everyone’s receipts.')}</ThemedText>
            <IndexChart series={series} formatX={(x) => monthShort(x.slice(0, 7))} />
          </Card>
          <Card>
            <SectionTitle>{t('This month')}</SectionTitle>
            {latest.map((r) => (
              <View key={`${r.city}|${r.currency}`} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">{r.city} <ThemedText type="small" themeColor="textSecondary">{r.currency}</ThemedText></ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{t('in %month%', { month: monthShort(r.month.slice(0, 7)) })} · {t('%n% products', { n: r.products })} · {t('index %i%', { i: r.index.toLocaleString() })}</ThemedText>
                </View>
                <Delta pct={r.change_pct} size={15} />
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}
