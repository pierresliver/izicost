// Cards for the Home dashboard: headline (onboarding / month total + budget ring), budgets, weekly recap.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

import type { Dashboard } from './api';
import type { BudgetStatus } from './budgets';
import { ProgressRing, useAnimatedNumber } from './charts';
import { useChartPalette } from './palette';
import { Card, Delta, SectionTitle, styles as ui } from './ui';

export function OnboardingCard({ onScan }: { onScan: () => void }) {
  return (
    <Card style={{ gap: Spacing.two, alignItems: 'center', paddingVertical: Spacing.four }}>
      <Ionicons name="receipt-outline" size={44} color={Brand.primary} />
      <ThemedText style={{ fontSize: 22, fontWeight: '700', textAlign: 'center' }}>{t('Welcome to IziCost')}</ThemedText>
      <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {t('Scan your first receipt and see where your money goes. Takes about ten seconds.')}
      </ThemedText>
      <Pressable style={[ui.primaryBtn, { alignSelf: 'stretch', marginTop: Spacing.two }]} onPress={onScan}>
        <Ionicons name="camera" color="#fff" size={22} />
        <ThemedText style={ui.primaryBtnText}>{t('Scan a receipt')}</ThemedText>
      </Pressable>
    </Card>
  );
}

/** No receipts yet: a faint sample chart so the dashboard shows what is coming, plus the one action that unlocks it. */
export function EmptyChartsCard({ onScan }: { onScan: () => void }) {
  const p = useChartPalette();
  const grow = useAnimatedNumber(1, 1100);
  const sample = [38, 52, 45, 70, 58, 84]; // just a shape, not data
  return (
    <Card style={{ gap: Spacing.two }}>
      <SectionTitle>{t('Your spending')}</SectionTitle>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 90, paddingHorizontal: Spacing.two }}>
        {sample.map((h, i) => (
          <View key={i} style={{ flex: 1, height: `${h * grow}%`, borderRadius: 6, backgroundColor: i === sample.length - 1 ? `${p.primary}66` : p.track }} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {t('Scan your first receipt and this turns into your real numbers: month by month, by category, by store, and how your usual items move in price.')}
      </ThemedText>
      <Pressable style={[ui.primaryBtn, { paddingVertical: 12 }]} onPress={onScan}>
        <Ionicons name="camera" color="#fff" size={20} />
        <ThemedText style={ui.primaryBtnText}>{t('Scan a receipt')}</ThemedText>
      </Pressable>
    </Card>
  );
}

function levelColor(level: BudgetStatus['level'], p: ReturnType<typeof useChartPalette>): string {
  return level === 'over' ? p.danger : level === 'warn' ? p.warning : p.primary;
}

type HeadlineProps = { d: Dashboard; monthName: string; overall: BudgetStatus | null; onBudget: () => void };

/** This month's total, delta vs last month, receipt count, other-currency note, and the overall budget ring. */
export function HeadlineCard({ d, monthName, overall, onBudget }: HeadlineProps) {
  const p = useChartPalette();
  const n = d.thisMonth.count;
  const others = d.others.map((o) => formatMoney(o.total, o.currency)).join(', ');
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="small" themeColor="textSecondary">{t('This month')} · {monthName}</ThemedText>
          <ThemedText style={ui.big}>{formatMoney(d.thisMonth.total, d.currency)}</ThemedText>
          <Delta pct={d.deltaPct} label={d.deltaPct === null ? t('no receipts last month') : d.deltaPct === 0 ? t('same as last month') : t('vs last month')} />
          <ThemedText type="small" themeColor="textSecondary">
            {n === 1 ? t('You scanned 1 receipt this month') : t('You scanned %n% receipts this month', { n })}
          </ThemedText>
          {others ? <ThemedText type="small" themeColor="textSecondary">{t('Also %amounts% in other currencies', { amounts: others })}</ThemedText> : null}
        </View>
        {overall ? (
          <Pressable onPress={onBudget}>
            <ProgressRing ratio={overall.ratio} size={104} thickness={11} color={levelColor(overall.level, p)}>
              <ThemedText style={{ fontSize: 20, fontWeight: '700', lineHeight: 24 }}>{Math.round(overall.ratio * 100)}%</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>{t('Budget')}</ThemedText>
            </ProgressRing>
          </Pressable>
        ) : null}
      </View>
      {overall ? (
        <View style={s.budgetLine}>
          <Ionicons name={overall.level === 'over' ? 'alert-circle' : overall.level === 'warn' ? 'warning' : 'checkmark-circle'} size={16} color={levelColor(overall.level, p)} />
          <ThemedText type="small" style={{ color: levelColor(overall.level, p), fontWeight: '600', flex: 1 }}>
            {overall.level === 'over'
              ? t('over budget by %amount%', { amount: formatMoney(-overall.left, d.currency) })
              : t('left to spend: %amount% per day', { amount: formatMoney(overall.leftPerDay, d.currency) })}
          </ThemedText>
        </View>
      ) : (
        <Pressable onPress={onBudget} style={s.budgetLine}>
          <Ionicons name="flag-outline" size={16} color={Brand.primary} />
          <ThemedText type="small" style={{ color: Brand.primary, fontWeight: '700' }}>{t('Set a budget')}</ThemedText>
        </Pressable>
      )}
    </Card>
  );
}

/** Small rings for per-category budgets, horizontally. */
export function BudgetRings({ statuses, currency, onPress }: { statuses: BudgetStatus[]; currency: string; onPress: () => void }) {
  const p = useChartPalette();
  if (!statuses.length) return null;
  return (
    <Card onPress={onPress}>
      <SectionTitle action={t('See all')} onAction={onPress}>{t('Budgets')}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'flex-start' }}>
        {statuses.map((st) => (
          <View key={st.budget.id} style={{ alignItems: 'center', width: 84, gap: 4 }}>
            <ProgressRing ratio={st.ratio} size={66} thickness={8} color={levelColor(st.level, p)}>
              <ThemedText type="smallBold" style={{ fontSize: 13, lineHeight: 16 }}>{Math.round(st.ratio * 100)}%</ThemedText>
            </ProgressRing>
            <ThemedText type="small" numberOfLines={1} style={{ fontSize: 12, lineHeight: 15 }}>{t(st.budget.category ?? 'Total')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ fontSize: 11, lineHeight: 13 }}>
              {st.level === 'over' ? t('Over budget') : `${formatMoney(st.leftPerDay, currency)}/d`}
            </ThemedText>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Last 7 days vs the previous 7. */
export function WeeklyCard({ d }: { d: Dashboard }) {
  const { current, previous, currentCount } = d.week;
  const pct = previous > 0 ? ((current - previous) / previous) * 100 : null;
  const max = Math.max(current, previous, 1);
  const p = useChartPalette();
  const grow = useAnimatedNumber(1); // the two bars slide in
  return (
    <Card>
      <SectionTitle>{t('Weekly recap')}</SectionTitle>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three }}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="small" themeColor="textSecondary">{t('Last 7 days')} · {currentCount} {t('receipts')}</ThemedText>
          <ThemedText style={{ fontSize: 24, lineHeight: 30, fontWeight: '700' }}>{formatMoney(current, d.currency)}</ThemedText>
          <Delta pct={pct} label={pct === null ? `${t('previous 7 days')}: ${formatMoney(previous, d.currency)}` : t('vs previous week')} />
        </View>
        <View style={{ gap: 6, width: 120 }}>
          <View style={[s.hbar, { width: `${Math.max(4, (current / max) * 100 * grow)}%`, backgroundColor: p.primary }]} />
          <View style={[s.hbar, { width: `${Math.max(4, (previous / max) * 100 * grow)}%`, backgroundColor: p.track }]} />
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 13 }}>
            {t('previous 7 days')}: {formatMoney(previous, d.currency)}
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  budgetLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.one },
  hbar: { height: 10, borderRadius: 5 },
});
