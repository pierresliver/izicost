// Subtle pill showing how old a price is: green ≤ 7 days, amber ≤ 30, grey older.
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

import { daysAgo, freshness } from '../format';

export function freshnessText(days: number): string {
  if (days === 0) return t('today');
  if (days === 1) return t('yesterday');
  if (days > 365) return t('long ago');
  return t('%n% days ago', { n: days });
}

export function FreshnessBadge({ observedOn, reports }: { observedOn: string; reports?: number }) {
  const theme = useTheme();
  const days = daysAgo(observedOn);
  const f = freshness(days);
  const bg = f === 'fresh' ? 'rgba(30,158,90,0.16)' : f === 'recent' ? 'rgba(224,161,0,0.18)' : theme.backgroundSelected;
  const fg = f === 'fresh' ? Brand.success : f === 'recent' ? '#B57F00' : theme.textSecondary;
  const label = reports !== undefined
    ? `${freshnessText(days)} · ${reports} ${reports === 1 ? t('report') : t('reports')}`
    : freshnessText(days);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <ThemedText type="small" style={{ color: fg, fontSize: 12, lineHeight: 16 }}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
