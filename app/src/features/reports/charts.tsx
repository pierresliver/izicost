// Small, dependency-free charts on react-native-svg: bar chart, ring (donut), progress ring, sparkline.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { useChartPalette } from './palette';

/** Measures the available width once so charts can be fluid. */
function useWidth(fallback = 300): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(fallback);
  return [w, (e) => { const x = Math.round(e.nativeEvent.layout.width); if (x > 0 && x !== w) setW(x); }];
}

export type Bar = { key: string; label: string; value: number; highlight?: boolean };

type BarChartProps = {
  data: Bar[];
  height?: number;
  color?: string;
  onPressBar?: (bar: Bar) => void;
  formatValue?: (v: number) => string;
};

/** Vertical bars with rounded tops, a baseline, labels below and the value above the highlighted bar. */
export function BarChart({ data, height = 150, color, onPressBar, formatValue }: BarChartProps) {
  const p = useChartPalette();
  const [width, onLayout] = useWidth();
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
          const h = d.value > 0 ? Math.max(3, (d.value / max) * plotH) : 0;
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
              {d.highlight && d.value > 0 ? (
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

/** Donut with a 2° gap between segments; `children` renders in the hole. */
export function RingChart({ segments, size = 150, thickness = 20, children, onPressSegment }: RingChartProps) {
  const p = useChartPalette();
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2, c = size / 2;
  let angle = 0;
  const gap = segments.length > 1 ? 2 : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke={p.track} strokeWidth={thickness} fill="none" />
        {total > 0 ? segments.map((s) => {
          const sweep = (Math.max(0, s.value) / total) * 360;
          const a0 = angle + gap / 2, a1 = angle + sweep - gap / 2;
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

/** One-value ring, clamped to 100%. Colour is chosen by the caller (green / warning / danger). */
export function ProgressRing({ ratio, size = 120, thickness = 12, color, children }: ProgressRingProps) {
  const p = useChartPalette();
  const r = (size - thickness) / 2, c = size / 2;
  const sweep = Math.max(0, Math.min(1, ratio)) * 360;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke={p.track} strokeWidth={thickness} fill="none" />
        {sweep > 0 ? <Path d={arcPath(c, c, r, 0, Math.min(sweep, 359.9))} stroke={color ?? p.primary} strokeWidth={thickness} fill="none" strokeLinecap="round" /> : null}
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

/** Legend row: a colour dot + label + value, used under ring charts. */
export function LegendDot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}
