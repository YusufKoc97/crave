import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { GlowDisc } from '@/components/ui/GlowDisc';

const AnimatedG = Animated.createAnimatedComponent(G);

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
 *  every re-render and break the assigned twinkle groups. */
type Star = {
  x: number; // 0..1 fraction of scene width
  y: number; // 0..1 fraction of scene height (top half)
  r: number; // radius px
  o: number; // base opacity 0..1
  g: number; // twinkle group 0..TWINKLE_GROUPS-1
};

/** Number of independent twinkle phase groups. Each star gets
 *  assigned to one at seed time; all stars in a group share one
 *  Reanimated shared value AND one animated <G> wrapper, so the
 *  per-frame cost is O(groups), not O(stars).
 *
 *  An earlier version shared the shared values but still gave every
 *  star its own animated <Circle>. That was 40 SVG node writes per
 *  frame, and because react-native-svg repaints the whole <Svg>
 *  canvas when any child prop changes, it also meant 40 full repaints
 *  of the mountain scene every frame — the Journey tab's frame drop. */
const TWINKLE_GROUPS = 8;

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
      g: Math.floor(rand() * TWINKLE_GROUPS),
    });
  }
  return stars;
}

/** Constellation shape — a series of points that get connected
 *  by lines. Positions are % of the scene width/height so they
 *  scale with the viewBox. Kept in the upper half of the canvas
 *  so they overlay the star field, not the mountains. */
type Constellation = {
  /** Each stroke is a polyline sequence — [[x%, y%], ...] */
  strokes: readonly (readonly (readonly [number, number])[])[];
  /** Extra bright dots at the polyline vertices so the shape
   *  reads as "stars connected", not just a line drawing. */
  nodes: readonly (readonly [number, number])[];
};

/** Four constellation patterns from the design reference:
 *  zigzag (Cassiopeia-like), closed triangle, curve, diamond. */
const CONSTELLATIONS: readonly Constellation[] = [
  // 1. Zigzag "W" — sits upper-left
  {
    strokes: [
      [
        [8, 16],
        [15, 22],
        [22, 15],
        [29, 25],
        [36, 18],
      ],
    ],
    nodes: [
      [8, 16],
      [15, 22],
      [22, 15],
      [29, 25],
      [36, 18],
    ],
  },
  // 2. Closed triangle — upper-right
  {
    strokes: [
      [
        [72, 12],
        [86, 22],
        [76, 30],
        [72, 12],
      ],
    ],
    nodes: [
      [72, 12],
      [86, 22],
      [76, 30],
    ],
  },
  // 3. Curve — mid, sweeps down-right
  {
    strokes: [
      [
        [42, 32],
        [50, 36],
        [55, 44],
        [57, 52],
      ],
    ],
    nodes: [
      [42, 32],
      [50, 36],
      [55, 44],
      [57, 52],
    ],
  },
  // 4. Diamond ("baklava") — mid-left
  {
    strokes: [
      [
        [12, 38],
        [22, 34],
        [30, 42],
        [22, 50],
        [12, 38],
      ],
    ],
    nodes: [
      [12, 38],
      [22, 34],
      [30, 42],
      [22, 50],
    ],
  },
];

/** One shared value per twinkle group, each with a staggered
 *  phase so the field looks alive but calms down to a manageable
 *  set of animations. Each SV oscillates 0..1 over ~6s. */
function useTwinkleGroups() {
  const svs = Array.from({ length: TWINKLE_GROUPS }, () =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSharedValue(0)
  );
  useEffect(() => {
    svs.forEach((sv, i) => {
      // Vary duration a bit per group (5.2s..8.4s) so the whole
      // sky doesn't beat in unison. Start delayed by group index
      // so the initial phase spreads across the loop.
      const duration = 5200 + i * 400;
      const delay = i * 350;
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, {
              duration: duration / 2,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(0, {
              duration: duration / 2,
              easing: Easing.inOut(Easing.sin),
            })
          ),
          -1,
          false
        )
      );
    });
    return () => svs.forEach((sv) => cancelAnimation(sv));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return svs;
}

/**
 * One twinkle group — every star in it shares a single animated <G>.
 *
 * Each star keeps its own base opacity as a *static* `fillOpacity`;
 * the group's `opacity` multiplies over it. So a star's effective
 * brightness still swings between dim and its own base value, but
 * the whole group costs one animated node instead of one per star.
 */
function TwinkleGroup({
  stars,
  width,
  height,
  phase,
}: {
  stars: readonly Star[];
  width: number;
  height: number;
  phase: ReturnType<typeof useSharedValue<number>>;
}) {
  const animatedProps = useAnimatedProps(() => ({
    // phase oscillates 0..1 → group opacity 0.2..1. The dim floor is
    // now proportional rather than absolute, which reads better: faint
    // stars fade toward nothing instead of bottoming out at the same
    // grey as the bright ones.
    opacity: 0.2 + phase.value * 0.8,
  }));
  return (
    <AnimatedG animatedProps={animatedProps}>
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
    </AnimatedG>
  );
}

/** Constellation renderer — draws faint polylines connecting
 *  the nodes, then overlays slightly brighter static dots on
 *  each node so the shape reads as "stars linked", not just
 *  line art. Nodes stay non-twinkling on purpose — the design
 *  brief calls the constellations stable so they anchor the eye
 *  against the flickering background field. */
function ConstellationShape({
  constellation,
  width,
  height,
}: {
  constellation: Constellation;
  width: number;
  height: number;
}) {
  return (
    <>
      {constellation.strokes.map((stroke, si) => {
        const points = stroke
          .map(([xp, yp]) => `${(xp / 100) * width},${(yp / 100) * height}`)
          .join(' ');
        return (
          <Polyline
            key={si}
            points={points}
            fill="none"
            stroke="rgba(210,224,248,0.42)"
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
      {constellation.nodes.map(([xp, yp], ni) => (
        <Circle
          key={ni}
          cx={(xp / 100) * width}
          cy={(yp / 100) * height}
          r={1.4}
          fill="#ffffff"
          fillOpacity={0.85}
        />
      ))}
    </>
  );
}

// Monotonic counter → globally-unique SVG gradient ids. react-native-svg
// resolves `url(#id)` against a shared registry on native, so hardcoded
// ids shared across mounts can repaint each other's gradient.
let sceneSeq = 0;

export function PathScene() {
  const stars = useMemo(() => seededStars(40), []);
  // Bucket once at mount — the render path then walks groups, not stars.
  const starGroups = useMemo(
    () =>
      Array.from({ length: TWINKLE_GROUPS }, (_, g) =>
        stars.filter((s) => s.g === g)
      ),
    [stars]
  );
  const twinkleGroups = useTwinkleGroups();
  // Fixed viewBox — SVG scales to any container size via
  // width/height 100% + preserveAspectRatio. This is simpler than
  // measuring the parent and avoids the state-update chicken/egg
  // that gated M3a earlier.
  const width = 400;
  const height = 600;

  // Unique gradient ids per mount. Gradients also use userSpaceOnUse
  // with numeric coords (not objectBoundingBox %) — the only form
  // react-native-svg paints reliably on native (same lesson GlowDisc
  // learned). With % coords the mountains/auroras vanished on device.
  const uid = useRef((sceneSeq += 1)).current;
  const ID = {
    peak: `peakGlow${uid}`,
    horizon: `horizonAurora${uid}`,
    ridgeA: `ridgeA${uid}`,
    ridgeB: `ridgeB${uid}`,
    ridgeC: `ridgeC${uid}`,
    read: `readability${uid}`,
  };

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* ── Aurora clouds ─── positioned as % of container so they
             land in roughly the same spots regardless of size. */}
      <GlowDisc
        leftPct={15}
        topPct={8}
        size={340}
        color="rgba(120,140,236,0.50)"
      />
      <GlowDisc
        leftPct={70}
        topPct={18}
        size={280}
        color="rgba(150,120,200,0.40)"
      />
      <GlowDisc
        leftPct={45}
        topPct={35}
        size={400}
        color="rgba(90,150,170,0.30)"
      />

      {/* ── Mountains + horizon aurora + peak glow (SVG) ────── */}
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMax slice"
      >
        <Defs>
          {/* Peak glow — purple radial behind the highest ridge.
              userSpaceOnUse numeric coords in the 400×600 viewBox. */}
          <RadialGradient
            id={ID.peak}
            cx={width * 0.5}
            cy={height * 0.9}
            rx={width * 0.6}
            ry={height * 0.35}
            fx={width * 0.5}
            fy={height * 0.9}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor="rgb(150,120,200)" stopOpacity={0.4} />
            <Stop offset="100%" stopColor="rgb(150,120,200)" stopOpacity={0} />
          </RadialGradient>
          {/* Horizon aurora — soft light pooled at the bottom. Peak
              opacity 0.2, not the old 0.55: at 0.55 the pool clipped
              against the card's bottom edge and read as a flat grey
              platform with zero tonal transition. Taller ry so the
              falloff breathes instead of banding. */}
          <RadialGradient
            id={ID.horizon}
            cx={width * 0.5}
            cy={height}
            rx={width * 0.85}
            ry={height * 0.22}
            fx={width * 0.5}
            fy={height}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor="rgb(236,243,253)" stopOpacity={0.2} />
            <Stop
              offset="55%"
              stopColor="rgb(236,243,253)"
              stopOpacity={0.07}
            />
            <Stop offset="100%" stopColor="rgb(236,243,253)" stopOpacity={0} />
          </RadialGradient>

          {/* Ridge gradients — darker as we come down. Each spans its
              own vertical extent (peak → bottom) in user space. */}
          <LinearGradient
            id={ID.ridgeA}
            x1="0"
            y1={height * 0.48}
            x2="0"
            y2={height}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor="#2a3358" />
            <Stop offset="100%" stopColor="#16203a" />
          </LinearGradient>
          <LinearGradient
            id={ID.ridgeB}
            x1="0"
            y1={height * 0.68}
            x2="0"
            y2={height}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor="#1c2544" />
            <Stop offset="100%" stopColor="#111a30" />
          </LinearGradient>
          <LinearGradient
            id={ID.ridgeC}
            x1="0"
            y1={height * 0.82}
            x2="0"
            y2={height}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor="#141c33" />
            <Stop offset="100%" stopColor="#0b1220" />
          </LinearGradient>

          {/* Readability overlay — top-to-bottom dark wash */}
          <LinearGradient
            id={ID.read}
            x1="0"
            y1="0"
            x2="0"
            y2={height}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor="rgb(11,18,32)" stopOpacity={0.3} />
            <Stop offset="50%" stopColor="rgb(11,18,32)" stopOpacity={0.52} />
            <Stop offset="100%" stopColor="rgb(11,18,32)" stopOpacity={0.38} />
          </LinearGradient>
        </Defs>

        {/* Peak radial glow — sits behind the ridges */}
        <Rect
          x="0"
          y={height * 0.55}
          width={width}
          height={height * 0.45}
          fill={`url(#${ID.peak})`}
        />

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
          fill={`url(#${ID.ridgeA})`}
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
          fill={`url(#${ID.ridgeB})`}
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
          fill={`url(#${ID.ridgeC})`}
          stroke="rgba(200,214,240,0.08)"
          strokeWidth={0.8}
        />

        {/* Horizon aurora — feathered pool at the very bottom */}
        <Rect
          x="0"
          y={height * 0.78}
          width={width}
          height={height * 0.22}
          fill={`url(#${ID.horizon})`}
        />

        {/* Readability wash — top-to-bottom dark gradient so the
            rank text stays legible over the scene. Sits above the
            mountains but below the stars. */}
        <Rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill={`url(#${ID.read})`}
        />

        {/* Constellations — thin white lines connecting fixed
            node points. Nodes are rendered as slightly brighter
            dots on top so the shape reads as "stars linked". Static,
            so they stay on this never-repainting canvas. */}
        {CONSTELLATIONS.map((c, ci) => (
          <ConstellationShape
            key={ci}
            constellation={c}
            width={width}
            height={height}
          />
        ))}
      </Svg>

      {/* ── Star field ─────────────────────────────────────────────
          Deliberately its OWN <Svg>, overlaid on the one above.
          react-native-svg repaints an entire canvas whenever any
          child prop changes, so leaving the twinkling stars inside
          the scene above meant redrawing three gradient-filled
          mountain ridges, two radial glows and the readability wash
          on every animation frame. Isolated here, a twinkle repaints
          nothing but 40 sub-pixel dots. */}
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMax slice"
      >
        {starGroups.map((group, g) => (
          <TwinkleGroup
            key={g}
            stars={group}
            width={width}
            height={height}
            phase={twinkleGroups[g]}
          />
        ))}
      </Svg>
    </View>
  );
}

/** Percentage-positioned aurora disc — the parent container size
 *  is unknown at render time, so we anchor via % + a translate
 *  offset that centers the disc on its (leftPct, topPct) point. */
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
