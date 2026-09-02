// Small shared building blocks for the reports screens (cards, rows, chips, deltas, loader hook).
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

import { LegendDot } from './charts';

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const body = <ThemedView type="backgroundElement" style={[styles.card, style]}>{children}</ThemedView>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>{body}</Pressable> : body;
}

export function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <ThemedText style={styles.sectionTitle}>{children}</ThemedText>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}><ThemedText type="small" style={{ color: Brand.primary, fontWeight: '700' }}>{action}</ThemedText></Pressable>
      ) : null}
    </View>
  );
}

type RowProps = { title: string; subtitle?: string; right?: string; rightSub?: string; color?: string; onPress?: () => void; children?: ReactNode };

/** A list row: optional colour dot, title/subtitle on the left, value on the right, chevron when tappable. */
export function Row({ title, subtitle, right, rightSub, color, onPress, children }: RowProps) {
  const theme = useTheme();
  const inner = (
    <View style={styles.row}>
      {color ? <LegendDot color={color} /> : null}
      <View style={{ flex: 1 }}>
        <ThemedText type="smallBold" numberOfLines={1}>{title}</ThemedText>
        {subtitle ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{subtitle}</ThemedText> : null}
        {children}
      </View>
      {right ? (
        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText type="smallBold">{right}</ThemedText>
          {rightSub ? <ThemedText type="small" themeColor="textSecondary">{rightSub}</ThemedText> : null}
        </View>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} /> : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{inner}</Pressable> : inner;
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: active ? Brand.primary : theme.backgroundSelected }]}>
      <ThemedText type="small" style={{ color: active ? '#fff' : theme.text, fontWeight: '700' }}>{label}</ThemedText>
    </Pressable>
  );
}

/** "▲ 12%" coloured: spending up = red, down = green. `label` follows the number. */
export function Delta({ pct, label, size = 14 }: { pct: number | null; label?: string; size?: number }) {
  if (pct === null) return label ? <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText> : null;
  const rounded = Math.round(pct);
  const color = rounded > 0 ? Brand.danger : rounded < 0 ? Brand.success : undefined;
  const icon: keyof typeof Ionicons.glyphMap = rounded > 0 ? 'arrow-up' : rounded < 0 ? 'arrow-down' : 'remove';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={size} color={color ?? '#8A8F98'} />
      <ThemedText type="small" style={{ color, fontWeight: '700', fontSize: size }}>{Math.abs(rounded)}%</ThemedText>
      {label ? <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText> : null}
    </View>
  );
}

export function Empty({ text }: { text?: string }) {
  return <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', paddingVertical: Spacing.four }}>{text ?? t('Nothing here yet.')}</ThemedText>;
}

export function Loading() {
  return <View style={{ paddingVertical: Spacing.five }}><ActivityIndicator color={Brand.primary} /></View>;
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <ThemedText style={{ color: Brand.danger }}>{error}</ThemedText> : null;
}

/** Loads on focus, exposes pull-to-refresh state. */
export function useLoader<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    try { setData(await fn()); setError(null); }
    catch (e) { setError(String((e as Error).message ?? e)); }
  }, deps);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const refresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);
  return { data, error, refreshing, refresh, reload: load };
}

export const styles = StyleSheet.create({
  screen: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  chips: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  big: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  primaryBtn: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.primary, borderRadius: 14, paddingVertical: 14 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
