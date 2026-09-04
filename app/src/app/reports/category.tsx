// One category: 6-month trend, subcategory breakdown, and the items bought (last 3 months, newest first).
import '@/features/reports/i18n';

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { RefreshControl, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BarChart } from '@/features/reports/charts';
import { monthShort } from '@/features/reports/dates';
import { loadCategory } from '@/features/reports/detail';
import { categoryColor, useChartPalette } from '@/features/reports/palette';
import { Card, Empty, ErrorText, Loading, Row, SectionTitle, styles as ui, useLoader } from '@/features/reports/ui';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';
import { ScopeCaption } from '@/features/household/components/scope-caption';

export default function CategoryScreen() {
  useLang();
  const router = useRouter();
  const p = useChartPalette();
  const { category = 'other' } = useLocalSearchParams<{ category?: string }>();
  const { data, error, refreshing, refresh } = useLoader(() => loadCategory(category), [category]);
  const color = categoryColor(category, p);
  const thisMonth = data?.trend[5]?.total ?? 0;

  return (
    <ScrollView contentContainerStyle={ui.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Stack.Screen options={{ title: t(category) }} />
      <ScopeCaption />
      <ErrorText error={error} />
      {!data && !error ? <Loading /> : null}
      {data ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">{t('This month')}</ThemedText>
          <ThemedText style={ui.big}>{formatMoney(thisMonth, data.currency)}</ThemedText>
          <SectionTitle>{t('Monthly trend')}</SectionTitle>
          <BarChart color={color} data={data.trend.map((m, i) => ({ key: m.ym, label: monthShort(m.ym), value: m.total, highlight: i === data.trend.length - 1 }))} />
        </Card>
      ) : null}
      {data && data.subcategories.length ? (
        <Card>
          <SectionTitle>{t('Subcategories')} · {t('Last 3 months')}</SectionTitle>
          {data.subcategories.map((s) => (
            <Row key={s.name} title={s.name === 'other' ? t('other') : s.name} subtitle={`${s.count} ${t('items')}`} right={formatMoney(s.total)} />
          ))}
        </Card>
      ) : null}
      {data && !data.items.length ? <Empty text={t('No items in this category yet.')} /> : null}
      {data && data.items.length ? (
        <Card>
          <SectionTitle>{t('Items (last 3 months)')}</SectionTitle>
          {data.items.slice(0, 150).map((it) => (
            <Row key={it.key} title={it.name} subtitle={`${it.store} · ${it.date}`} right={formatMoney(it.price)}
              onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: it.receiptId } })} />
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}
