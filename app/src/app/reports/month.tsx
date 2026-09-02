// One month: total, categories ring, stores, receipts. Arrows move to the previous/next month.
import '@/features/reports/i18n';

import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { loadMonth } from '@/features/reports/api';
import { RingChart } from '@/features/reports/charts';
import { monthLong, ym, ymShift } from '@/features/reports/dates';
import { assignColors, useChartPalette } from '@/features/reports/palette';
import { Card, Empty, ErrorText, Loading, Row, SectionTitle, styles as ui, useLoader } from '@/features/reports/ui';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

export default function MonthScreen() {
  const { lang } = useLang();
  const router = useRouter();
  const p = useChartPalette();
  const params = useLocalSearchParams<{ ym?: string }>();
  const [month, setMonth] = useState(params.ym && /^\d{4}-\d{2}$/.test(params.ym) ? params.ym : ym(new Date()));
  const { data, error, refreshing, refresh } = useLoader(() => loadMonth(month), [month]);
  const go = (path: string) => router.push(path as Href);
  const isCurrent = month >= ym(new Date());

  const ring = useMemo(() => {
    if (!data) return { legend: [] as { name: string; total: number }[], colors: {} as Record<string, string> };
    const top = data.byCategory.slice(0, 7);
    const rest = data.byCategory.slice(7).reduce((s, c) => s + c.total, 0);
    const legend = rest > 0 ? [...top, { name: 'Other', total: rest }] : top;
    return { legend, colors: assignColors(legend.map((c) => c.name), p) };
  }, [data, p]);

  return (
    <ScrollView contentContainerStyle={ui.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Stack.Screen options={{ title: t('By month') }} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => setMonth(ymShift(month, -1))} hitSlop={10}><Ionicons name="chevron-back" size={24} color={Brand.primary} /></Pressable>
          <ThemedText style={ui.sectionTitle}>{monthLong(month, lang)}</ThemedText>
          <Pressable onPress={() => !isCurrent && setMonth(ymShift(month, 1))} hitSlop={10} disabled={isCurrent}>
            <Ionicons name="chevron-forward" size={24} color={isCurrent ? '#8A8F98' : Brand.primary} />
          </Pressable>
        </View>
        <ThemedText style={[ui.big, { textAlign: 'center' }]}>{data ? formatMoney(data.total, data.currency) : '—'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>{data?.count ?? 0} {t('receipts')}</ThemedText>
        {data && data.others.length ? (
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {t('Also %amounts% in other currencies', { amounts: data.others.map((o) => formatMoney(o.total, o.currency)).join(', ') })}
          </ThemedText>
        ) : null}
      </Card>
      <ErrorText error={error} />
      {!data && !error ? <Loading /> : null}
      {data && data.count === 0 ? <Empty text={t('No receipts in this month.')} /> : null}

      {data && ring.legend.length ? (
        <Card>
          <SectionTitle>{t('Categories')}</SectionTitle>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
            <RingChart segments={ring.legend.map((c) => ({ key: c.name, value: c.total, color: ring.colors[c.name] }))} size={130} thickness={18}>
              <ThemedText type="smallBold" style={{ fontSize: 13 }}>{ring.legend.length}</ThemedText>
            </RingChart>
            <View style={{ flex: 1 }}>
              {ring.legend.map((c) => (
                <Row key={c.name} title={c.name === 'Other' ? t('Other') : t(c.name)} right={formatMoney(c.total)} color={ring.colors[c.name]}
                  onPress={c.name === 'Other' ? undefined : () => go(`/reports/category?category=${encodeURIComponent(c.name)}`)} />
              ))}
            </View>
          </View>
        </Card>
      ) : null}

      {data && data.byStore.length ? (
        <Card>
          <SectionTitle>{t('Stores')}</SectionTitle>
          {data.byStore.map((s) => (
            <Row key={s.name} title={s.name} subtitle={`${s.count} ${t('receipts')}`} right={formatMoney(s.total)} onPress={() => go(`/reports/store?name=${encodeURIComponent(s.name)}`)} />
          ))}
        </Card>
      ) : null}

      {data && data.receipts.length ? (
        <Card>
          <SectionTitle>{t('Receipts')}</SectionTitle>
          {data.receipts.map((r) => (
            <Row key={r.id} title={r.store_name ?? '?'} subtitle={r.purchased_on ?? '—'} right={formatMoney(r.total, r.currency)}
              onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })} />
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}
