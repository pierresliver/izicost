// Home card: "Maputo got 4% pricier this month" — the community price index per city. Hidden until data exists.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { monthShort } from '@/features/reports/dates';
import { Card } from '@/features/reports/ui';
import { t } from '@/lib/i18n';

import { cityPriceIndex, type CityIndexPoint } from '../api';
import '../i18n';

/** Latest month per city, biggest movers first. */
export function latestByCity(points: CityIndexPoint[]): CityIndexPoint[] {
  const m = new Map<string, CityIndexPoint>();
  for (const p of points) {
    const k = `${p.city}|${p.currency}`;
    const cur = m.get(k);
    if (!cur || p.month > cur.month) m.set(k, p);
  }
  return [...m.values()].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
}

export function CityIndexTeaser({ onPress }: { onPress: () => void }) {
  const [rows, setRows] = useState<CityIndexPoint[]>([]);
  useFocusEffect(useCallback(() => { cityPriceIndex(6).then((pts) => setRows(latestByCity(pts))).catch(() => {}); }, []));
  if (!rows.length) return null;
  const top = rows.slice(0, 3);
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <Ionicons name="analytics" size={26} color={Brand.primary} />
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="smallBold">{t('Price index by city')}</ThemedText>
          {top.map((r) => {
            const up = r.change_pct > 0;
            const color = Math.abs(r.change_pct) < 0.5 ? undefined : up ? Brand.danger : Brand.success;
            return (
              <ThemedText key={`${r.city}|${r.currency}`} type="small" themeColor="textSecondary">
                <ThemedText type="small" style={{ fontWeight: '700', color }}>{r.city} {up ? '▲' : r.change_pct < 0 ? '▼' : '='} {Math.abs(r.change_pct).toLocaleString()}%</ThemedText>
                {' '}{t('in %month%', { month: monthShort(r.month.slice(0, 7)) })} · {t('%n% products', { n: r.products })}
              </ThemedText>
            );
          })}
        </View>
        <Ionicons name="chevron-forward" size={16} color="#8A8F98" />
      </View>
    </Card>
  );
}
