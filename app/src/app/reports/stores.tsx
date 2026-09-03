// All stores ranked by total spend (all time), with visit count and last visit.
import '@/features/reports/i18n';

import { Stack, useRouter, type Href } from 'expo-router';
import { RefreshControl, ScrollView } from 'react-native';

import { loadStoreOverview } from '@/features/reports/detail';
import { Card, Empty, ErrorText, Loading, Row, SectionTitle, styles as ui, useLoader } from '@/features/reports/ui';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';
import { ScopeCaption } from '@/features/household/components/scope-caption';

export default function StoresScreen() {
  useLang();
  const router = useRouter();
  const { data, error, refreshing, refresh } = useLoader(loadStoreOverview, []);

  return (
    <ScrollView contentContainerStyle={ui.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Stack.Screen options={{ title: t('By store') }} />
      <ScopeCaption />
      <ErrorText error={error} />
      {!data && !error ? <Loading /> : null}
      {data && !data.stores.length ? <Empty text={t('No stores yet.')} /> : null}
      {data && data.stores.length ? (
        <Card>
          <SectionTitle>{t('Stores')} · {t('All time')}</SectionTitle>
          {data.stores.map((s) => (
            <Row key={s.name} title={s.name} subtitle={`${s.count} ${t('visits')} · ${s.last || '—'}`} right={formatMoney(s.total, data.currency)}
              rightSub={`${t('Average basket')} ${formatMoney(s.count ? s.total / s.count : 0)}`}
              onPress={() => router.push(`/reports/store?name=${encodeURIComponent(s.name)}` as Href)} />
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}
