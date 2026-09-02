// The money card: one store's quote for the whole basket, ranked.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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

export function StoreQuoteCard({ quote, rank, currency, saving, nextStore }: {
  quote: RankedQuote; rank: number | null; currency: string; saving?: number | null; nextStore?: string | null;
}) {
  const theme = useTheme();
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
          <View style={{ flex: 1, gap: 1 }}>
            <ThemedText style={{ fontSize: 17, lineHeight: 22, fontWeight: '700' }} numberOfLines={2}>{quote.store_name}</ThemedText>
            {place ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{place}</ThemedText> : null}
            {quote.branch_address && quote.branch_address !== quote.city ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ fontSize: 12 }}>{quote.branch_address}</ThemedText>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <BigPrice value={quote.basket_total} currency={currency} size={best ? 28 : 22} color={best ? Brand.primary : undefined} />
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
            {quote.items.map((i) => (
              <View key={i.item_id} style={styles.line}>
                <ThemedText type="small" style={{ flex: 1 }} numberOfLines={1}>{i.name}{i.qty !== 1 ? ` × ${i.qty}` : ''}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>{t('seen %when%', { when: freshnessText(daysAgo(i.observed_on)) })}</ThemedText>
                <ThemedText type="smallBold" style={{ minWidth: 80, textAlign: 'right' }}>{formatMoney(i.line_total, currency)}</ThemedText>
              </View>
            ))}
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
