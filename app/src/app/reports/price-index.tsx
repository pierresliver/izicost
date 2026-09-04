// Community price index per city: base 100 at the first month, one line per city, biggest movers listed,
// a staples table per city, open data as CSV, and a share card. Everything from the anonymised pool.
import '@/features/prices/i18n';
import '@/features/reports/i18n';
import '@/features/share/i18n';

import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { Stack } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { cityPriceIndex, cityStaples, type CityIndexPoint, type StapleRow } from '@/features/prices/api';
import { latestByCity } from '@/features/prices/components/city-index-teaser';
import { Segmented } from '@/features/prices/components/segmented';
import { sizeLabel } from '@/features/prices/format';
import { IndexChart, type IndexSeries } from '@/features/reports/charts';
import { iso, monthShort } from '@/features/reports/dates';
import { assignColors, useChartPalette } from '@/features/reports/palette';
import { Card, Delta, ErrorText, Loading, SectionTitle, styles as ui, useLoader } from '@/features/reports/ui';
import { Rows, ShareButton, ShareCard, ShareCardModal } from '@/features/share/share-card';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function PriceIndexScreen() {
  useLang();
  const theme = useTheme();
  const p = useChartPalette();
  const { data, error, refreshing, refresh } = useLoader(() => cityPriceIndex(12), []);
  const points: CityIndexPoint[] = useMemo(() => data ?? [], [data]);
  const latest = useMemo(() => latestByCity(points), [points]);
  const cities = useMemo(() => Array.from(new Set(latest.map((r) => r.city))), [latest]);
  const [city, setCity] = useState<string | null>(null);
  const [staples, setStaples] = useState<StapleRow[] | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const selected = city && cities.includes(city) ? city : cities[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    let live = true;
    cityStaples(selected).then((rows) => { if (live) setStaples(rows); }).catch(() => { if (live) setStaples([]); });
    return () => { live = false; };
  }, [selected]);

  const shown = latest.slice(0, 5);
  const colors = assignColors(shown.map((r) => r.city), p);
  const series: IndexSeries[] = shown.map((r) => ({
    key: `${r.city}|${r.currency}`, label: `${r.city} (${r.currency})`, color: colors[r.city],
    points: points.filter((x) => x.city === r.city && x.currency === r.currency).map((x) => ({ x: x.month, y: x.index })),
  }));

  async function downloadCsv() {
    if (busy) return;
    setBusy(true);
    try {
      const lines = ['section,city,currency,month,index,change_pct,products,product,size,category,median_price,min_price,max_price,reports,stores,change_vs_prev_60d_pct'];
      for (const r of points) lines.push(['index', r.city, r.currency, r.month, r.index, r.change_pct, r.products, '', '', '', '', '', '', '', '', ''].map(csvCell).join(','));
      for (const c of cities) {
        const rows = c === selected && staples ? staples : await cityStaples(c);
        for (const s of rows) lines.push(['staple', c, 'MZN', iso(new Date()), '', '', '', s.display_name, sizeLabel(s.size_value, s.size_unit), s.category, s.median_price, s.min_price, s.max_price, s.report_count, s.store_count, s.change_pct].map(csvCell).join(','));
      }
      const file = new File(Paths.cache, `izicost-price-index-${iso(new Date())}.csv`);
      if (file.exists) file.delete();
      file.write('﻿' + lines.join('\r\n'));
      if (!(await Sharing.isAvailableAsync())) throw new Error(t('Sharing is not available on this device.'));
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: t('Price index by city') });
    } catch (e) { Alert.alert(t('Could not export'), String((e as Error).message ?? e)); }
    finally { setBusy(false); }
  }

  const movers = (staples ?? []).filter((s) => s.change_pct !== null).sort((a, b) => Math.abs(b.change_pct!) - Math.abs(a.change_pct!));

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
              <ThemedText style={[ui.sectionTitle, { flex: 1 }]}>{t('Community price index')}</ThemedText>
              <ShareButton onPress={() => setShareOpen(true)} label={t('Share')} />
            </View>
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

          <Card>
            <SectionTitle>{t('Staples table')}</SectionTitle>
            <ThemedText type="small" themeColor="textSecondary">{t('Median price over the last 30 days in the chosen city, and the change against the 60 days before.')}</ThemedText>
            {cities.length > 1 && selected ? <Segmented options={cities.map((c) => ({ key: c, label: c }))} value={selected} onChange={setCity} scroll={cities.length > 3} /> : null}
            {staples === null ? <ActivityIndicator color={Brand.primary} /> : null}
            {staples && !staples.length ? <ThemedText type="small" themeColor="textSecondary">{t('Nothing here yet.')}</ThemedText> : null}
            {(staples ?? []).map((s) => (
              <View key={s.product_key} style={[styles.staple, { borderTopColor: theme.backgroundSelected }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="small" style={{ fontWeight: '600' }} numberOfLines={1}>{s.display_name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
                    {formatMoney(s.min_price)}–{formatMoney(s.max_price)} · {s.report_count} {t('reports')} · {s.store_count} {t('stores')}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">{formatMoney(s.median_price, 'MZN')}</ThemedText>
                <View style={{ width: 62, alignItems: 'flex-end' }}><Delta pct={s.change_pct} size={13} /></View>
              </View>
            ))}
            <Pressable onPress={downloadCsv} disabled={busy} style={[ui.primaryBtn, { marginTop: Spacing.two, opacity: busy ? 0.7 : 1 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="download-outline" color="#fff" size={20} />}
              <ThemedText style={ui.primaryBtnText}>{t('Download the data (CSV)')}</ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>{t('Open data: the index for every city and the staples tables, as a spreadsheet file. Free to use with a mention of IziCost.')}</ThemedText>
          </Card>

          <ShareCardModal visible={shareOpen} onClose={() => setShareOpen(false)}>
            <ShareCard title={t('Price index by city')} subtitle={selected ? `${t('this month')} · ${selected}: ${movers.length ? t('%n% products tracked', { n: staples?.length ?? 0 }) : ''}` : t('this month')}>
              <Rows rows={latest.slice(0, 6).map((r) => ({ left: r.city, sub: t('%n% products', { n: r.products }), right: `${r.change_pct > 0 ? '▲ +' : r.change_pct < 0 ? '▼ ' : ''}${r.change_pct.toLocaleString()}%` }))} />
              {movers.length ? (
                <>
                  <ThemedText type="small" style={{ color: '#4B5563', marginTop: 4 }}>{t('Biggest moves in %city%', { city: selected ?? '' })}</ThemedText>
                  <Rows rows={movers.slice(0, 4).map((s) => ({ left: s.display_name, right: `${s.change_pct! > 0 ? '▲ +' : '▼ '}${Math.abs(s.change_pct!).toLocaleString()}%`, sub: formatMoney(s.median_price, 'MZN') }))} />
                </>
              ) : null}
            </ShareCard>
          </ShareCardModal>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  staple: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
