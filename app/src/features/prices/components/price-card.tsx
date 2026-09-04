// Cards used by the Prices tab (search results) and the product page (per-store rows).
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

import type { CommunityPrice, SearchRow } from '../api';
import { sizeLabel, splitMoney, unitPriceLabel } from '../format';
import { FreshnessBadge } from './freshness-badge';

/** Price with big whole part and small decimals + currency. */
export function BigPrice({ value, currency, size = 28, color }: { value: number; currency: string; size?: number; color?: string }) {
  const theme = useTheme();
  const { whole, cents } = splitMoney(value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <ThemedText style={{ fontSize: size, lineHeight: size * 1.15, fontWeight: '800', color: color ?? theme.text }}>{whole}</ThemedText>
      <ThemedText style={{ fontSize: size * 0.55, lineHeight: size * 1.15, fontWeight: '700', color: color ?? theme.text }}>{cents}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ marginLeft: 4 }}>{currency}</ThemedText>
    </View>
  );
}

/** Search result: product → cheapest store in scope. */
export function ProductResultCard({ row, onPress }: { row: SearchRow; onPress: () => void }) {
  const theme = useTheme();
  const size = sizeLabel(row.size_value, row.size_unit);
  const unit = unitPriceLabel(row.unit_price, row.size_unit, row.currency);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.rowTop}>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText type="smallBold" style={{ fontSize: 16 }} numberOfLines={2}>{row.display_name}</ThemedText>
            {size ? <ThemedText type="small" themeColor="textSecondary">{size}{unit ? ` · ${unit}` : ''}</ThemedText> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <BigPrice value={row.price} currency={row.currency} size={24} color={Brand.primary} />
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>{t('cheapest')}</ThemedText>
          </View>
        </View>
        <View style={styles.rowBottom}>
          <Ionicons name="storefront-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
            {row.store_name}{row.city ? ` · ${row.city}` : ''}{row.store_count > 1 ? ` · ${t('%n% stores', { n: row.store_count })}` : ''}
          </ThemedText>
          <FreshnessBadge observedOn={row.observed_on} reports={row.report_count} />
        </View>
      </ThemedView>
    </Pressable>
  );
}

/** One store's current price on the product page. */
export function StorePriceRow({ row, rank, best, onReport, onOpenStore }: { row: CommunityPrice; rank: number; best: boolean; onReport: () => void; onOpenStore?: () => void }) {
  const theme = useTheme();
  const unit = unitPriceLabel(row.unit_price, row.size_unit, row.currency);
  return (
    <ThemedView type="backgroundElement" style={[styles.card, best && { borderWidth: 1.5, borderColor: Brand.primary }]}>
      <View style={styles.rowTop}>
        <View style={[styles.rank, { backgroundColor: best ? Brand.primary : theme.backgroundSelected }]}>
          <ThemedText type="smallBold" style={{ color: best ? '#fff' : theme.textSecondary, fontSize: 12 }}>{rank}</ThemedText>
        </View>
        <Pressable onPress={onOpenStore} disabled={!onOpenStore} style={{ flex: 1, gap: 1 }} accessibilityRole={onOpenStore ? 'button' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ThemedText type="smallBold" style={{ fontSize: 15, flexShrink: 1 }} numberOfLines={1}>{row.store_name}</ThemedText>
            {onOpenStore ? <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} /> : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {[row.branch_address, row.city].filter(Boolean).join(' · ') || t('unknown')}
          </ThemedText>
        </Pressable>
        <View style={{ alignItems: 'flex-end' }}>
          <BigPrice value={row.price} currency={row.currency} size={22} color={best ? Brand.primary : undefined} />
          {unit ? <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>{unit}</ThemedText> : null}
        </View>
      </View>
      <View style={styles.rowBottom}>
        <FreshnessBadge observedOn={row.observed_on} reports={row.report_count} />
        {row.median_price !== null && row.report_count >= 3 && Math.abs(row.median_price - row.price) > 0.005 ? (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('median')} {row.median_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </ThemedText>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onReport} hitSlop={8} style={styles.flag}>
          <Ionicons name="flag-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>{t('Report')}</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rank: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
