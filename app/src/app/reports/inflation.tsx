// Personal inflation: the 10 most-bought items, latest price vs 1–3 months ago.
import '@/features/reports/i18n';

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { HBarList } from '@/features/reports/charts';
import { categoryInflation, fetchHistory, personalInflation } from '@/features/reports/insights';
import { Card, Delta, Empty, ErrorText, Loading, SectionTitle, styles as ui, useLoader } from '@/features/reports/ui';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';
import { ScopeCaption } from '@/features/household/components/scope-caption';
import { BigNumber, Rows, ShareButton, ShareCard, ShareCardModal } from '@/features/share/share-card';
import '@/features/share/i18n';
import { useState } from 'react';

export default function InflationScreen() {
  useLang();
  const { data, error, refreshing, refresh } = useLoader(async () => {
    const h = await fetchHistory();
    return { ...personalInflation(h), categories: categoryInflation(h) };
  }, []);
  const pct = data?.overallPct ?? null;
  const up = (pct ?? 0) > 0;
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <ScrollView contentContainerStyle={ui.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Stack.Screen options={{ title: t('Inflation') }} />
      <ScopeCaption />
      <ErrorText error={error} />
      {!data && !error ? <Loading /> : null}
      {data ? (
        <Card style={{ alignItems: 'center', paddingVertical: Spacing.four }}>
          {pct !== null ? <View style={{ alignSelf: 'flex-end' }}><ShareButton onPress={() => setShareOpen(true)} /></View> : null}
          <ShareCardModal visible={shareOpen} onClose={() => setShareOpen(false)}>
            <ShareCard title={t('Personal inflation')} subtitle={t('latest price vs 1–3 months ago')}>
              <BigNumber value={pct === null ? '—' : `${up ? '+' : ''}${(Math.round(pct * 10) / 10).toLocaleString()}%`} label={t('My basket costs %pct%% %dir% than 1–3 months ago', { pct: Math.abs(Math.round((pct ?? 0) * 10) / 10), dir: up ? t('more') : t('less') })} tone={pct === null ? 'neutral' : up ? 'up' : 'down'} />
              {data?.categories.length ? <Rows rows={data.categories.slice(0, 4).map((c) => ({ left: t(c.category), sub: c.items === 1 ? t('1 item') : t('%n% items', { n: c.items }), right: `${c.changePct > 0 ? '▲ +' : '▼ '}${Math.abs(Math.round(c.changePct * 10) / 10)}%` }))} /> : null}
            </ShareCard>
          </ShareCardModal>
          <Ionicons name={up ? 'trending-up' : 'trending-down'} size={36} color={pct === null ? Brand.primary : up ? Brand.danger : Brand.success} />
          <ThemedText style={ui.big}>{pct === null ? '—' : `${up ? '+' : ''}${(Math.round(pct * 10) / 10).toLocaleString()}%`}</ThemedText>
          <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {pct === null
              ? t('Not enough history yet. Keep scanning for a few weeks.')
              : t('Your basket costs %pct%% %dir% than 1–3 months ago', { pct: Math.abs(Math.round(pct * 10) / 10), dir: up ? t('more') : t('less') })}
          </ThemedText>
        </Card>
      ) : null}
      {data && data.categories.length ? (
        <Card>
          <SectionTitle>{t('By category')}</SectionTitle>
          <ThemedText type="small" themeColor="textSecondary">{t('Median change of your items in each category, latest price vs 1–3 months ago.')}</ThemedText>
          <HBarList data={data.categories.map((c) => ({ key: c.category, label: t(c.category), pct: c.changePct, sub: c.items === 1 ? t('1 item') : t('%n% items', { n: c.items }) }))} />
        </Card>
      ) : null}
      {data && !data.items.length ? <Empty /> : null}
      {data && data.items.length ? (
        <Card>
          <SectionTitle>{t('Your basket')}</SectionTitle>
          <ThemedText type="small" themeColor="textSecondary">{t('The 10 items you buy most often, latest price vs 1–3 months ago.')}</ThemedText>
          {data.items.map((it) => (
            <View key={it.key} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" numberOfLines={1}>{it.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {t('bought %n% times', { n: it.times })} · {it.store}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {it.before != null
                    ? t('now %now%, before %before%', { now: formatMoney(it.now, it.currency), before: formatMoney(it.before, it.currency) })
                    : `${formatMoney(it.now, it.currency)} · ${t('no older price')}`}
                </ThemedText>
              </View>
              <Delta pct={it.changePct} size={15} />
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}
