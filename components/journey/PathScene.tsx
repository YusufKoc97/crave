import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/**
 * Journey PATH background scene — M3a (static).
 *
 * Sits absolutely inside the PathSpine container, behind the rows.
 * Mountains-under-a-starfield metaphor: the ranks stack up the
 * spine like altitudes; the horizon aurora anchors the "you are
 * here" current row at the bottom.
 *
 * Layers, back to front:
 *   1. Aurora clouds — 3 large blurred colored discs (web has
 *      real CSS blur; native uses opacity + soft alpha)
 *   2. SVG mountain silhouettes — 3 ridge layers with gradients
 *      + peak glow behind + horizon aurora radial glow at the
 *      bottom
 *   3. Static stars — ~40 tiny dots, deterministic positions
 *      (seed-based hash) so they don't reshuffle on every render
 *   4. Readability gradient — a top-to-bottom dark wash over
 *      the whole scene so the rank text stays legible
 *
 * M3b will add animation: aurora drift, star twinkle.
 * M3c will layer constellations on top of the stars.
 *
 * Design intent: subtle. The rank list is the hero content; the
 * scene should read as "there's atmosphere here" without pulling
 * eyes away from the text.
 */

/** Deterministic star field — same seed always produces the same
 *  point cloud. Avoids Math.random() which would reshuffle on
 *  every re-render and interfere with any future twinkle. */
type Star = {
  x: number; // 0..1 fraction of scene width
  y: number; // 0..1 fraction of scene height (top half)
  r: number; // radius px
  o: number; // opacity 0..1
};

function seededStars(count: number): Star[] {
  // Small linear congruential generator with a fixed seed so the
  // sky is stable across mounts.
  let s = 0x2f6e2b;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const stars: Star[] = [];
  // Stars only occupy the upper 54% of the container so they
  // don't fight the mountains for space.
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand(),
      y: rand() * 0.54,
      r: rand() * 0.9 + 0.4, // 0.4..1.3px
      o: rand() * 0.6 + 0.3, // 0.3..0.9
    });
  }
  return stars;
}

export function PathScene() {
  const stars = useMemo(() => seededStars(40), []);
  // Fixed viewBox — SVG scales to any container size via
  // width/height 100% + preserveAspectRatio. This is simpler than
  // measuring the parent and avoids the state-update chicken/egg
  // that gated M3a earlier.
  const width = 400;
  const height = 600;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* ── Aurora clouds ─── positioned as % of container so they
             land in roughly the same spots regardless of size. */}
      <AuroraDiscPct
        leftPct={15}
        topPct={8}
        size={220}
        color="rgba(120,140,236,0.34)"
      />
      <AuroraDiscPct
        leftPct={70}
        topPct={18}
        size={180}
        color="rgba(150,120,200,0.26)"
      />
      <AuroraDiscPct
        leftPct={45}
        topPct={35}
        size={260}
        color="rgba(90,150,170,0.22)"
      />

      {/* ── Mountains + horizon aurora + peak glow (SVG) ────── */}
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMax slice"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {/* Peak glow — purple radial behind the highest ridge */}
          <RadialGradient
            id="peakGlow"
            cx="50%"
            cy="90%"
            rx="60%"
            ry="35%"
            fx="50%"
            fy="90%"
          >
            <Stop
              offset="0%"
              stopColor="rgba(150,120,200,0.4)"
              stopOpacity={1}
            />
            <Stop
              offset="100%"
              stopColor="rgba(150,120,200,0)"
              stopOpacity={0}
            />
          </RadialGradient>
          {/* Horizon aurora — thin white radial hugging the bottom */}
          <RadialGradient
            id="horizonAurora"
            cx="50%"
            cy="100%"
            rx="85%"
            ry="12%"
            fx="50%"
            fy="100%"
          >
            <Stop
              offset="0%"
              stopColor="rgba(236,243,253,0.55)"
              stopOpacity={1}
            />
            <Stop
              offset="60%"
              stopColor="rgba(236,243,253,0.12)"
              stopOpacity={1}
            />
            <Stop
              offset="100%"
              stopColor="rgba(236,243,253,0)"
              stopOpacity={0}
            />
          </RadialGradient>

          {/* Ridge gradients — darker as we come down */}
          <LinearGradient id="ridgeA" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#2a3358" />
            <Stop offset="100%" stopColor="#16203a" />
          </LinearGradient>
          <LinearGradient id="ridgeB" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#1c2544" />
            <Stop offset="100%" stopColor="#111a30" />
          </LinearGradient>
          <LinearGradient id="ridgeC" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#141c33" />
            <Stop offset="100%" stopColor="#0b1220" />
          </LinearGradient>

          {/* Readability overlay — top-to-bottom dark wash */}
          <LinearGradient id="readability" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="rgba(11,18,32,0.42)" />
            <Stop offset="50%" stopColor="rgba(11,18,32,0.70)" />
            <Stop offset="100%" stopColor="rgba(11,18,32,0.50)" />
          </LinearGradient>
        </Defs>

        {/* Peak radial glow — sits behind the ridges */}
        <Rect
          x="0"
          y={height * 0.55}
          width={width}
          height={height * 0.45}
          fill="url(#peakGlow)"
        />

        {/* Static stars — one <Circle> per star. Sits behind the
            mountains so ridges "cover" the horizon. */}
        {stars.map((s, i) => (
          <Circle
            key={i}
            cx={s.x * width}
            cy={s.y * height}
            r={s.r}
            fill="#ffffff"
            fillOpacity={s.o}
          />
        ))}

        {/* Ridge A — furthest, tallest peaks */}
        <Path
          d={ridgePath(
            width,
            height,
            [
              [0, 0.72],
              [0.15, 0.58],
              [0.28, 0.65],
              [0.42, 0.5],
              [0.55, 0.58],
              [0.68, 0.48],
              [0.82, 0.6],
              [1, 0.55],
            ],
            1
          )}
          fill="url(#ridgeA)"
          stroke="rgba(200,214,240,0.15)"
          strokeWidth={0.8}
        />

        {/* Ridge B — middle */}
        <Path
          d={ridgePath(
            width,
            height,
            [
              [0, 0.82],
              [0.18, 0.72],
              [0.36, 0.78],
              [0.5, 0.68],
              [0.65, 0.75],
              [0.82, 0.68],
              [1, 0.75],
            ],
            1
          )}
          fill="url(#ridgeB)"
          stroke="rgba(200,214,240,0.1)"
          strokeWidth={0.8}
        />

        {/* Ridge C — nearest, hugs the bottom */}
        <Path
          d={ridgePath(
            width,
            height,
            [
              [0, 0.9],
              [0.2, 0.83],
              [0.4, 0.88],
              [0.6, 0.82],
              [0.8, 0.88],
              [1, 0.84],
            ],
            1
          )}
          fill="url(#ridgeC)"
          stroke="rgba(200,214,240,0.08)"
          strokeWidth={0.8}
        />

        {/* Horizon aurora — thin bright hug at the very bottom */}
        <Rect
          x="0"
          y={height * 0.86}
          width={width}
          height={height * 0.14}
          fill="url(#horizonAurora)"
        />

        {/* Readability wash on top of everything */}
        <Rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="url(#readability)"
        />
      </Svg>
    </View>
  );
}

/** Percentage-positioned aurora disc — the parent container size
 *  is unknown at render time, so we anchor via % + a translate
 *  offset that centers the disc on its (leftPct, topPct) point. */
function AuroraDiscPct({
  leftPct,
  topPct,
  size,
  color,
}: {
  leftPct: number;
  topPct: number;
  size: number;
  color: string;
}) {
  const base = {
    position: 'absolute' as const,
    left: `${leftPct}%` as const,
    top: `${topPct}%` as const,
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginTop: -size / 2,
    borderRadius: size / 2,
    backgroundColor: color,
  };
  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <View style={{ ...base, filter: 'blur(18px)' } as any} />;
  }
  // Native fallback: softer opacity + no blur (no expo-blur dep).
  return <View style={[base, { opacity: 0.6 }]} />;
}

/** Convert normalized peak points to an SVG path that closes at
 *  the bottom of the viewBox. Points are [x, y] where both are
 *  0..1 fractions of width / height. y=0 is top, y=1 is bottom. */
function ridgePath(
  width: number,
  height: number,
  pts: readonly (readonly [number, number])[],
  closeToY = 1
): string {
  if (pts.length === 0) return '';
  const [x0, y0] = pts[0];
  let d = `M ${(x0 * width).toFixed(1)} ${(y0 * height).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    d += ` L ${(x * width).toFixed(1)} ${(y * height).toFixed(1)}`;
  }
  d += ` L ${width.toFixed(1)} ${(closeToY * height).toFixed(1)}`;
  d += ` L 0 ${(closeToY * height).toFixed(1)} Z`;
  return d;
}
