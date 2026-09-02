// One store: totals, average basket, spend per month, top categories, receipts.
import '@/features/reports/i18n';

import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { BarChart } from '@/features/reports/charts';
import { monthShort } from '@/features/reports/dates';
import { loadStore } from '@/features/reports/detail';
import { categoryColor, useChartPalette } from '@/features/reports/palette';
import { Card, Empty, ErrorText, Loading, Row, SectionTitle, styles as ui, useLoader } from '@/features/reports/ui';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText style={{ fontSize: 20, lineHeight: 26, fontWeight: '700' }}>{value}</ThemedText>
    </View>
  );
}

export default function StoreScreen() {
  useLang();
  const router = useRouter();
  const p = useChartPalette();
  const { name = '?' } = useLocalSearchParams<{ name?: string }>();
  const { data, error, refreshing, refresh } = useLoader(() => loadStore(name), [name]);

  return (
    <ScrollView contentContainerStyle={ui.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Stack.Screen options={{ title: name }} />
      <ErrorText error={error} />
      {!data && !error ? <Loading /> : null}
      {data && data.count === 0 ? <Empty /> : null}
      {data && data.count > 0 ? (
        <>
          <Card>
            <ThemedText type="small" themeColor="textSecondary">{t('All time')}</ThemedText>
            <ThemedText style={ui.big}>{formatMoney(data.total, data.currency)}</ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.one }}>
              <Stat label={t('visits')} value={String(data.count)} />
              <Stat label={t('Average basket')} value={formatMoney(data.avgBasket)} />
              <Stat label={t('items')} value={data.avgItems.toFixed(1)} />
            </View>
          </Card>
          <Card>
            <SectionTitle>{t('Spend per month')}</SectionTitle>
            <BarChart data={data.trend.map((m, i) => ({ key: m.ym, label: monthShort(m.ym), value: m.total, highlight: i === 5 }))} />
          </Card>
          {data.topCategories.length ? (
            <Card>
              <SectionTitle>{t('Categories')} · {t('Last 3 months')}</SectionTitle>
              {data.topCategories.map((c) => (
                <Row key={c.name} title={t(c.name)} right={formatMoney(c.total)} color={categoryColor(c.name, p)}
                  onPress={() => router.push(`/reports/category?category=${encodeURIComponent(c.name)}` as Href)} />
              ))}
            </Card>
          ) : null}
          <Card>
            <SectionTitle>{t('Receipts at this store')}</SectionTitle>
            {data.receipts.map((r) => (
              <Row key={r.id} title={r.purchased_on ?? '—'} subtitle={`${r.item_count} ${t('items')}`} right={formatMoney(r.total, r.currency)}
                onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })} />
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}
