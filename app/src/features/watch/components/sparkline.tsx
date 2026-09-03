// Tiny 8-week price line for a watch row. Colour follows the movement tone.
import Svg, { Circle, Polyline } from 'react-native-svg';

export function Sparkline({ points, color, width = 64, height = 26 }: { points: number[]; color: string; width?: number; height?: number }) {
  if (points.length < 2) return <Svg width={width} height={height} />;
  const min = Math.min(...points); const max = Math.max(...points);
  const span = max - min < 1e-6 ? 1 : max - min;
  const pad = 3;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (width - pad * 2));
  const ys = points.map((p) => pad + (1 - (p - min) / span) * (height - pad * 2));
  const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3} fill={color} />
    </Svg>
  );
}
