// Budgets: an overall monthly limit and optional per-category limits, with progress against this month.
import '@/features/reports/i18n';

import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { loadDashboard, type Dashboard } from '@/features/reports/api';
import { budgetStatus, BudgetsUnavailable, listBudgets, setBudget, type Budget, type BudgetStatus } from '@/features/reports/budgets';
import { Card, ErrorText, Loading, SectionTitle, styles as ui, useLoader } from '@/features/reports/ui';
import { useTheme } from '@/hooks/use-theme';
import { t, useLang } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';
import { CATEGORIES } from '@/lib/types';

type State = { dash: Dashboard; budgets: Budget[]; unavailable: boolean };

async function load(): Promise<State> {
  const dash = await loadDashboard();
  try { return { dash, budgets: await listBudgets(), unavailable: false }; }
  catch (e) { if (e instanceof BudgetsUnavailable) return { dash, budgets: [], unavailable: true }; throw e; }
}

function BudgetField({ category, currency, initial, status, onSaved }: { category: string | null; currency: string; initial: number | null; status: BudgetStatus | null; onSaved: () => void }) {
  const theme = useTheme();
  const [text, setText] = useState(initial ? String(initial) : '');
  useEffect(() => { setText(initial ? String(initial) : ''); }, [initial]);
  const color = status?.level === 'over' ? Brand.danger : status?.level === 'warn' ? Brand.warning : Brand.primary;

  async function save() {
    const amount = Number(text.replace(',', '.'));
    if (text.trim() && !(amount >= 0)) return;
    if ((initial ?? 0) === (text.trim() ? amount : 0)) return;
    try { await setBudget(category, text.trim() ? amount : 0, currency); onSaved(); }
    catch (e) { Alert.alert(t('Could not save'), String((e as Error).message ?? e)); }
  }

  return (
    <View style={{ gap: 4, paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <ThemedText type="smallBold" style={{ flex: 1 }}>{category ? t(category) : t('Overall monthly budget')}</ThemedText>
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={save}
          onSubmitEditing={save}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={theme.textSecondary}
          style={[s.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}
        />
        <ThemedText type="small" themeColor="textSecondary" style={{ width: 38 }}>{currency}</ThemedText>
      </View>
      {status ? (
        <>
          <View style={[s.track, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[s.fill, { width: `${Math.min(100, Math.round(status.ratio * 100))}%`, backgroundColor: color }]} />
          </View>
          <ThemedText type="small" style={{ color, fontSize: 12, lineHeight: 16 }}>
            {t('Spent %spent% of %budget%', { spent: formatMoney(status.spent), budget: formatMoney(status.budget.amount) })} · {' '}
            {status.level === 'over' ? t('Over budget') : status.level === 'warn' ? t('Over 80%') : t('On track')}
            {status.left > 0 ? ` · ${formatMoney(status.leftPerDay)} ${t('per day for the rest of the month')}` : ''}
          </ThemedText>
        </>
      ) : null}
    </View>
  );
}

export default function BudgetsScreen() {
  useLang();
  const { data, error, reload } = useLoader(load, []);
  const statuses = data ? budgetStatus(data.budgets, data.dash.currency, data.dash.thisMonth.total, data.dash.byCategory) : [];
  const statusFor = (cat: string | null) => statuses.find((x) => x.budget.category === cat) ?? null;
  const amountFor = (cat: string | null) => data?.budgets.find((b) => b.category === cat && b.currency === data.dash.currency)?.amount ?? null;

  return (
    <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t('Budgets') }} />
      <ErrorText error={error} />
      {!data && !error ? <Loading /> : null}
      {data?.unavailable ? <ThemedText style={{ color: Brand.warning }}>{t('Budgets need the budgets table. Ask the developer to apply migration 002.')}</ThemedText> : null}
      {data && !data.unavailable ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">{t('Budgets are in %currency%, your most used currency.', { currency: data.dash.currency })} {t('Leave empty to remove')}.</ThemedText>
          <Card>
            <SectionTitle>{t('Overall monthly budget')}</SectionTitle>
            <BudgetField category={null} currency={data.dash.currency} initial={amountFor(null)} status={statusFor(null)} onSaved={reload} />
          </Card>
          <Card>
            <SectionTitle>{t('Per-category budgets')}</SectionTitle>
            {CATEGORIES.map((c) => (
              <BudgetField key={c} category={c} currency={data.dash.currency} initial={amountFor(c)} status={statusFor(c)} onSaved={reload} />
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  input: { width: 110, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, textAlign: 'right' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
