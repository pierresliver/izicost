// Small, dependency-free charts on react-native-svg: bar chart, ring (donut), progress ring, sparkline,
// horizontal % bars and a multi-line index chart. Bars and rings animate in (PS: the dashboard should move).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';

import { useChartPalette } from './palette';

/** Measures the available width once so charts can be fluid. */
function useWidth(fallback = 300): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(fallback);
  return [w, (e) => { const x = Math.round(e.nativeEvent.layout.width); if (x > 0 && x !== w) setW(x); }];
}

/** 0 → target with an ease-out, re-run whenever the target changes. Drives SVG props via state. */
export function useAnimatedNumber(target: number, duration = 750): number {
  const anim = useMemo(() => new Animated.Value(0), []);
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value }) => setV(value));
    Animated.timing(anim, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [anim, target, duration]);
  return v;
}

export type Bar = { key: string; label: string; value: number; highlight?: boolean };

type BarChartProps = {
  data: Bar[];
  height?: number;
  color?: string;
  onPressBar?: (bar: Bar) => void;
  formatValue?: (v: number) => string;
};

/** Vertical bars with rounded tops, a baseline, labels below and the value above the highlighted bar. Bars grow in. */
export function BarChart({ data, height = 150, color, onPressBar, formatValue }: BarChartProps) {
  const p = useChartPalette();
  const [width, onLayout] = useWidth();
  const grow = useAnimatedNumber(1);
  const fill = color ?? p.primary;
  const max = Math.max(1, ...data.map((d) => d.value));
  const top = 22, bottom = 22;
  const plotH = height - top - bottom;
  const n = Math.max(1, data.length);
  const slot = width / n;
  const barW = Math.min(44, slot * 0.62);
  const fmt = formatValue ?? ((v: number) => Math.round(v).toLocaleString());

  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      <Svg width={width} height={height}>
        <Rect x={0} y={top + plotH} width={width} height={1} fill={p.grid} />
        {data.map((d, i) => {
          const full = d.value > 0 ? Math.max(3, (d.value / max) * plotH) : 0;
          const h = full * grow;
          const x = i * slot + (slot - barW) / 2;
          const y = top + plotH - h;
          const r = Math.min(4, barW / 2, h);
          const path = h > 0
            ? `M${x},${y + r} a${r},${r} 0 0 1 ${r},-${r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} h-${barW} z`
            : '';
          const dim = data.some((b) => b.highlight) && !d.highlight;
          return (
            <G key={d.key} onPress={onPressBar ? () => onPressBar(d) : undefined}>
              <Rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
              {h > 0 ? <Path d={path} fill={fill} opacity={dim ? 0.45 : 1} /> : null}
              {d.highlight && d.value > 0 && grow > 0.95 ? (
                <SvgText x={x + barW / 2} y={y - 6} fontSize={11} fontWeight="700" fill={p.label} textAnchor="middle">{fmt(d.value)}</SvgText>
              ) : null}
              <SvgText x={x + barW / 2} y={height - 6} fontSize={11} fill={p.label} textAnchor="middle" fontWeight={d.highlight ? '700' : '400'}>
                {d.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

export type Segment = { key: string; value: number; color: string };

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const s = polar(cx, cy, r, a0), e = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${s.x},${s.y} A${r},${r} 0 ${large} 1 ${e.x},${e.y}`;
}

type RingChartProps = { segments: Segment[]; size?: number; thickness?: number; children?: ReactNode; onPressSegment?: (s: Segment) => void };

/** Donut with a 2° gap between segments; `children` renders in the hole. Sweeps in clockwise. */
export function RingChart({ segments, size = 150, thickness = 20, children, onPressSegment }: RingChartProps) {
  const p = useChartPalette();
  const grow = useAnimatedNumber(1, 900);
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2, c = size / 2;
  let angle = 0;
  const gap = segments.length > 1 ? 2 : 0;
  const limit = 360 * grow;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke={p.track} strokeWidth={thickness} fill="none" />
        {total > 0 ? segments.map((s) => {
          const sweep = (Math.max(0, s.value) / total) * 360;
          const a0 = angle + gap / 2, a1 = Math.min(angle + sweep - gap / 2, limit);
          angle += sweep;
          if (a1 <= a0) return null;
          return (
            <Path key={s.key} d={arcPath(c, c, r, a0, Math.min(a1, a0 + 359.9))} stroke={s.color} strokeWidth={thickness}
              fill="none" strokeLinecap="butt" onPress={onPressSegment ? () => onPressSegment(s) : undefined} />
          );
        }) : null}
      </Svg>
      <View style={{ alignItems: 'center', paddingHorizontal: thickness + 6 }}>{children}</View>
    </View>
  );
}

type ProgressRingProps = { ratio: number; size?: number; thickness?: number; color?: string; children?: ReactNode };

/** One-value ring, clamped to 100%, animated to its value. Colour is chosen by the caller (green / warning / danger). */
export function ProgressRing({ ratio, size = 120, thickness = 12, color, children }: ProgressRingProps) {
  const p = useChartPalette();
  const r = (size - thickness) / 2, c = size / 2;
  const shown = useAnimatedNumber(Math.max(0, Math.min(1, ratio)), 900);
  const sweep = shown * 360;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke={p.track} strokeWidth={thickness} fill="none" />
        {sweep > 0.5 ? <Path d={arcPath(c, c, r, 0, Math.min(sweep, 359.9))} stroke={color ?? p.primary} strokeWidth={thickness} fill="none" strokeLinecap="round" /> : null}
      </Svg>
      <View style={{ alignItems: 'center', paddingHorizontal: thickness }}>{children}</View>
    </View>
  );
}

type SparklineProps = { values: number[]; width?: number; height?: number; color?: string };

/** A tiny line, 2px, no axes. Flat line when every value is the same. */
export function Sparkline({ values, width = 80, height = 28, color }: SparklineProps) {
  const p = useChartPalette();
  if (values.length < 2) return <View style={{ width, height }} />;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - 2 * pad);
    const y = pad + (1 - (v - min) / span) * (height - 2 * pad);
    return `${x},${y}`;
  }).join(' ');
  const last = values[values.length - 1];
  const lx = width - pad, ly = pad + (1 - (last - min) / span) * (height - 2 * pad);
  return (
    <Svg width={width} height={height}>
      <Polyline points={pts} fill="none" stroke={color ?? p.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={lx} cy={ly} r={3} fill={color ?? p.primary} />
    </Svg>
  );
}

export type HBar = { key: string; label: string; pct: number; sub?: string };

/** Horizontal ± bars: red grows right for increases, green grows left for decreases. Animated. */
export function HBarList({ data, onPress }: { data: HBar[]; onPress?: (b: HBar) => void }) {
  const p = useChartPalette();
  const grow = useAnimatedNumber(1);
  const max = Math.max(5, ...data.map((d) => Math.abs(d.pct)));
  return (
    <View style={{ gap: 6 }}>
      {data.map((d) => {
        const up = d.pct > 0;
        const w = (Math.abs(d.pct) / max) * 50 * grow; // half the track each side
        const color = Math.abs(d.pct) < 0.5 ? p.label : up ? Brand.danger : Brand.success;
        return (
          <View key={d.key} style={styles.hrow} onTouchEnd={onPress ? () => onPress(d) : undefined}>
            <View style={{ width: 96 }}>
              <ThemedText type="small" numberOfLines={1} style={{ fontWeight: '600' }}>{d.label}</ThemedText>
              {d.sub ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }}>{d.sub}</ThemedText> : null}
            </View>
            <View style={[styles.track, { backgroundColor: p.track }]}>
              <View style={[styles.mid, { backgroundColor: p.grid }]} />
              <View style={[styles.fill, { backgroundColor: color, left: up ? '50%' : `${50 - w}%`, width: `${w}%` }]} />
            </View>
            <ThemedText type="small" style={{ width: 52, textAlign: 'right', color, fontWeight: '700' }}>
              {up ? '+' : ''}{Math.round(d.pct * 10) / 10}%
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

export type IndexSeries = { key: string; label: string; color: string; points: { x: string; y: number }[] };

/** Several lines on one time axis (e.g. a price index per city, base 100). Animated draw-in. */
export function IndexChart({ series, height = 170, baseline = 100, formatX, formatY }: {
  series: IndexSeries[]; height?: number;
  /** Dashed reference line (100 for an index). null = plain price chart, range from the data only. */
  baseline?: number | null;
  formatX?: (x: string) => string; formatY?: (y: number) => string;
}) {
  const p = useChartPalette();
  const [width, onLayout] = useWidth();
  const grow = useAnimatedNumber(1, 900);
  const xs = Array.from(new Set(series.flatMap((s) => s.points.map((pt) => pt.x)))).sort();
  const ys = series.flatMap((s) => s.points.map((pt) => pt.y));
  if (!xs.length || !ys.length) return null;
  const PAD = { top: 12, right: 12, bottom: 22, left: 44 };
  const anchor = baseline === null ? [] : [baseline];
  let y0 = Math.min(...anchor, ...ys), y1 = Math.max(...anchor, ...ys);
  if (y1 - y0 < 1) { y0 -= 1; y1 += 1; }
  const padY = (y1 - y0) * 0.12; y0 -= padY; y1 += padY;
  const iw = width - PAD.left - PAD.right, ih = height - PAD.top - PAD.bottom;
  const X = (x: string) => PAD.left + (xs.length === 1 ? iw / 2 : (xs.indexOf(x) / (xs.length - 1)) * iw);
  const Y = (y: number) => PAD.top + (1 - (y - y0) / (y1 - y0)) * ih;
  const fmtX = formatX ?? ((x: string) => x);
  const fmtY = formatY ?? ((y: number) => String(Math.round(y)));
  const visibleCount = Math.max(1, Math.ceil(xs.length * grow));
  const grid = baseline === null ? [y0 + padY, (y0 + y1) / 2, y1 - padY] : [y0 + padY, baseline, y1 - padY];
  return (
    <View onLayout={onLayout} style={{ width: '100%', gap: Spacing.two }}>
      <Svg width={width} height={height}>
        {grid.map((g, i) => (
          <G key={i}>
            <Line x1={PAD.left} x2={width - PAD.right} y1={Y(g)} y2={Y(g)} stroke={g === baseline ? p.label : p.grid} strokeWidth={1} strokeDasharray={g === baseline ? '3 3' : undefined} />
            <SvgText x={PAD.left - 6} y={Y(g) + 4} fontSize={10} fill={p.label} textAnchor="end">{fmtY(g)}</SvgText>
          </G>
        ))}
        {series.map((s) => {
          const pts = s.points.filter((pt) => xs.indexOf(pt.x) < visibleCount).sort((a, b) => (a.x < b.x ? -1 : 1));
          if (!pts.length) return null;
          const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${X(pt.x).toFixed(1)},${Y(pt.y).toFixed(1)}`).join(' ');
          const last = pts[pts.length - 1];
          return (
            <G key={s.key}>
              <Path d={d} stroke={s.color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              <Circle cx={X(last.x)} cy={Y(last.y)} r={4} fill={s.color} />
            </G>
          );
        })}
        {xs.map((x, i) => (i === 0 || i === xs.length - 1 || xs.length <= 6 ? (
          <SvgText key={x} x={X(x)} y={height - 6} fontSize={10} fill={p.label} textAnchor={i === 0 ? 'start' : i === xs.length - 1 ? 'end' : 'middle'}>{fmtX(x)}</SvgText>
        ) : null))}
      </Svg>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
        {series.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <LegendDot color={s.color} />
            <ThemedText type="small" themeColor="textSecondary">{s.label}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Legend row: a colour dot + label + value, used under ring charts. */
export function LegendDot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

const styles = StyleSheet.create({
  hrow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  track: { flex: 1, height: 14, borderRadius: 7, overflow: 'hidden', position: 'relative' },
  mid: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1 },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 7 },
});
