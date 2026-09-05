// The money card: one store's quote for the whole basket, ranked.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { BigPrice } from '@/features/prices/components/price-card';
import { freshnessText } from '@/features/prices/components/freshness-badge';
import { daysAgo } from '@/features/prices/format';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

import type { RankedQuote } from '../optimise';

/** "Why this price?": which catalogue product (and brand) the line was matched to, and how fresh the price is. */
function explainLine(i: RankedQuote['items'][number], currency: string, router: ReturnType<typeof useRouter>) {
  const matched = i.product_name && i.product_name.toLowerCase() !== i.name.toLowerCase() ? t('Matched to: %product%', { product: i.product_name }) : t('Matched to the product you named');
  const brand = i.brand ? `\n${t('Brand: %brand%', { brand: i.brand })}` : '';
  const facts = `\n${t('Unit price %price% · seen %when% · %n% reports', { price: formatMoney(i.price, currency), when: freshnessText(daysAgo(i.observed_on)), n: i.report_count })}`;
  Alert.alert(i.name, `${matched}${brand}${facts}`, [
    { text: t('Close'), style: 'cancel' },
    ...(i.product_key ? [{ text: t('Open product'), onPress: () => router.push({ pathname: '/product/[key]', params: { key: i.product_key! } }) }] : []),
  ]);
}

export function Pill({ text, tone }: { text: string; tone: 'success' | 'warning' | 'muted' }) {
  const theme = useTheme();
  const bg = tone === 'success' ? 'rgba(30,158,90,0.16)' : tone === 'warning' ? 'rgba(224,161,0,0.18)' : theme.backgroundSelected;
  const fg = tone === 'success' ? Brand.success : tone === 'warning' ? '#B57F00' : theme.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <ThemedText type="smallBold" style={{ color: fg, fontSize: 12, lineHeight: 16 }}>{text}</ThemedText>
    </View>
  );
}

export function StoreQuoteCard({ quote, rank, currency, saving, nextStore, estimate, levelPct }: {
  quote: RankedQuote; rank: number | null; currency: string; saving?: number | null; nextStore?: string | null;
  /** Whole-basket estimate (missing items at the typical price), shown under the real total when items are missing. */
  estimate?: { total: number; filled: number } | null;
  /** Average % above the cheapest available price for the items this store has (0 = cheapest on everything). */
  levelPct?: number | null;
}) {
  const theme = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const best = rank === 1;
  const full = quote.items_found === quote.items_total;
  const place = [quote.city, quote.distance_km !== null ? t('%km% km away', { km: quote.distance_km < 10 ? quote.distance_km.toFixed(1) : Math.round(quote.distance_km) }) : null]
    .filter(Boolean).join(' · ');
  const badgeBg = rank === 1 ? Brand.primary : rank === 2 ? '#8E8E93' : rank === 3 ? '#B07A3A' : theme.backgroundSelected;
  const badgeFg = rank !== null && rank <= 3 ? '#fff' : theme.textSecondary;

  return (
    <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <ThemedView type="backgroundElement" style={[styles.card, best && { borderWidth: 1.5, borderColor: Brand.primary }]}>
        <View style={styles.top}>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            {rank !== null ? <ThemedText type="smallBold" style={{ color: badgeFg, fontSize: 13 }}>{rank}</ThemedText>
              : <Ionicons name="remove" size={14} color={badgeFg} />}
          </View>
          <Pressable onPress={() => router.push({ pathname: '/store/[id]', params: { id: quote.store_id } } as never)} style={{ flex: 1, gap: 1 }} accessibilityRole="button">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ThemedText style={{ fontSize: 17, lineHeight: 22, fontWeight: '700', flexShrink: 1 }} numberOfLines={2}>{quote.store_name}</ThemedText>
              <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
            </View>
            {place ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{place}</ThemedText> : null}
            {quote.branch_address && quote.branch_address !== quote.city ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ fontSize: 12 }}>{quote.branch_address}</ThemedText>
            ) : null}
          </Pressable>
          <View style={{ alignItems: 'flex-end' }}>
            <BigPrice value={quote.basket_total} currency={currency} size={best ? 28 : 22} color={best ? Brand.primary : undefined} />
            {estimate && estimate.filled > 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
                {t('≈ %total% for all items', { total: formatMoney(estimate.total, currency) })}
              </ThemedText>
            ) : null}
          </View>
        </View>
        <View style={styles.bottom}>
          <Pill
            tone={full ? 'muted' : 'warning'}
            text={full ? t('all items') : `${t('%found% of %total% items', { found: quote.items_found, total: quote.items_total })} · ${t('partial')}`}
          />
          {best && saving ? <Pill tone="success" text={`${t('you save %x%', { x: formatMoney(saving, currency) })}${nextStore ? ` ${t('vs %store%', { store: nextStore })}` : ''}`} /> : null}
          <View style={{ flex: 1 }} />
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} />
        </View>
        {open ? (
          <View style={[styles.lines, { borderTopColor: theme.backgroundSelected }]}>
            {levelPct !== null && levelPct !== undefined ? (
              <ThemedText type="small" themeColor="textSecondary" style={{ paddingBottom: 4 }}>
                {levelPct <= 0 ? t('Cheapest available price on everything it has.') : t('On average %pct%% above the cheapest available price for these items.', { pct: levelPct.toLocaleString(undefined, { maximumFractionDigits: 1 }) })}
              </ThemedText>
            ) : null}
            {quote.items.map((i) => (
              <Pressable key={i.item_id} onPress={() => explainLine(i, currency, router)} style={({ pressed }) => [styles.line, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityHint={t('Why this price?')}>
                <ThemedText type="small" style={{ flex: 1 }} numberOfLines={1}>
                  {i.name}{i.qty !== 1 ? ` × ${i.qty}` : ''}
                  {i.brand && !i.name.toLowerCase().includes(i.brand.toLowerCase()) ? <ThemedText type="small" themeColor="textSecondary"> · {i.brand}</ThemedText> : null}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>{t('seen %when%', { when: freshnessText(daysAgo(i.observed_on)) })}</ThemedText>
                <ThemedText type="smallBold" style={{ minWidth: 80, textAlign: 'right' }}>{formatMoney(i.line_total, currency)}</ThemedText>
                <Ionicons name="information-circle-outline" size={14} color={theme.textSecondary} />
              </Pressable>
            ))}
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, textAlign: 'center', paddingTop: 4 }}>{t('Tap a line to see which product was matched')}</ThemedText>
          </View>
        ) : null}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: Spacing.three, gap: Spacing.two },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  lines: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, gap: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
