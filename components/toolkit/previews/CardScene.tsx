import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Polyline,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SCENE_HUES, hexAlpha } from '../carouselStyle';

/**
 * CardScene — the bespoke, per-technique scene behind every toolkit
 * card. Replaces the earlier generic orb/blur previews, which read as
 * unfinished next to the rest of the app.
 *
 * It speaks the app's established visual language (Journey's PathScene /
 * the exercise ExerciseAtmosphere): a deep navy field, a per-technique
 * accent nebula, a sparse deterministic starfield, and — the identity —
 * a HERO MOTIF drawn as constellation line-art unique to each technique.
 * So each card reads like a small star chart of its own practice, and
 * opening it lands you in the matching exercise atmosphere.
 *
 * Cost discipline (same as PathScene/ExerciseAtmosphere): one animated
 * <G> twinkle layer, and only on the FOCUSED card. Neighbours render the
 * exact same art at a fixed resting brightness — no empty gradients, no
 * per-neighbour animation. Everything is programmatic SVG; no images.
 */

// Card is 300×452; the scene owns the upper region — the glass info
// panel + bottom fade (drawn by TechniqueCard on top) cover the lower
// ~40%, so motifs live between y≈40 and y≈250.
const VB_W = 300;
const VB_H = 452;

const AnimatedG = Animated.createAnimatedComponent(G);

type Palette = {
  /** constellation line colour */
  line: string;
  /** node/star fill */
  node: string;
  /** motif glow (accent) */
  glow: string;
};

// ── Deterministic starfield ──────────────────────────────────────────
// Seeded per technique so each card has its own stable sky.
type Star = { x: number; y: number; r: number; o: number };

function seededStars(seed: number, count: number): Star[] {
  let s = (seed || 1) & 0x7fffffff;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * VB_W,
      // Upper ~55% only — keep clear of the glass panel.
      y: 24 + rand() * (VB_H * 0.5),
      r: rand() * 1.1 + 0.5,
      o: rand() * 0.6 + 0.35,
    });
  }
  return stars;
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = (h * 16777619) & 0x7fffffff;
  }
  return h;
}

// ── Motifs ───────────────────────────────────────────────────────────
// Each returns SVG children centred in the card's upper area. Drawn as
// constellation line-art: faint links + brighter nodes, echoing
// PathScene's connected-star language. Coordinates are in the 300×452
// viewBox; the motif band is roughly x:40–260, y:70–220.

const CX = VB_W / 2; // 150

function poly(points: readonly (readonly [number, number])[], p: Palette) {
  const pts = points.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <Polyline
      points={pts}
      fill="none"
      stroke={p.line}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function nodes(
  points: readonly (readonly [number, number, number?])[],
  p: Palette
) {
  return points.map(([x, y, r], i) => (
    <Circle key={i} cx={x} cy={y} r={r ?? 2.2} fill={p.node} />
  ));
}

/** 4-7-8 Breathing — three concentric breath rings, echoing the
 *  breathing exercise's expanding ring. A single guiding star at centre. */
function BreathingMotif({ p }: { p: Palette }) {
  const cy = 150;
  return (
    <G>
      <Circle
        cx={CX}
        cy={cy}
        r={72}
        fill="none"
        stroke={hexAlpha(p.line, 0.5)}
        strokeWidth={1.1}
      />
      <Circle
        cx={CX}
        cy={cy}
        r={52}
        fill="none"
        stroke={hexAlpha(p.line, 0.72)}
        strokeWidth={1.3}
      />
      <Circle
        cx={CX}
        cy={cy}
        r={30}
        fill="none"
        stroke={p.line}
        strokeWidth={1.6}
      />
      <Circle cx={CX} cy={cy} r={4} fill={p.node} />
      {/* four cardinal breath points on the mid ring */}
      {nodes(
        [
          [CX, cy - 52],
          [CX + 52, cy],
          [CX, cy + 52],
          [CX - 52, cy],
        ],
        p
      )}
    </G>
  );
}

/** Urge Surfing / Ride the Wave — a cresting wave drawn as a curve of
 *  linked stars that rises and curls, over a faint second swell. */
function WaveMotif({ p }: { p: Palette }) {
  const crest: [number, number][] = [
    [44, 176],
    [86, 150],
    [128, 120],
    [168, 104],
    [206, 116],
    [230, 146],
    [222, 176],
  ];
  return (
    <G>
      {/* back swell, dimmer */}
      <Path
        d="M 40 190 Q 110 150 150 168 T 260 176"
        fill="none"
        stroke={hexAlpha(p.line, 0.28)}
        strokeWidth={1}
        strokeLinecap="round"
      />
      {poly(crest, p)}
      {nodes(
        [
          [44, 176],
          [128, 120],
          [168, 104, 2.8],
          [230, 146],
          [222, 176],
        ],
        p
      )}
    </G>
  );
}

/** 5-4-3-2-1 Grounding — five stars stepping DOWN (5→1), linked, the
 *  count settling toward the earth. Sizes shrink as the count falls. */
function GroundingMotif({ p }: { p: Palette }) {
  const steps: [number, number, number][] = [
    [70, 92, 3.4],
    [108, 122, 3.0],
    [150, 150, 2.7],
    [192, 176, 2.3],
    [230, 200, 2.0],
  ];
  return (
    <G>
      {poly(
        steps.map(([x, y]) => [x, y] as [number, number]),
        p
      )}
      {nodes(steps, p)}
      {/* faint ground line under the final, smallest star */}
      <Line
        x1={196}
        y1={214}
        x2={264}
        y2={214}
        stroke={hexAlpha(p.line, 0.4)}
        strokeWidth={1}
        strokeLinecap="round"
      />
    </G>
  );
}

/** Body Scan — a minimal human figure as a constellation (head,
 *  shoulders, torso, limbs) with a horizontal scan bar across it. */
function BodyScanMotif({ p }: { p: Palette }) {
  return (
    <G>
      {/* spine + limbs */}
      {poly(
        [
          [CX, 84],
          [CX, 150],
        ],
        p
      )}
      {poly(
        [
          [CX - 34, 112],
          [CX, 108],
          [CX + 34, 112],
        ],
        p
      )}
      {poly(
        [
          [CX - 26, 196],
          [CX, 150],
          [CX + 26, 196],
        ],
        p
      )}
      {/* head */}
      <Circle
        cx={CX}
        cy={78}
        r={9}
        fill="none"
        stroke={p.line}
        strokeWidth={1.4}
      />
      {nodes(
        [
          [CX, 108],
          [CX - 34, 112],
          [CX + 34, 112],
          [CX, 150],
          [CX - 26, 196],
          [CX + 26, 196],
        ],
        p
      )}
      {/* scan bar */}
      <Line
        x1={CX - 58}
        y1={132}
        x2={CX + 58}
        y2={132}
        stroke={hexAlpha(p.glow, 0.9)}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </G>
  );
}

/** Fake Feed — a phone outline as a constellation with three drifting
 *  feed rows and a downward pull chevron: the endless scroll reflex. */
function FakeFeedMotif({ p }: { p: Palette }) {
  const x = CX - 34;
  const y = 82;
  const w = 68;
  const h = 116;
  const r = 12;
  return (
    <G>
      {/* phone body */}
      <Path
        d={`M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 -${r} ${r} h -${w - 2 * r} a ${r} ${r} 0 0 1 -${r} -${r} v -${h - 2 * r} a ${r} ${r} 0 0 1 ${r} -${r} Z`}
        fill="none"
        stroke={p.line}
        strokeWidth={1.4}
      />
      {/* feed rows */}
      {[0, 1, 2].map((i) => (
        <Line
          key={i}
          x1={x + 12}
          y1={y + 30 + i * 22}
          x2={x + w - 12}
          y2={y + 30 + i * 22}
          stroke={hexAlpha(p.line, 0.55 - i * 0.14)}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      {/* downward pull chevron */}
      {poly(
        [
          [CX - 8, y + h + 14],
          [CX, y + h + 22],
          [CX + 8, y + h + 14],
        ],
        p
      )}
      {nodes([[CX, y + h + 22, 1.8]], p)}
    </G>
  );
}

function Motif({ id, p }: { id: string; p: Palette }) {
  switch (id) {
    case 'breathing_478':
      return <BreathingMotif p={p} />;
    case 'urge_surfing':
    case 'ride_the_wave':
      return <WaveMotif p={p} />;
    case 'grounding_54321':
      return <GroundingMotif p={p} />;
    case 'body_scan':
      return <BodyScanMotif p={p} />;
    case 'fake_feed':
      return <FakeFeedMotif p={p} />;
    default:
      return <BreathingMotif p={p} />;
  }
}

let sceneSeq = 0;

export function CardScene({
  techniqueId,
  animate = true,
}: {
  techniqueId: string;
  animate?: boolean;
}) {
  const hues = SCENE_HUES[techniqueId] ?? {
    primary: '#5A6BE8',
    secondary: '#3A2FA8',
  };
  const palette: Palette = {
    line: 'rgba(226,235,255,0.82)',
    node: '#f4f8ff',
    glow: hues.primary,
  };

  const uid = useRef((sceneSeq += 1)).current;
  const nebulaId = `cardNebula${uid}`;
  const glowId = `cardMotifGlow${uid}`;

  const stars = seededStars(hashId(techniqueId), 20);

  // Focused card: the constellation + stars breathe in brightness. One
  // shared value, one animated <G> — neighbours hold a fixed frame.
  const tw = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) {
      tw.value = 1;
      return;
    }
    tw.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [animate, tw]);

  const twProps = useAnimatedProps(() => ({
    // Gentle swing 0.8 → 1 — a slow inhale, not a flicker.
    opacity: 0.8 + tw.value * 0.2,
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <RadialGradient
            id={nebulaId}
            cx={CX}
            cy={140}
            rx={190}
            ry={170}
            fx={CX}
            fy={140}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={hues.primary} stopOpacity={0.24} />
            <Stop offset="0.5" stopColor={hues.secondary} stopOpacity={0.1} />
            <Stop offset="1" stopColor={hues.secondary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient
            id={glowId}
            cx={CX}
            cy={150}
            rx={120}
            ry={120}
            fx={CX}
            fy={150}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={hues.primary} stopOpacity={0.2} />
            <Stop offset="1" stopColor={hues.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* accent nebula bloom */}
        <Ellipse
          cx={CX}
          cy={140}
          rx={190}
          ry={170}
          fill={`url(#${nebulaId})`}
        />

        {/* static starfield */}
        {stars.map((s, i) => (
          <Circle
            key={`s${i}`}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill={hexAlpha('#dfe9ff', s.o)}
          />
        ))}

        {/* motif glow halo */}
        <Ellipse cx={CX} cy={150} rx={120} ry={120} fill={`url(#${glowId})`} />

        {/* hero constellation — pulses on the focused card */}
        <AnimatedG animatedProps={twProps}>
          <Motif id={techniqueId} p={palette} />
        </AnimatedG>
      </Svg>
    </View>
  );
}
