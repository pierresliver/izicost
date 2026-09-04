// All categories: this month's total and a 6-month sparkline each.
import '@/features/reports/i18n';

import { Stack, useRouter, type Href } from 'expo-router';
import { RefreshControl, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Sparkline } from '@/features/reports/charts';
import { loadCategoryOverview } from '@/features/reports/detail';
import { categoryColor, useChartPalette } from '@/features/reports/palette';
import { Card, Empty, ErrorText, Loading, Row, SectionTitle, styles as ui, useLoader } from '@/features/reports/ui';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';
import { ScopeCaption } from '@/features/household/components/scope-caption';

export default function CategoriesScreen() {
  useLang();
  const router = useRouter();
  const p = useChartPalette();
  const { data, error, refreshing, refresh } = useLoader(loadCategoryOverview, []);

  return (
    <ScrollView contentContainerStyle={ui.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Stack.Screen options={{ title: t('By category') }} />
      <ScopeCaption />
      <ErrorText error={error} />
      {!data && !error ? <Loading /> : null}
      {data && !data.categories.length ? <Empty /> : null}
      {data && data.categories.length ? (
        <Card>
          <SectionTitle>{t('This month')} · {t('Last 12 months')}</SectionTitle>
          {data.categories.map((c) => (
            <Row key={c.name} title={t(c.name)} right={formatMoney(c.thisMonth, data.currency)} color={categoryColor(c.name, p)}
              rightSub={formatMoney(c.trend.reduce((s, x) => s + x, 0))} onPress={() => router.push(`/reports/category?category=${encodeURIComponent(c.name)}` as Href)}>
              <Sparkline values={c.trend} width={90} height={24} color={categoryColor(c.name, p)} />
            </Row>
          ))}
          <ThemedText type="small" themeColor="textSecondary">{t('This month')} / {t('Last 12 months')}</ThemedText>
        </Card>
      ) : null}
    </ScrollView>
  );
}
