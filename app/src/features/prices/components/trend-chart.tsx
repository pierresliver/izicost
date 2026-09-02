// 90-day price trend: weekly median (solid) and weekly minimum (dashed), drawn with react-native-svg.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/lib/i18n';

import type { TrendPoint } from '../api';

const H = 150;
const PAD = { top: 12, right: 12, bottom: 22, left: 44 };

export function TrendChart({ points, currency }: { points: TrendPoint[]; currency: string }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const body = points.length < 2 || width === 0 ? null : (() => {
    const xs = points.map((p) => new Date(`${p.week_start}T00:00:00`).getTime());
    const ys = points.flatMap((p) => [p.min_price, p.median_price]);
    const x0 = Math.min(...xs); const x1 = Math.max(...xs);
    let y0 = Math.min(...ys); let y1 = Math.max(...ys);
    if (y1 - y0 < 1e-6) { y0 -= 1; y1 += 1; }
    const pad = (y1 - y0) * 0.1; y0 -= pad; y1 += pad;
    const iw = width - PAD.left - PAD.right; const ih = H - PAD.top - PAD.bottom;
    const X = (x: number) => PAD.left + ((x - x0) / Math.max(1, x1 - x0)) * iw;
    const Y = (y: number) => PAD.top + (1 - (y - y0) / (y1 - y0)) * ih;
    const path = (get: (p: TrendPoint) => number) =>
      points.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(xs[i]).toFixed(1)},${Y(get(p)).toFixed(1)}`).join(' ');
    const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: v >= 100 ? 0 : 1 });
    const gridVals = [y0 + pad, (y0 + y1) / 2, y1 - pad];
    const label = (ms: number) => { const d = new Date(ms); return `${d.getDate()}/${d.getMonth() + 1}`; };
    const last = points[points.length - 1];
    return (
      <Svg width={width} height={H}>
        {gridVals.map((g, i) => (
          <Line key={i} x1={PAD.left} x2={width - PAD.right} y1={Y(g)} y2={Y(g)} stroke={theme.backgroundSelected} strokeWidth={1} />
        ))}
        {gridVals.map((g, i) => (
          <SvgText key={`t${i}`} x={PAD.left - 6} y={Y(g) + 4} fontSize={10} fill={theme.textSecondary} textAnchor="end">{fmt(g)}</SvgText>
        ))}
        <Path d={path((p) => p.min_price)} stroke={Brand.success} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
        <Path d={path((p) => p.median_price)} stroke={Brand.primary} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        {points.map((p, i) => <Circle key={i} cx={X(xs[i])} cy={Y(p.median_price)} r={3} fill={Brand.primary} />)}
        <Circle cx={X(xs[xs.length - 1])} cy={Y(last.median_price)} r={5} fill={theme.background} stroke={Brand.primary} strokeWidth={2} />
        <SvgText x={PAD.left} y={H - 6} fontSize={10} fill={theme.textSecondary}>{label(x0)}</SvgText>
        <SvgText x={width - PAD.right} y={H - 6} fontSize={10} fill={theme.textSecondary} textAnchor="end">{label(x1)}</SvgText>
      </Svg>
    );
  })();

  return (
    <ThemedView type="backgroundElement" style={styles.card} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width) - Spacing.three * 2)}>
      <View style={styles.legend}>
        <ThemedText type="smallBold">{t('Last 90 days')}</ThemedText>
        <View style={{ flex: 1 }} />
        <View style={[styles.swatch, { backgroundColor: Brand.primary }]} /><ThemedText type="small" themeColor="textSecondary">{t('median')}</ThemedText>
        <View style={[styles.swatch, { backgroundColor: Brand.success, marginLeft: 8 }]} /><ThemedText type="small" themeColor="textSecondary">{t('min')}</ThemedText>
      </View>
      {body ?? (
        <ThemedText type="small" themeColor="textSecondary" style={{ paddingVertical: Spacing.four, textAlign: 'center' }}>
          {t('Not enough data for a trend yet. Prices in %cur% appear here once two or more weeks have reports.', { cur: currency })}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 4, borderRadius: 2 },
});
