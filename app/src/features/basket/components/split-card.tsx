// "Split your shopping" hero: the best two-store plan and what it saves.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

import type { QuoteItem } from '../api';
import type { SplitPlan } from '../optimise';

function Column({ title, items, currency }: { title: string; items: QuoteItem[]; currency: string }) {
  const sum = items.reduce((s, i) => s + i.line_total, 0);
  return (
    <View style={styles.col}>
      <ThemedText type="smallBold" style={{ color: '#fff' }} numberOfLines={1}>{title}</ThemedText>
      {items.map((i) => (
        <View key={i.item_id} style={styles.line}>
          <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.9)', flex: 1 }} numberOfLines={1}>{i.name}{i.qty !== 1 ? ` × ${i.qty}` : ''}</ThemedText>
          <ThemedText type="small" style={{ color: '#fff' }}>{formatMoney(i.line_total, null)}</ThemedText>
        </View>
      ))}
      <View style={[styles.line, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.4)', paddingTop: 4 }]}>
        <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.8)', flex: 1 }}>{t('Total')}</ThemedText>
        <ThemedText type="smallBold" style={{ color: '#fff' }}>{formatMoney(sum, currency)}</ThemedText>
      </View>
    </View>
  );
}

export function SplitCard({ plan, currency }: { plan: SplitPlan; currency: string }) {
  const headline = t('Buy %na% items at %a% and %nb% at %b%', { na: plan.aItems.length, a: plan.a.store_name, nb: plan.bItems.length, b: plan.b.store_name });
  const parts: string[] = [];
  if (plan.saving >= 0.5) parts.push(t('save %x% vs %store%', { x: formatMoney(plan.saving, currency), store: plan.single.store_name }));
  if (plan.extraItems > 0) parts.push(t('and get %n% more items', { n: plan.extraItems }));
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}><Ionicons name="git-branch-outline" size={18} color="#fff" /></View>
        <ThemedText type="smallBold" style={{ color: 'rgba(255,255,255,0.85)', flex: 1 }}>{t('Split your shopping')}</ThemedText>
      </View>
      <ThemedText style={{ color: '#fff', fontSize: 18, lineHeight: 24, fontWeight: '700' }}>{headline}</ThemedText>
      {parts.length ? (
        <View style={styles.savePill}>
          <Ionicons name="trending-down" size={16} color="#fff" />
          <ThemedText type="smallBold" style={{ color: '#fff' }}>{parts.join(' · ')}</ThemedText>
        </View>
      ) : null}
      <View style={styles.cols}>
        <Column title={plan.a.store_name} items={plan.aItems} currency={currency} />
        <Column title={plan.b.store_name} items={plan.bItems} currency={currency} />
      </View>
      <View style={styles.total}>
        <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.85)', flex: 1 }}>
          {t('Split total')} · {t('%found% of %total% items', { found: plan.found, total: plan.single.items_total })}
        </ThemedText>
        <ThemedText style={{ color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '800' }}>{formatMoney(plan.total, currency)}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Brand.primary, borderRadius: 20, padding: Spacing.three, gap: Spacing.two },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  icon: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  savePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: Brand.success, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  cols: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  col: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 12, padding: Spacing.two, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  total: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, marginTop: Spacing.one },
});
