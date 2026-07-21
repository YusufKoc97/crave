import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { triggersAccentAlpha } from '../triggersTheme';

/**
 * Small inline visualisations shown on category insight cards
 * (design brief: minibar for trigger insights, sparkline for
 * technique/trend insights).
 *
 * These are decorative — they're not driven by real data because
 * the aggregate we'd need (per-day / per-week series) isn't
 * currently in the trigger-map payload. They give the card the
 * right visual weight and won't lie about numbers because they
 * carry no scale labels. When the Edge Function grows a series
 * field, swap the constants for real data — the geometry stays.
 */

type Props = {
  kind: 'minibar' | 'sparkline' | 'none';
  color: string;
  width?: number;
  height?: number;
};

// A stylised "growing intensity" 7-bar strip. Values are relative
// heights, not units.
const MINIBAR_HEIGHTS = [0.35, 0.6, 0.5, 0.85, 0.7, 0.95, 0.55];

// A gently rising 7-point sparkline (0..1 domain). Suggests
// "gaining ground" without claiming specifics.
const SPARKLINE_POINTS = [0.3, 0.45, 0.4, 0.6, 0.55, 0.75, 0.85];

export function MiniViz({ kind, color, width = 68, height = 34 }: Props) {
  if (kind === 'none') return null;
  return (
    <View
      style={{ width, height }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height}>
        {kind === 'minibar' ? (
          <MiniBars color={color} width={width} height={height} />
        ) : (
          <Sparkline color={color} width={width} height={height} />
        )}
      </Svg>
    </View>
  );
}

function MiniBars({
  color,
  width,
  height,
}: {
  color: string;
  width: number;
  height: number;
}) {
  const count = MINIBAR_HEIGHTS.length;
  const gap = 3;
  const barW = (width - gap * (count - 1)) / count;
  const baseline = height - 1;
  return (
    <>
      {MINIBAR_HEIGHTS.map((h, i) => {
        const x = i * (barW + gap);
        const barH = Math.max(2, h * (height - 4));
        const y = baseline - barH;
        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx={1.5}
            ry={1.5}
            fill={color}
            fillOpacity={0.55 + h * 0.45}
          />
        );
      })}
    </>
  );
}

function Sparkline({
  color,
  width,
  height,
}: {
  color: string;
  width: number;
  height: number;
}) {
  const count = SPARKLINE_POINTS.length;
  const stepX = width / (count - 1);
  const pts = SPARKLINE_POINTS.map((v, i) => ({
    x: i * stepX,
    y: height - 2 - v * (height - 6),
  }));
  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  // Filled band under the line for depth.
  const areaD = `${d} L ${(count - 1) * stepX} ${height} L 0 ${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <>
      <Path d={areaD} fill={triggersAccentAlpha(0.14)} />
      <Path
        d={d}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={last.x} cy={last.y} r={2.2} fill={color} />
    </>
  );
}
