// Home dashboard: this month, budgets, weekly recap, 6-month bars, category ring, top stores, insights.
import '@/features/reports/i18n';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { loadDashboard, type Dashboard } from '@/features/reports/api';
import { budgetStatus, listBudgets, type Budget } from '@/features/reports/budgets';
import { BarChart, RingChart } from '@/features/reports/charts';
import { monthLong, monthShort } from '@/features/reports/dates';
import { BudgetRings, HeadlineCard, OnboardingCard, WeeklyCard } from '@/features/reports/home-cards';
import { DueSoonCard, InflationTeaser, RecapAskCard } from '@/features/reports/home-insights';
import { detectRecurring, fetchHistory, personalInflation, type Recurring } from '@/features/reports/insights';
import { enableWeeklyRecap, getRecapPref, rescheduleWeeklyRecap, setRecapPref, type RecapPref } from '@/features/reports/notifications';
import { assignColors, useChartPalette } from '@/features/reports/palette';
import { Card, ErrorText, Row, SectionTitle, styles as ui } from '@/features/reports/ui';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';
import { supabaseConfigured } from '@/lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const { lang } = useLang();
  const p = useChartPalette();
  const [d, setD] = useState<Dashboard | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [inflationPct, setInflationPct] = useState<number | null>(null);
  const [recapPref, setRecapPrefState] = useState<RecapPref>('off');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabaseConfigured) { setError('Supabase is not configured (app/.env missing).'); return; }
    try {
      const [dash, b, pref] = await Promise.all([loadDashboard(), listBudgets().catch(() => [] as Budget[]), getRecapPref()]);
      setD(dash); setBudgets(b); setRecapPrefState(pref); setError(null);
      rescheduleWeeklyRecap(dash.week.current, dash.week.currentCount, dash.currency);
      if (dash.receiptsAllTime > 0) {
        fetchHistory().then((h) => { setRecurring(detectRecurring(h)); setInflationPct(personalInflation(h).overallPct); }).catch(() => {});
      }
    } catch (e) { setError(String((e as Error).message ?? e)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const statuses = useMemo(() => (d ? budgetStatus(budgets, d.currency, d.thisMonth.total, d.byCategory) : []), [d, budgets]);
  const overall = statuses.find((s) => s.budget.category === null) ?? null;
  const perCategory = statuses.filter((s) => s.budget.category !== null);

  const ring = useMemo(() => {
    if (!d) return { segments: [], colors: {} as Record<string, string>, legend: [] as { name: string; total: number }[] };
    const top = d.byCategory.slice(0, 7);
    const rest = d.byCategory.slice(7).reduce((s, c) => s + c.total, 0);
    const legend = rest > 0 ? [...top, { name: 'Other', total: rest }] : top;
    const colors = assignColors(legend.map((c) => c.name), p);
    return { legend, colors, segments: legend.map((c) => ({ key: c.name, value: c.total, color: colors[c.name] })) };
  }, [d, p]);

  const go = (path: string) => router.push(path as Href);
  const monthName = d ? monthLong(d.months[5].ym, lang) : '';

  async function onRecapYes() {
    const ok = await enableWeeklyRecap();
    setRecapPrefState(ok ? 'on' : 'off');
    if (ok && d) { await rescheduleWeeklyRecap(d.week.current, d.week.currentCount, d.currency); }
    Alert.alert(t('Weekly recap'), ok ? t('Weekly recap is on. You will get one notification every Sunday at 18:00.') : t('Notifications are off for IziCost. Enable them in the phone settings to get the recap.'));
  }

  return (
    <ScrollView contentContainerStyle={ui.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <ErrorText error={error} />
      {d && d.receiptsAllTime === 0 ? <OnboardingCard onScan={() => router.navigate('/scan')} /> : null}
      {d && d.receiptsAllTime > 0 ? <HeadlineCard d={d} monthName={monthName} overall={overall} onBudget={() => go('/reports/budgets')} /> : null}
      {!d && !error ? <Card><ThemedText themeColor="textSecondary">{t('Loading…')}</ThemedText></Card> : null}

      {d ? <BudgetRings statuses={perCategory} currency={d.currency} onPress={() => go('/reports/budgets')} /> : null}
      {d && d.receiptsAllTime > 0 ? <WeeklyCard d={d} /> : null}
      {d && d.receiptsAllTime > 0 && recapPref === null ? (
        <RecapAskCard onYes={onRecapYes} onNo={async () => { await setRecapPref('off'); setRecapPrefState('off'); }} />
      ) : null}
      <DueSoonCard items={recurring} />

      {d && d.receiptsAllTime > 0 ? (
        <Card>
          <SectionTitle action={t('By month')} onAction={() => go(`/reports/month?ym=${d.months[5].ym}`)}>{t('Last 6 months')}</SectionTitle>
          <BarChart
            data={d.months.map((m, i) => ({ key: m.ym, label: monthShort(m.ym), value: m.total, highlight: i === 5 }))}
            onPressBar={(b) => go(`/reports/month?ym=${b.key}`)}
          />
          <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>{t('Tap a bar to open that month')}</ThemedText>
        </Card>
      ) : null}

      {d && ring.legend.length > 0 ? (
        <Card>
          <SectionTitle action={t('See all')} onAction={() => go('/reports/categories')}>{t('By category')}</SectionTitle>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
            <RingChart segments={ring.segments} size={140} thickness={20} onPressSegment={(s) => s.key !== 'Other' && go(`/reports/category?category=${encodeURIComponent(s.key)}`)}>
              <ThemedText type="smallBold" style={{ fontSize: 15 }}>{formatMoney(d.thisMonth.total, d.currency)}</ThemedText>
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

      {d && d.byStore.length > 0 ? (
        <Card>
          <SectionTitle action={t('See all')} onAction={() => go('/reports/stores')}>{t('Top stores')}</SectionTitle>
          {d.byStore.map((s) => (
            <Row key={s.name} title={s.name} subtitle={`${s.count} ${t('receipts')}`} right={formatMoney(s.total)} onPress={() => go(`/reports/store?name=${encodeURIComponent(s.name)}`)} />
          ))}
        </Card>
      ) : null}

      <InflationTeaser pct={inflationPct} onPress={() => go('/reports/inflation')} />

      {d && d.receiptsAllTime > 0 ? (
        <>
          <Pressable style={ui.primaryBtn} onPress={() => go('/reports')}>
            <Ionicons name="stats-chart" color="#fff" size={20} />
            <ThemedText style={ui.primaryBtnText}>{t('All reports')}</ThemedText>
          </Pressable>
          <Pressable style={[ui.primaryBtn, { backgroundColor: 'transparent', borderWidth: 2, borderColor: Brand.primary, paddingVertical: 12 }]} onPress={() => router.navigate('/scan')}>
            <Ionicons name="camera" color={Brand.primary} size={20} />
            <ThemedText style={[ui.primaryBtnText, { color: Brand.primary }]}>{t('Scan a receipt')}</ThemedText>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}
