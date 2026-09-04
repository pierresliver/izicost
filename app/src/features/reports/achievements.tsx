// Small badges that reward scanning: receipts scanned, weeks in a row, stores explored. Computed from the
// user's own receipts; each badge shows progress to the next level.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

import { fetchReceipts, type ReceiptLite } from './api';
import { ProgressRing } from './charts';
import { iso } from './dates';
import './i18n';
import { Card, SectionTitle } from './ui';

type Badge = { key: string; icon: keyof typeof Ionicons.glyphMap; value: number; label: string; next: number | null; color: string };

const TIERS = [1, 10, 25, 50, 100, 250, 500];
const nextTier = (n: number) => TIERS.find((x) => x > n) ?? null;

/** Monday of the week that contains the given local date, as 'YYYY-MM-DD' (all local time, no UTC shifts). */
function isoWeek(d: string): string {
  const date = new Date(`${d}T00:00:00`);
  const day = (date.getDay() + 6) % 7;            // Monday = 0
  date.setDate(date.getDate() - day);
  return iso(date);
}

/** Consecutive weeks with at least one receipt, counting back from this week (or last week, to be kind). */
export function weekStreak(rows: ReceiptLite[], today = new Date()): number {
  const weeks = new Set(rows.map((r) => r.purchased_on).filter((x): x is string => !!x).map(isoWeek));
  const cur = new Date(today); cur.setHours(0, 0, 0, 0);
  let start = isoWeek(iso(cur));
  if (!weeks.has(start)) { cur.setDate(cur.getDate() - 7); start = isoWeek(iso(cur)); }
  let n = 0;
  const d = new Date(`${start}T00:00:00`);
  while (weeks.has(iso(d))) { n++; d.setDate(d.getDate() - 7); }
  return n;
}

export function computeBadges(rows: ReceiptLite[]): Badge[] {
  const receipts = rows.length;
  const streak = weekStreak(rows);
  const stores = new Set(rows.map((r) => r.store_name).filter(Boolean)).size;
  return [
    { key: 'receipts', icon: 'receipt', value: receipts, label: t('receipts scanned'), next: nextTier(receipts), color: Brand.primary },
    { key: 'streak', icon: 'flame', value: streak, label: streak === 1 ? t('week in a row') : t('weeks in a row'), next: nextTier(streak), color: '#B5542F' },
    { key: 'stores', icon: 'storefront', value: stores, label: t('stores explored'), next: nextTier(stores), color: '#2F6DB5' },
  ];
}

export function AchievementsCard() {
  const theme = useTheme();
  const [badges, setBadges] = useState<Badge[] | null>(null);
  useFocusEffect(useCallback(() => {
    fetchReceipts(undefined, undefined, { onlyMe: true }).then((rows) => setBadges(computeBadges(rows))).catch(() => setBadges([]));
  }, []));
  if (!badges || !badges.length) return null;
  return (
    <Card>
      <SectionTitle>{t('Your badges')}</SectionTitle>
      <View style={styles.row}>
        {badges.map((b) => {
          const prev = [...TIERS].reverse().find((x) => x <= b.value) ?? 0;
          const ratio = b.next ? (b.value - prev) / (b.next - prev) : 1;
          return (
            <View key={b.key} style={styles.badge}>
              <ProgressRing ratio={Math.max(0.04, ratio)} size={72} thickness={7} color={b.color}>
                <Ionicons name={b.icon} size={16} color={b.color} />
                <ThemedText type="smallBold" style={{ fontSize: 15, lineHeight: 18 }}>{b.value}</ThemedText>
              </ProgressRing>
              <ThemedText type="small" style={{ textAlign: 'center', fontSize: 12, lineHeight: 15 }}>{b.label}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', fontSize: 11, lineHeight: 13, color: theme.textSecondary }}>
                {b.next ? t('next: %n%', { n: b.next }) : t('top level!')}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', gap: Spacing.two },
  badge: { alignItems: 'center', gap: 4, width: 100 },
});
