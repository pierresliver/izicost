// Home: bargain-first. "What do you need to buy?" (say it or type it), then the numbers and charts that
// change every day: this month, this week, your items, budgets, months, categories, stores, inflation,
// the city index, badges. Scanning and community prices live on the tab bar, so no duplicate cards here.
import '@/features/basket/i18n';
import '@/features/home/i18n';
import '@/features/reports/i18n';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { countOpenItems } from '@/features/basket/api';
import { BASKET_HREF, BASKET_QUOTE_HREF } from '@/features/basket/routes';
import { memberName, refreshHousehold, useHousehold } from '@/features/household/api';
import { ScopeToggle } from '@/features/household/components/scope-toggle';
import { CityIndexTeaser } from '@/features/prices/components/city-index-teaser';
import { AchievementsCard } from '@/features/reports/achievements';
import { fetchReceipts, loadDashboard, type Dashboard } from '@/features/reports/api';
import { budgetStatus, listBudgets, type Budget } from '@/features/reports/budgets';
import { BarChart, RingChart } from '@/features/reports/charts';
import { monthEnd, monthLong, monthShort, monthStart, ym } from '@/features/reports/dates';
import { BudgetRings, EmptyChartsCard, HeadlineCard, WeeklyCard } from '@/features/reports/home-cards';
import { DueSoonCard, InflationTeaser, RecapAskCard } from '@/features/reports/home-insights';
import { categoryInflation, detectRecurring, fetchHistory, personalInflation, type CategoryInflation, type Recurring } from '@/features/reports/insights';
import { enableWeeklyRecap, getRecapPref, rescheduleWeeklyRecap, setRecapPref, type RecapPref } from '@/features/reports/notifications';
import { assignColors, useChartPalette } from '@/features/reports/palette';
import { Card, ErrorText, Row, SectionTitle, styles as ui } from '@/features/reports/ui';
import { shareApp } from '@/features/share/share';
import { WatchCard } from '@/features/watch/components/watch-card';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';
import { supabaseConfigured } from '@/lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const { lang } = useLang();
  const p = useChartPalette();
  const { household, scope } = useHousehold();
  const householdId = household?.id ?? null;
  const [d, setD] = useState<Dashboard | null>(null);
  const [mine, setMine] = useState<Dashboard | null>(null); // own-rows numbers for budgets + weekly recap
  const [byMember, setByMember] = useState<{ user_id: string; name: string; total: number; count: number }[]>([]);
  const [basketCount, setBasketCount] = useState(0);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [inflationPct, setInflationPct] = useState<number | null>(null);
  const [catInflation, setCatInflation] = useState<CategoryInflation[]>([]);
  const [recapPref, setRecapPrefState] = useState<RecapPref>('off');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0); // a load that finishes after a newer one started must not overwrite it

  // Loads straight away with whatever is known; re-runs when the household/scope becomes known or changes.
  const load = useCallback(async () => {
    if (!supabaseConfigured) { setError('Supabase is not configured (app/.env missing).'); return; }
    const my = ++seq.current;
    try {
      const inHousehold = !!householdId && scope === 'household';
      if (householdId) await refreshHousehold().catch(() => {}); // members can join or leave from another phone
      const [dash, b, pref, n, own] = await Promise.all([
        loadDashboard(), listBudgets().catch(() => [] as Budget[]), getRecapPref(), countOpenItems().catch(() => 0),
        inHousehold ? loadDashboard({ onlyMe: true }) : null,
      ]);
      if (my !== seq.current) return; // superseded
      const me = own ?? dash;
      setD(dash); setMine(me); setBudgets(b); setRecapPrefState(pref); setBasketCount(n); setError(null);
      rescheduleWeeklyRecap(me.week.current, me.week.currentCount, me.currency);
      if (me.receiptsAllTime > 0) {
        fetchHistory().then((h) => { setRecurring(detectRecurring(h)); setInflationPct(personalInflation(h).overallPct); setCatInflation(categoryInflation(h)); }).catch(() => {});
      }
      if (inHousehold) {
        const now = new Date();
        const rows = await fetchReceipts(monthStart(ym(now)), monthEnd(ym(now)));
        const m = new Map<string, { user_id: string; name: string; total: number; count: number }>();
        for (const r of rows) {
          if ((r.currency ?? '?') !== dash.currency) continue;
          const cur = m.get(r.user_id) ?? { user_id: r.user_id, name: memberName(r.user_id) ?? '?', total: 0, count: 0 };
          cur.total += r.total ?? 0; cur.count += 1; m.set(r.user_id, cur);
        }
        if (my === seq.current) setByMember([...m.values()].sort((a, b) => b.total - a.total));
      } else setByMember([]);
    } catch (e) { if (my === seq.current) setError(String((e as Error).message ?? e)); }
  }, [householdId, scope]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const statuses = useMemo(() => (mine ? budgetStatus(budgets, mine.currency, mine.thisMonth.total, mine.byCategory) : []), [mine, budgets]);
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
  const hasReceipts = !!d && d.receiptsAllTime > 0;

  async function onRecapYes() {
    const ok = await enableWeeklyRecap();
    setRecapPrefState(ok ? 'on' : 'off');
    if (ok && d) { await rescheduleWeeklyRecap(d.week.current, d.week.currentCount, d.currency); }
    Alert.alert(t('Weekly recap'), ok ? t('Weekly recap is on. You will get one notification every Sunday at 18:00.') : t('Notifications are off for IziCost. Enable them in the phone settings to get the recap.'));
  }

  return (
    <ScrollView contentContainerStyle={ui.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      {error ? (
        <Card>
          <ErrorText error={error} />
          <Pressable onPress={load} style={{ alignSelf: 'flex-start', marginTop: Spacing.one }}><ThemedText style={{ color: Brand.primary, fontWeight: '700' }}>{t('Try again')}</ThemedText></Pressable>
        </Card>
      ) : null}

      {/* 1. The promise: tell us what you need, we find the cheapest store */}
      <View style={s.hero}>
        <ThemedText style={s.heroTitle}>{t('What do you need to buy?')}</ThemedText>
        <ThemedText style={s.heroSub}>{t('Say it or type it. We show you which store sells it all cheapest, near you or in any city.')}</ThemedText>
        <View style={s.heroRow}>
          <Pressable onPress={() => router.push(BASKET_HREF)} style={({ pressed }) => [s.fakeInput, pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel={t('Type your list')}>
            <Ionicons name="create-outline" size={20} color={Brand.primary} />
            <ThemedText style={{ color: '#4B5563', fontSize: 16, flex: 1 }} numberOfLines={1}>{t('Type your list')}</ThemedText>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: BASKET_HREF as string, params: { voice: '1' } } as Href)} style={({ pressed }) => [s.micBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={t('Say your list')}>
            <Ionicons name="mic" size={28} color={Brand.primary} />
          </Pressable>
        </View>
        {basketCount > 0 ? (
          <Pressable onPress={() => router.push(BASKET_QUOTE_HREF)} style={({ pressed }) => [s.basketPill, pressed && { opacity: 0.85 }]}>
            <Ionicons name="basket" size={18} color="#fff" />
            <ThemedText style={{ color: '#fff', fontWeight: '700', flex: 1 }}>{basketCount === 1 ? t('1 item in your basket') : t('%n% items in your basket', { n: basketCount })}</ThemedText>
            <ThemedText style={{ color: '#fff', fontWeight: '700' }}>{t('Compare stores now')}</ThemedText>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      {/* 2. Numbers first: this month, this week */}
      {!d && !error ? <Card><ThemedText themeColor="textSecondary">{t('Loading…')}</ThemedText></Card> : null}
      {d && !hasReceipts && !household ? <EmptyChartsCard onScan={() => router.navigate('/scan')} /> : null}
      {hasReceipts || household ? <SectionTitle action={t('All reports')} onAction={() => go('/reports')}>{t('Your spending')}</SectionTitle> : null}
      {household ? <ScopeToggle /> : null}
      {hasReceipts && d ? <HeadlineCard d={d} monthName={monthName} overall={overall} onBudget={() => go('/reports/budgets')} /> : null}
      {hasReceipts && d ? <WeeklyCard d={d} onStory={() => go('/recap')} /> : null}

      {/* 3. Your usual items: cheapest price now, green/red since you last bought, bell for drops */}
      <WatchCard onEmptyScan={() => router.navigate('/scan')} />

      {household && scope === 'household' && byMember.length > 1 && d ? (
        <Card>
          <SectionTitle>{t('Household this month')}</SectionTitle>
          {byMember.map((m) => (
            <Row key={m.user_id} title={m.name} subtitle={m.count === 1 ? t('1 receipt') : `${m.count} ${t('receipts')}`} right={formatMoney(m.total, d.currency)} />
          ))}
        </Card>
      ) : null}
      {mine ? <BudgetRings statuses={perCategory} currency={mine.currency} onPress={() => go('/reports/budgets')} /> : null}
      {household && scope === 'household' && (overall || perCategory.length) ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: -Spacing.two }}>{t('Budgets are personal: they compare against your own receipts.')}</ThemedText>
      ) : null}
      {hasReceipts && recapPref === null ? (
        <RecapAskCard onYes={onRecapYes} onNo={async () => { await setRecapPref('off'); setRecapPrefState('off'); }} />
      ) : null}

      {hasReceipts && d ? (
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
            <RingChart segments={ring.segments} size={140} thickness={20} onPressSegment={(seg) => seg.key !== 'Other' && go(`/reports/category?category=${encodeURIComponent(seg.key)}`)}>
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
          {d.byStore.map((st) => (
            <Row key={st.name} title={st.name} subtitle={`${st.count} ${t('receipts')}`} right={formatMoney(st.total)} onPress={() => go(`/reports/store?name=${encodeURIComponent(st.name)}`)} />
          ))}
        </Card>
      ) : null}

      <InflationTeaser pct={inflationPct} categories={catInflation} onPress={() => go('/reports/inflation')} />
      <CityIndexTeaser onPress={() => go('/reports/price-index')} />
      <DueSoonCard items={recurring} />
      {hasReceipts ? <AchievementsCard /> : null}

      <Pressable onPress={shareApp} style={({ pressed }) => [s.invite, pressed && { opacity: 0.8 }]}>
        <Ionicons name="share-social" size={18} color={Brand.primary} />
        <ThemedText type="smallBold" style={{ color: Brand.primary }}>{t('Invite friends')}</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: Brand.primary, borderRadius: 20, padding: Spacing.three, gap: Spacing.two },
  heroTitle: { color: '#fff', fontSize: 24, lineHeight: 30, fontWeight: '800' },
  heroSub: { color: '#E6F4EE', fontSize: 14, lineHeight: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  fakeInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, height: 52 },
  micBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  basketPill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: Brand.primaryDark, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginTop: Spacing.one },
  invite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.two },
});
