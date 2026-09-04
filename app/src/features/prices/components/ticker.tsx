// "Live" ticker for the Prices tab: this week's biggest movers per city and today's activity, scrolling
// sideways like a stock ticker. Tap a mover to open the product.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';
import { formatMoney } from '@/lib/receipts';

import { communityTicker, type TickerRow } from '../api';
import '../i18n';

export function Ticker() {
  const theme = useTheme();
  const router = useRouter();
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [contentW, setContentW] = useState(0);
  const [boxW, setBoxW] = useState(0);
  const x = useMemo(() => new Animated.Value(0), []);

  useFocusEffect(useCallback(() => { communityTicker(12).then(setRows).catch(() => {}); }, []));

  useEffect(() => {
    if (!contentW || !boxW || contentW <= boxW) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: -contentW, duration: contentW * 22, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [contentW, boxW, x]);

  if (!rows.length) return null;
  const items = rows.map((r) => {
    if (r.kind === 'activity') return { key: `a-${r.city}`, text: t('%n% prices today · %city%', { n: r.n, city: r.city }), color: theme.textSecondary, icon: 'pulse' as const, product_key: null as string | null };
    const up = (r.change_pct ?? 0) > 0;
    return {
      key: `m-${r.city}-${r.product_key}`,
      text: `${r.display_name} ${up ? '▲' : '▼'}${Math.abs(Math.round(r.change_pct ?? 0))}% · ${formatMoney(r.price, r.currency)} · ${r.city}`,
      color: up ? Brand.danger : Brand.success, icon: (up ? 'trending-up' : 'trending-down') as 'trending-up' | 'trending-down', product_key: r.product_key,
    };
  });
  const strip = (suffix: string) => items.map((it) => (
    <Pressable key={`${it.key}-${suffix}`} onPress={it.product_key ? () => router.push({ pathname: '/product/[key]', params: { key: it.product_key! } }) : undefined} style={styles.item}>
      <Ionicons name={it.icon} size={13} color={it.color} />
      <ThemedText type="small" style={{ color: it.color, fontWeight: '700' }} numberOfLines={1}>{it.text}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">  ·  </ThemedText>
    </Pressable>
  ));

  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundElement }]} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      <View style={styles.live}><View style={styles.dot} /><ThemedText type="small" style={{ color: Brand.primary, fontWeight: '800', fontSize: 10 }}>{t('LIVE')}</ThemedText></View>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: x }] }}>
          <View style={{ flexDirection: 'row' }} onLayout={(e) => setContentW(e.nativeEvent.layout.width)}>{strip('a')}</View>
          <View style={{ flexDirection: 'row' }}>{strip('b')}</View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, height: 34, paddingLeft: 10, gap: 8, overflow: 'hidden' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.danger },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: Spacing.one },
});
