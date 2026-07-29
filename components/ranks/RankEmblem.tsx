import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  FeDropShadow,
  FeGaussianBlur,
  Filter,
  G,
  Line,
  LinearGradient,
  Mask,
  Path,
  Polygon,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * The nine rank emblems, ported from the `Rank Emblems` handoff.
 * Each emblem is three layers:
 *
 *   1. Frame — an N-sided polygon in a metallic gradient. The side
 *      count climbs 6→6→8→8→10→10→12→12→16, so the silhouette
 *      rounds off as the ladder is climbed.
 *   2. Face — a smaller polygon in a dark gradient. The sculpture is
 *      CLIPPED to this, which is why nothing spills past the frame.
 *   3. Sculpture — per-tier artwork, scaled by the face polygon's
 *      APOTHEM rather than its circumradius so no tier gets sliced.
 *
 * Stateless and pure: `<RankEmblem tier={0..8} size={34|46|64|138} />`.
 *
 * Three things are load-bearing and easy to break:
 *
 *   - **Gradient ids carry both tier and size.** SVG ids are
 *     document-global on web, so two emblems on one screen would
 *     otherwise resolve each other's gradients.
 *   - **Mirrored ornaments need mirrored gradients.** An
 *     objectBoundingBox gradient runs the wrong way on a mirrored
 *     shape, so every left-hand ornament uses `mL`/`spL` (and
 *     Horizon's `fadeL`). The handoff flags this as the mistake it
 *     hit most often during its own iteration.
 *   - **`fine` detail stops below 46px.** Crown teeth, laurels,
 *     flank spikes, fine facets and spectral shards turn to mud at
 *     34, so they are simply not drawn there.
 *
 * The reference used CSS `filter: drop-shadow()` / `blur()`, neither
 * of which exists in RN. react-native-svg 15 ships real filter
 * primitives, so these are `<FeDropShadow>` / `<FeGaussianBlur>`
 * rather than the layered-ellipse approximation the handoff offers
 * as a fallback.
 */

type Material = {
  n: string;
  sides: number;
  hi: string;
  a: string;
  d: string;
  gem: string;
  gh: string;
};

const TIERS: readonly Material[] = [
  {
    n: 'Base',
    sides: 6,
    hi: '#8d97a6',
    a: '#4e5766',
    d: '#171c24',
    gem: '#6d7b8d',
    gh: '#b9c6d6',
  },
  {
    n: 'First Step',
    sides: 6,
    hi: '#f0b585',
    a: '#c07c47',
    d: '#4a2913',
    gem: '#e09a5c',
    gh: '#ffe0c2',
  },
  {
    n: 'Steady',
    sides: 8,
    hi: '#ffffff',
    a: '#c2cfe0',
    d: '#46525f',
    gem: '#dce8f6',
    gh: '#ffffff',
  },
  {
    n: 'Ridge',
    sides: 8,
    hi: '#fff0c2',
    a: '#e0ac3e',
    d: '#66450f',
    gem: '#ffd45e',
    gh: '#fff6d8',
  },
  {
    n: 'Foothold',
    sides: 10,
    hi: '#c6f8de',
    a: '#39b183',
    d: '#0d4130',
    gem: '#4fe0a6',
    gh: '#d8fdec',
  },
  {
    n: 'Vantage',
    sides: 10,
    hi: '#c8e2ff',
    a: '#3a7ad8',
    d: '#102956',
    gem: '#5aa8ff',
    gh: '#dff0ff',
  },
  {
    n: 'Peak',
    sides: 12,
    hi: '#ead9ff',
    a: '#9257e0',
    d: '#35175a',
    gem: '#c08cff',
    gh: '#f4e9ff',
  },
  {
    n: 'Horizon',
    sides: 12,
    hi: '#eafbff',
    a: '#6fd3f7',
    d: '#124a66',
    gem: '#9fe8ff',
    gh: '#ffffff',
  },
  {
    n: 'Free',
    sides: 16,
    hi: '#ffffff',
    a: '#b9a6ff',
    d: '#33245e',
    gem: '#ffffff',
    gh: '#ffffff',
  },
] as const;

const SPEC = ['#5cc9f5', '#a978ec', '#ff7ab8', '#ffc46b', '#5ee6c0'] as const;

type Pt = [number, number];

const poly = (p: Pt[]) =>
  p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

function ring(n: number, r: number, cx: number, cy: number, rot = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const g = ((rot + i * (360 / n)) * Math.PI) / 180;
    out.push([cx + Math.cos(g) * r, cy + Math.sin(g) * r]);
  }
  return out;
}

/** CSS `blur(R)` is approximately a Gaussian with stdDeviation R/2. */
const sd = (cssBlurPx: number) => (cssBlurPx / 2).toFixed(2);

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

type AnimProps = Record<string, unknown>;
type SculptProps = { C: Material; id: string; fine: boolean };

/* ────────────────────────── sculptures ──────────────────────────
   All drawn in a 100×100 box centred on (50,54), exactly as the
   reference does; the caller scales them into the face.           */

function S1({ C, id, fine }: SculptProps) {
  return (
    <>
      <Circle
        cx={50}
        cy={54}
        r={27}
        fill="none"
        stroke="#0d1320"
        strokeWidth={10}
      />
      <Circle
        cx={50}
        cy={54}
        r={27}
        fill="none"
        stroke={C.a}
        strokeWidth={1.6}
        strokeOpacity={0.6}
      />
      <Circle
        cx={50}
        cy={54}
        r={12}
        fill={`url(#${id}g)`}
        stroke={C.gh}
        strokeWidth={1.2}
        strokeOpacity={0.7}
      />
      {fine && (
        <Circle cx={45.6} cy={49.6} r={3.4} fill="#fff" opacity={0.45} />
      )}
    </>
  );
}

function S2({ C, id, fine }: SculptProps) {
  return (
    <>
      <Line
        x1={14}
        y1={78}
        x2={86}
        y2={78}
        stroke="#0b1120"
        strokeWidth={9}
        strokeLinecap="round"
      />
      <Line
        x1={20}
        y1={78}
        x2={80}
        y2={78}
        stroke={C.a}
        strokeWidth={2}
        strokeOpacity={0.55}
        strokeLinecap="round"
      />
      <Polygon
        points={poly([
          [42, 78],
          [52, 20],
          [62, 54],
          [57, 78],
        ])}
        fill={`url(#${id}g)`}
        stroke={C.gh}
        strokeWidth={1.1}
        strokeOpacity={0.7}
        filter={`url(#${id}glow)`}
      />
      {fine && (
        <>
          <Polygon
            points={poly([
              [52, 20],
              [62, 54],
              [52, 49],
            ])}
            fill="#fff"
            opacity={0.42}
          />
          <Polygon
            points={poly([
              [30, 78],
              [36, 62],
              [41, 78],
            ])}
            fill={C.a}
            opacity={0.6}
          />
        </>
      )}
    </>
  );
}

function S3({ C, id }: SculptProps) {
  const oct = ring(8, 29, 50, 54, -90);
  const v = (i: number) => oct[i % 8];
  return (
    <>
      <Polygon
        points={poly(oct)}
        fill={`url(#${id}e)`}
        stroke="#fff"
        strokeWidth={1.4}
        strokeOpacity={0.75}
        filter={`url(#${id}glow)`}
      />
      <Polygon
        points={poly([v(7), v(0), v(3), v(4)])}
        fill={C.d}
        opacity={0.24}
      />
      <Line
        x1={v(7)[0]}
        y1={v(7)[1]}
        x2={v(3)[0]}
        y2={v(3)[1]}
        stroke={C.d}
        strokeWidth={1.5}
        strokeOpacity={0.6}
      />
    </>
  );
}

function S4({ C, id, fine }: SculptProps) {
  const wing = (s: number) => {
    const bl = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      x4: number,
      y4: number,
      op: number,
      key: string
    ) => (
      <Polygon
        key={key}
        points={poly([
          [50 + s * x1, y1],
          [50 + s * x2, y2],
          [50 + s * x3, y3],
          [50 + s * x4, y4],
        ])}
        fill={`url(#${id}g)`}
        stroke={C.d}
        strokeWidth={0.9}
        opacity={op}
      />
    );
    return (
      <G key={`w${s}`}>
        {bl(11, 34, 40, 38, 34, 45, 13, 43, 0.95, 'a')}
        {bl(12, 44, 37, 49, 30, 56, 14, 52, 0.85, 'b')}
        {bl(13, 53, 31, 59, 25, 64, 15, 60, 0.7, 'c')}
        <Polyline
          points={poly([
            [50 + s * 11, 34],
            [50 + s * 40, 38],
          ])}
          fill="none"
          stroke="#fff"
          strokeWidth={1.8}
          strokeOpacity={0.55}
          strokeLinecap="round"
        />
        <Polygon
          points={poly([
            [50 + s * 40, 38],
            [50 + s * 34, 45],
            [50 + s * 30, 40],
          ])}
          fill="#fff"
          opacity={0.22}
        />
      </G>
    );
  };
  return (
    <>
      <G filter={`url(#${id}drop)`}>
        {wing(-1)}
        {wing(1)}
        <Polygon
          points={poly([
            [50, 14],
            [66, 52],
            [50, 86],
            [34, 52],
          ])}
          fill={`url(#${id}g)`}
          stroke={C.gh}
          strokeWidth={1.2}
          strokeOpacity={0.75}
        />
      </G>
      <Polygon
        points={poly([
          [50, 14],
          [66, 52],
          [50, 46],
        ])}
        fill="#fff"
        opacity={0.4}
      />
      {fine && (
        <>
          <Polygon
            points={poly([
              [50, 46],
              [66, 52],
              [50, 86],
              [34, 52],
            ])}
            fill="#000"
            opacity={0.18}
          />
          <Polygon
            points={poly([
              [50, 40],
              [58, 52],
              [50, 64],
              [42, 52],
            ])}
            fill={`url(#${id}e)`}
            stroke="#fff"
            strokeWidth={0.9}
            strokeOpacity={0.6}
            filter={`url(#${id}glow)`}
          />
        </>
      )}
    </>
  );
}

function S5({ C, id, fine }: SculptProps) {
  const prong = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const P = (r: number, o: number): Pt => [
      50 + c * r - s * o,
      54 + s * r + c * o,
    ];
    const tip = P(38, 0);
    const l1 = P(24, 7.5);
    const l2 = P(15, 4);
    const r1 = P(24, -7.5);
    const r2 = P(15, -4);
    return (
      <G key={`p${deg}`}>
        <Polygon
          points={poly([tip, l1, l2, r2, r1])}
          fill={`url(#${id}g)`}
          stroke={C.d}
          strokeWidth={0.9}
        />
        <Polygon points={poly([tip, l1, l2])} fill="#fff" opacity={0.26} />
        <Line
          x1={tip[0]}
          y1={tip[1]}
          x2={P(16, 0)[0]}
          y2={P(16, 0)[1]}
          stroke={C.d}
          strokeWidth={1.1}
          strokeOpacity={0.6}
        />
        <Polyline
          points={poly([tip, l1])}
          fill="none"
          stroke="#fff"
          strokeWidth={1.4}
          strokeOpacity={0.6}
          strokeLinecap="round"
        />
      </G>
    );
  };
  const hex = ring(6, 21, 50, 54, -90);
  const h = (i: number) => hex[i % 6];
  const inner = ring(6, 10, 50, 54, -90);
  return (
    <>
      <G filter={`url(#${id}drop)`}>{[-90, 30, 150].map(prong)}</G>
      <Polygon
        points={poly(hex)}
        fill={`url(#${id}e)`}
        stroke="#fff"
        strokeWidth={1.5}
        strokeOpacity={0.85}
        filter={`url(#${id}glow)`}
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Polygon
          key={`k${i}`}
          points={poly([h(i), h(i + 1), [50, 54]])}
          fill={C.d}
          opacity={i % 2 ? 0.3 : 0.16}
        />
      ))}
      {hex.map(([x, y], i) => (
        <Line
          key={`r${i}`}
          x1={50}
          y1={54}
          x2={x}
          y2={y}
          stroke="#fff"
          strokeWidth={1}
          strokeOpacity={0.5}
        />
      ))}
      <Polygon
        points={poly(inner)}
        fill="#fff"
        opacity={0.88}
        stroke={C.d}
        strokeWidth={1.1}
        strokeOpacity={0.5}
      />
      {fine &&
        inner.map(([x, y], i) => {
          const n = inner[(i + 1) % 6];
          return (
            <Line
              key={`i${i}`}
              x1={x}
              y1={y}
              x2={n[0]}
              y2={n[1]}
              stroke={C.d}
              strokeWidth={0.8}
              strokeOpacity={0.4}
            />
          );
        })}
    </>
  );
}

function S6({ C, id, fine }: SculptProps) {
  const CY = 52;
  return (
    <>
      <Circle
        cx={50}
        cy={CY}
        r={27}
        fill="none"
        stroke={`url(#${id}e)`}
        strokeWidth={3.4}
        strokeOpacity={0.8}
      />
      {fine &&
        ring(8, 27, 50, CY, -90).map(([x, y], i) => (
          <Circle
            key={`a${i}`}
            cx={x}
            cy={y}
            r={2.2}
            fill={C.gh}
            opacity={0.8}
          />
        ))}
      <Polygon
        points={poly([
          [43, 90],
          [46, 24],
          [50, 14],
          [54, 24],
          [57, 90],
        ])}
        fill={`url(#${id}g)`}
        stroke={C.gh}
        strokeWidth={1.1}
        strokeOpacity={0.7}
        filter={`url(#${id}glow)`}
      />
      <Polygon
        points={poly([
          [50, 14],
          [54, 24],
          [57, 90],
          [50, 90],
        ])}
        fill={C.d}
        opacity={0.3}
      />
      <Polygon
        points={poly([
          [50, 14],
          [46, 24],
          [43, 90],
          [50, 90],
        ])}
        fill="#fff"
        opacity={0.14}
      />
      <Line
        x1={50}
        y1={15}
        x2={50}
        y2={90}
        stroke="#fff"
        strokeWidth={1}
        strokeOpacity={0.4}
      />
    </>
  );
}

function S7({ C, id }: SculptProps) {
  const spire = (
    cx: number,
    top: number,
    w: number,
    op: number,
    key: string
  ) => (
    <G key={key}>
      <Polygon
        points={poly([
          [cx - w, 86],
          [cx - w, top + w * 1.6],
          [cx, top],
          [cx + w, top + w * 1.6],
          [cx + w, 86],
        ])}
        fill={`url(#${id}g)`}
        stroke={C.gh}
        strokeWidth={0.9}
        strokeOpacity={0.7}
        opacity={op}
      />
      <Polygon
        points={poly([
          [cx, top],
          [cx + w, top + w * 1.6],
          [cx + w, 86],
          [cx, 86],
        ])}
        fill="#000"
        opacity={0.26}
      />
    </G>
  );
  return (
    <>
      <G filter={`url(#${id}glow)`}>
        {spire(28, 48, 7, 0.85, 'a')}
        {spire(72, 42, 7, 0.85, 'b')}
        {spire(39, 30, 6, 0.95, 'c')}
        {spire(61, 26, 6, 0.95, 'd')}
        {spire(50, 10, 9, 1, 'e')}
      </G>
      <Ellipse cx={50} cy={88} rx={30} ry={5} fill={C.a} opacity={0.5} />
    </>
  );
}

function S8({ C, id, fine }: SculptProps) {
  const HY = 54;
  const TOP = 28;
  const BOT = 80;
  const W = 15;
  const gem: Pt[] = [
    [50, TOP],
    [50 + W, HY],
    [50, BOT],
    [50 - W, HY],
  ];

  // Hairline horizon: 23 lines that thicken, lengthen, brighten and
  // sharpen as they approach the horizon line.
  const cloud = [];
  for (let i = -11; i <= 11; i++) {
    const k = 1 - Math.abs(i) / 11.6;
    const y = HY + i * 3.1;
    const w = 14 + k * 34;
    // Bucketed into three blur filters — 23 filter defs would cost
    // far more than the difference is worth at any render size.
    const blurId = k > 0.66 ? 'b04' : k > 0.33 ? 'b09' : 'b15';
    cloud.push(
      <Rect
        key={`c${i}`}
        x={50 - w}
        y={y}
        width={w * 2}
        height={0.6 + k * 2.2}
        rx={0.3 + k * 1.1}
        fill={`url(#${id}hl)`}
        opacity={0.1 + k * 0.78}
        filter={`url(#${id}${blurId})`}
      />
    );
  }

  const crown = [0.34, 0.68].map((k, i) => {
    const y = HY - (HY - TOP) * (1 - k);
    const w = W * k;
    return (
      <Polygon
        key={`cr${i}`}
        points={poly([
          [50 - w, y],
          [50 + w, y],
          [50 + W * (k + 0.16), HY],
          [50 - W * (k + 0.16), HY],
        ])}
        fill="none"
        stroke="#fff"
        strokeWidth={0.8}
        strokeOpacity={0.45 - i * 0.13}
      />
    );
  });

  const pav = [-1, 1].flatMap((s) => [
    ...[0.4, 0.75].map((k) => (
      <Line
        key={`p${s}${k}`}
        x1={50 + s * W * k}
        y1={HY}
        x2={50}
        y2={BOT}
        stroke={C.d}
        strokeWidth={0.8}
        strokeOpacity={0.35}
      />
    )),
    <Line
      key={`pe${s}`}
      x1={50 + s * W}
      y1={HY}
      x2={50}
      y2={BOT}
      stroke="#fff"
      strokeWidth={0.7}
      strokeOpacity={0.28}
    />,
  ]);

  const rays: Pt[] | number[][] = [
    [-12, 16, 0.8, 0.42],
    [-6.5, 26, 1.3, 0.75],
    [-2.6, 31, 1, 0.6],
    [0, 36, 2, 1],
    [2.6, 31, 1, 0.6],
    [6.5, 26, 1.3, 0.75],
    [12, 16, 0.8, 0.42],
  ] as number[][];

  return (
    <>
      <Ellipse
        cx={50}
        cy={HY}
        rx={50}
        ry={27}
        fill={C.gem}
        opacity={0.16}
        filter={`url(#${id}b12)`}
      />
      <Ellipse
        cx={50}
        cy={HY}
        rx={38}
        ry={17}
        fill={C.gem}
        opacity={0.24}
        filter={`url(#${id}b09x)`}
      />
      <Ellipse
        cx={50}
        cy={HY}
        rx={24}
        ry={10}
        fill={C.gem}
        opacity={0.34}
        filter={`url(#${id}b07)`}
      />
      <Ellipse
        cx={50}
        cy={HY}
        rx={13}
        ry={6}
        fill="#fff"
        opacity={0.38}
        filter={`url(#${id}b05)`}
      />
      {fine &&
        (
          [
            [34, 34],
            [66, 30],
            [42, 22],
            [60, 44],
            [30, 48],
            [70, 52],
          ] as Pt[]
        ).map(([x, y], i) => (
          <Circle
            key={`s${i}`}
            cx={x}
            cy={y}
            r={i % 2 ? 1 : 1.4}
            fill="#fff"
            opacity={i % 2 ? 0.45 : 0.7}
          />
        ))}
      {cloud}
      <Rect
        x={6}
        y={HY - 11}
        width={88}
        height={5}
        rx={2.5}
        fill={`url(#${id}au)`}
        opacity={0.34}
        filter={`url(#${id}b03)`}
      />
      <Rect
        x={6}
        y={HY - 6.5}
        width={88}
        height={4}
        rx={2}
        fill={`url(#${id}au)`}
        opacity={0.46}
        filter={`url(#${id}b024)`}
      />
      <Rect
        x={6}
        y={HY + 3.5}
        width={88}
        height={3.6}
        rx={1.8}
        fill={`url(#${id}au)`}
        opacity={0.38}
        filter={`url(#${id}b024)`}
      />
      <Rect
        x={6}
        y={HY + 8.5}
        width={88}
        height={3}
        rx={1.5}
        fill={`url(#${id}au)`}
        opacity={0.24}
        filter={`url(#${id}b03)`}
      />
      <G filter={`url(#${id}glow)`}>
        <Polygon
          points={poly(gem)}
          fill={`url(#${id}gm)`}
          stroke={`url(#${id}rim)`}
          strokeWidth={1.5}
          mask={`url(#${id}mk)`}
        />
      </G>
      <Polygon
        points={poly([
          [50, TOP],
          [50 + W, HY],
          [50 - W, HY],
        ])}
        fill="#fff"
        opacity={0.22}
        mask={`url(#${id}mk)`}
      />
      <Polygon
        points={poly([
          [50 - W, HY],
          [50 + W, HY],
          [50, BOT],
        ])}
        fill={C.d}
        opacity={0.2}
        mask={`url(#${id}mk)`}
      />
      <Ellipse
        cx={50 - W}
        cy={HY}
        rx={9}
        ry={13}
        fill={C.gem}
        opacity={0.4}
        filter={`url(#${id}b05)`}
      />
      <Ellipse
        cx={50 + W}
        cy={HY}
        rx={9}
        ry={13}
        fill={C.gem}
        opacity={0.4}
        filter={`url(#${id}b05)`}
      />
      {fine && crown}
      {fine && pav}
      {[-1, 1].flatMap((s) => {
        const x0 = 50 + s * (W - 1);
        return (rays as number[][]).map(([dy, len, th, op], i) => (
          <Path
            key={`g${s}${i}`}
            d={`M${x0.toFixed(1)},${(HY + dy * 0.45).toFixed(1)} Q${(x0 + s * len * 0.55).toFixed(1)},${(HY + dy * 0.8).toFixed(1)} ${(x0 + s * len).toFixed(1)},${(HY + dy).toFixed(1)}`}
            fill="none"
            stroke={`url(#${id}${s < 0 ? 'fadeL' : 'fade'})`}
            strokeWidth={th}
            strokeLinecap="round"
            opacity={op}
          />
        ));
      })}
      <Line
        x1={50 - W}
        y1={HY}
        x2={50 + W}
        y2={HY}
        stroke="#fff"
        strokeWidth={1.2}
        strokeOpacity={0.8}
      />
      {fine &&
        [-1, 1].flatMap((s) =>
          SPEC.slice(0, 2).map((c, i) => (
            <Line
              key={`d${s}${i}`}
              x1={50 + s * (3.5 + i * 6)}
              y1={HY + 1.6}
              x2={50 + s * (7.5 + i * 6)}
              y2={HY + 1.6}
              stroke={c}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeOpacity={0.85}
            />
          ))
        )}
      <Polygon
        points={poly([
          [50, 42],
          [56, HY],
          [50, 66],
          [44, HY],
        ])}
        fill="#fff"
        opacity={0.78}
      />
      {fine && (
        <>
          <Polygon
            points={poly([
              [50, 47],
              [53, HY],
              [50, 61],
              [47, HY],
            ])}
            fill={C.gem}
            opacity={0.5}
          />
          <Line
            x1={50}
            y1={42}
            x2={50}
            y2={66}
            stroke="#fff"
            strokeWidth={0.7}
            strokeOpacity={0.6}
          />
          {[-1, 1].flatMap((s) =>
            [0.5, 0.78].map((k) => (
              <Line
                key={`cf${s}${k}`}
                x1={50 + s * W * k}
                y1={HY}
                x2={50}
                y2={TOP + (HY - TOP) * 0.18}
                stroke="#fff"
                strokeWidth={0.6}
                strokeOpacity={0.3}
              />
            ))
          )}
          {[-1, 1].flatMap((s) => [
            <Circle
              key={`t1${s}`}
              cx={50 + s * (W + 4)}
              cy={HY}
              r={1.2}
              fill="#fff"
              opacity={0.8}
            />,
            <Circle
              key={`t2${s}`}
              cx={50 + s * (W + 13)}
              cy={HY}
              r={0.9}
              fill={C.gem}
              opacity={0.7}
            />,
            <Circle
              key={`t3${s}`}
              cx={50 + s * (W + 23)}
              cy={HY}
              r={0.7}
              fill={C.gem}
              opacity={0.45}
            />,
          ])}
        </>
      )}
    </>
  );
}

function S9({
  id,
  fine,
  spinProps,
  twkProps,
}: SculptProps & { spinProps: AnimProps; twkProps: AnimProps[] }) {
  const star: Pt[] = [];
  for (let i = 0; i < 16; i++) {
    const a = ((-90 + i * 22.5) * Math.PI) / 180;
    const r = i % 2 ? 36 : 16;
    star.push([50 + Math.cos(a) * r, 54 + Math.sin(a) * r]);
  }
  return (
    <>
      <AnimatedG animatedProps={spinProps}>
        <Polygon
          points={poly(star)}
          fill={`url(#${id}sp)`}
          stroke="#fff"
          strokeWidth={1.2}
          strokeOpacity={0.7}
          filter={`url(#${id}glowViolet)`}
        />
        {fine &&
          Array.from({ length: 8 }, (_, i) => {
            const a = ((-90 + i * 45) * Math.PI) / 180;
            return (
              <Polygon
                key={`f${i}`}
                points={`50,54 ${(50 + Math.cos(a) * 36).toFixed(1)},${(54 + Math.sin(a) * 36).toFixed(1)} ${(50 + Math.cos(a + 0.3927) * 16).toFixed(1)},${(54 + Math.sin(a + 0.3927) * 16).toFixed(1)}`}
                fill={SPEC[i % 5]}
                opacity={0.5}
              />
            );
          })}
      </AnimatedG>
      {fine &&
        [0, 1, 2, 3].map((i) => {
          const a = ((-120 + i * 70) * Math.PI) / 180;
          const x = 50 + Math.cos(a) * 40;
          const y = 54 + Math.sin(a) * 40;
          return (
            <AnimatedPolygon
              key={`fr${i}`}
              points={poly([
                [x, y - 4],
                [x + 3.4, y + 3],
                [x - 3.4, y + 3],
              ])}
              fill={SPEC[i % 5]}
              animatedProps={twkProps[i]}
            />
          );
        })}
      <Circle
        cx={50}
        cy={54}
        r={15}
        fill="#fff"
        filter={`url(#${id}glowPink)`}
      />
      <Circle cx={50} cy={54} r={8} fill={`url(#${id}sp)`} opacity={0.9} />
    </>
  );
}

type Props = {
  /** 0-based index into the ladder — 0 = Base … 8 = Free. */
  tier: number;
  /** Rendered width in px. Height is 1.16× so the ornaments, which
   *  deliberately overflow the frame, are not clipped. */
  size: number;
};

export function RankEmblem({ tier, size }: Props) {
  const t = Math.max(0, Math.min(TIERS.length - 1, Math.round(tier)));
  const C = TIERS[t];
  const id = `q${t}s${Math.round(size)}`;
  const fine = size >= 46;
  const rad = t === 8;

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      if (!cancelled) setReducedMotion(r);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (r) => {
        if (!cancelled) setReducedMotion(r);
      }
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  // Only Free animates, and only at fine sizes. Every other tier is
  // a single static frame.
  const animate = rad && fine && !reducedMotion;
  const rot = useSharedValue(0);
  const twk0 = useSharedValue(1);
  const twk1 = useSharedValue(1);
  const twk2 = useSharedValue(1);
  const twk3 = useSharedValue(1);

  useEffect(() => {
    const all = [twk0, twk1, twk2, twk3];
    if (!animate) {
      cancelAnimation(rot);
      rot.value = 0;
      all.forEach((v) => {
        cancelAnimation(v);
        v.value = 1;
      });
      return;
    }
    rot.value = withRepeat(
      withTiming(360, { duration: 60000, easing: Easing.linear }),
      -1,
      false
    );
    all.forEach((v, i) => {
      v.value = 0.35;
      v.value = withRepeat(
        withTiming(1, {
          duration: 1500 + i * 175,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true
      );
    });
    return () => {
      cancelAnimation(rot);
      all.forEach(cancelAnimation);
    };
  }, [animate, rot, twk0, twk1, twk2, twk3]);

  const spinProps = useAnimatedProps(() => ({
    transform: `rotate(${rot.value} 50 54)`,
  })) as AnimProps;
  const tw0 = useAnimatedProps(() => ({ opacity: twk0.value })) as AnimProps;
  const tw1 = useAnimatedProps(() => ({ opacity: twk1.value })) as AnimProps;
  const tw2 = useAnimatedProps(() => ({ opacity: twk2.value })) as AnimProps;
  const tw3 = useAnimatedProps(() => ({ opacity: twk3.value })) as AnimProps;
  const twkProps = [tw0, tw1, tw2, tw3];

  const frame = ring(C.sides, 42, 50, 53, -90);
  const inner = ring(C.sides, 33, 50, 53, -90);

  /* ── ornaments, gated by tier thresholds ── */
  const orn: React.ReactNode[] = [];

  if (t >= 3) {
    const g = Math.min(1, (t - 2) / 5);
    // Find where the frame crosses y=44 on the left so the shoulder
    // blade sits ON the edge instead of floating beside it.
    let bx = 42;
    for (let i = 0; i < frame.length; i++) {
      const [x1, y1] = frame[i];
      const [x2, y2] = frame[(i + 1) % frame.length];
      if ((y1 - 44) * (y2 - 44) <= 0 && y1 !== y2) {
        const x = x1 + (x2 - x1) * ((44 - y1) / (y2 - y1));
        if (x < 50) bx = 50 - x;
      }
    }
    const innE = bx - 4;
    const out = bx + 4 + g * 4;
    [-1, 1].forEach((s) => {
      const mg = `${id}${s < 0 ? 'mL' : 'm'}`;
      orn.push(
        <Polygon
          key={`sh${s}`}
          points={poly([
            [50 + s * innE, 44],
            [50 + s * out, 38],
            [50 + s * (innE + 4 + g * 3), 54],
          ])}
          fill={`url(#${mg})`}
          opacity={0.7 + g * 0.25}
        />
      );
      if (t >= 7) {
        orn.push(
          <Polygon
            key={`sh2${s}`}
            points={poly([
              [50 + s * (innE - 1), 38],
              [50 + s * (out - 2), 27],
              [50 + s * (innE + 4 + g * 3), 38.5],
            ])}
            fill={`url(#${mg})`}
            opacity={0.6 + g * 0.28}
          />,
          <Polyline
            key={`sh2l${s}`}
            points={poly([
              [50 + s * (innE - 1), 38],
              [50 + s * (out - 2), 27],
            ])}
            fill="none"
            stroke={C.hi}
            strokeWidth={0.7}
            strokeOpacity={0.45}
            strokeLinecap="round"
          />
        );
      }
    });
  }

  if (t >= 5 && fine) {
    // The tooth COUNT stops at three — past Peak only the
    // refinement grows: narrower teeth, a lit edge, then a jewel.
    const n = t === 5 ? 1 : 3;
    const ref = Math.max(0, t - 6);
    for (let i = 0; i < n; i++) {
      const mid = (n - 1) / 2;
      const d = Math.abs(i - mid);
      const x = 50 + (i - mid) * 10;
      const h = 13 - (3.8 * d) / (mid || 1);
      const w = 5 - d * 0.4 - ref * 0.5;
      orn.push(
        <Polygon
          key={`th${i}`}
          points={poly([
            [x - w, 15],
            [x, 15 - h],
            [x + w, 15],
          ])}
          fill={`url(#${id}${rad ? 'sp' : 'm'})`}
          stroke={C.hi}
          strokeWidth={0.6}
          strokeOpacity={0.5 + ref * 0.15}
        />
      );
      if (ref > 0)
        orn.push(
          <Polyline
            key={`thl${i}`}
            points={poly([
              [x - w, 15],
              [x, 15 - h],
            ])}
            fill="none"
            stroke="#fff"
            strokeWidth={0.8}
            strokeOpacity={0.3 + ref * 0.15}
            strokeLinecap="round"
          />
        );
      if (ref > 1 && d === 0)
        orn.push(
          <Circle
            key={`thj${i}`}
            cx={x}
            cy={15 - h - 2}
            r={1.3}
            fill="#fff"
            opacity={0.85}
          />
        );
    }
  }

  if (t >= 6 && fine) {
    orn.push(
      <Path
        key="lr"
        d="M26,71 C31,82 40,89 50,92"
        fill="none"
        stroke={C.hi}
        strokeWidth={2.2}
        strokeLinecap="round"
        opacity={0.5}
      />,
      <Path
        key="ll"
        d="M74,71 C69,82 60,89 50,92"
        fill="none"
        stroke={C.hi}
        strokeWidth={2.2}
        strokeLinecap="round"
        opacity={0.5}
      />
    );
  }

  if (rad && fine) {
    orn.push(
      <Polygon
        key="bs"
        points={poly([
          [43.5, 90],
          [50, 105],
          [56.5, 90],
        ])}
        fill={`url(#${id}sp)`}
        stroke={C.hi}
        strokeWidth={0.6}
        strokeOpacity={0.55}
      />,
      <Polyline
        key="bsl"
        points={poly([
          [43.5, 90],
          [50, 105],
        ])}
        fill="none"
        stroke="#fff"
        strokeWidth={0.8}
        strokeOpacity={0.4}
        strokeLinecap="round"
      />
    );
  }

  if (t >= 7 && fine) {
    const len = rad ? 11 : 9;
    const w = rad ? 4.6 : 3.6;
    [-1, 1].forEach((s) => {
      const bx = 50 + s * 41;
      const cy = 53;
      orn.push(
        <Polygon
          key={`fl${s}`}
          points={poly([
            [bx, cy - w],
            [bx + s * len, cy],
            [bx, cy + w],
          ])}
          fill={`url(#${id}${rad ? (s < 0 ? 'spL' : 'sp') : 'm'})`}
          stroke={C.hi}
          strokeWidth={0.55}
          strokeOpacity={0.5}
        />,
        <Polyline
          key={`fll${s}`}
          points={poly([
            [bx, cy - w],
            [bx + s * len, cy],
          ])}
          fill="none"
          stroke="#fff"
          strokeWidth={0.7}
          strokeOpacity={0.35}
          strokeLinecap="round"
        />
      );
    });
  }

  if (rad && fine) {
    [-146, -118, -62, -34].forEach((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const x = 50 + Math.cos(a) * 41.5;
      const y = 53 + Math.sin(a) * 41.5;
      const p = Math.round(Math.abs(deg + 90) / 25);
      orn.push(
        <AnimatedPolygon
          key={`sk${i}`}
          points={poly([
            [x, y - 3.4],
            [x + 2.9, y + 2.6],
            [x - 2.9, y + 2.6],
          ])}
          fill={SPEC[Math.min(p, 4)]}
          animatedProps={twkProps[i % 4]}
        />
      );
    });
  }

  // Scale against the face polygon's APOTHEM, not r=33, so no
  // sculpture is sliced by the clip path.
  const k = (33 * Math.cos(Math.PI / C.sides)) / 46;
  const STATIC = [S1, S2, S3, S4, S5, S6, S7, S8];
  const Sculpt = STATIC[Math.min(t, STATIC.length - 1)];

  return (
    <Svg width={size} height={Math.round(size * 1.16)} viewBox="-14 -8 128 124">
      <Defs>
        <LinearGradient id={`${id}m`} x1="0.18" y1="0" x2="0.82" y2="1">
          <Stop offset="0" stopColor={C.hi} />
          <Stop offset="0.22" stopColor={C.a} />
          <Stop offset="0.5" stopColor={C.d} />
          <Stop offset="0.78" stopColor={C.d} />
          <Stop offset="1" stopColor={C.a} stopOpacity={0.85} />
        </LinearGradient>
        {/* Mirror of `m` — mandatory for every left-hand ornament. */}
        <LinearGradient id={`${id}mL`} x1="0.82" y1="0" x2="0.18" y2="1">
          <Stop offset="0" stopColor={C.hi} />
          <Stop offset="0.22" stopColor={C.a} />
          <Stop offset="0.5" stopColor={C.d} />
          <Stop offset="0.78" stopColor={C.d} />
          <Stop offset="1" stopColor={C.a} stopOpacity={0.85} />
        </LinearGradient>
        <LinearGradient id={`${id}f`} x1="0.3" y1="0" x2="0.7" y2="1">
          <Stop offset="0" stopColor={C.d} />
          <Stop offset="0.55" stopColor="#0b1120" />
          <Stop offset="1" stopColor={C.d} />
        </LinearGradient>
        <LinearGradient id={`${id}g`} x1="0.22" y1="0" x2="0.72" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity={0.95} />
          <Stop offset="0.26" stopColor={C.gh} />
          <Stop offset="0.7" stopColor={C.gem} />
          <Stop offset="1" stopColor={C.d} />
        </LinearGradient>
        <LinearGradient id={`${id}e`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={C.gh} />
          <Stop offset="1" stopColor={C.gem} />
        </LinearGradient>
        <LinearGradient id={`${id}sp`} x1="0" y1="0" x2="1" y2="1">
          {SPEC.map((c, i) => (
            <Stop key={i} offset={(i / 4).toFixed(2)} stopColor={c} />
          ))}
        </LinearGradient>
        {/* Mirror of `sp` — Free's left-hand flank spike. */}
        <LinearGradient id={`${id}spL`} x1="1" y1="0" x2="0" y2="1">
          {SPEC.map((c, i) => (
            <Stop key={i} offset={(i / 4).toFixed(2)} stopColor={c} />
          ))}
        </LinearGradient>
        <RadialGradient id={`${id}h`}>
          <Stop offset="0.3" stopColor={C.a} stopOpacity={0.26 + t * 0.05} />
          <Stop offset="1" stopColor={C.a} stopOpacity={0} />
        </RadialGradient>

        <Filter id={`${id}glow`} x="-60%" y="-60%" width="220%" height="220%">
          <FeDropShadow
            dx="0"
            dy="0"
            stdDeviation="4"
            floodColor={C.gem}
            floodOpacity="0.85"
          />
        </Filter>
        <Filter
          id={`${id}glowPink`}
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
        >
          <FeDropShadow
            dx="0"
            dy="0"
            stdDeviation="6"
            floodColor="#ff7ab8"
            floodOpacity="0.85"
          />
        </Filter>
        <Filter
          id={`${id}glowViolet`}
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
        >
          <FeDropShadow
            dx="0"
            dy="0"
            stdDeviation="7"
            floodColor="#a978ec"
            floodOpacity="0.85"
          />
        </Filter>
        <Filter id={`${id}drop`} x="-40%" y="-40%" width="180%" height="180%">
          <FeDropShadow
            dx="0"
            dy="4"
            stdDeviation="4.5"
            floodColor="#000"
            floodOpacity="0.6"
          />
        </Filter>
        <Filter
          id={`${id}frameDrop`}
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <FeDropShadow
            dx="0"
            dy="5"
            stdDeviation="5.5"
            floodColor="#000"
            floodOpacity="0.6"
          />
        </Filter>

        {t === 7 && (
          <>
            <Filter
              id={`${id}b12`}
              x="-60%"
              y="-160%"
              width="220%"
              height="420%"
            >
              <FeGaussianBlur stdDeviation={sd(12)} />
            </Filter>
            <Filter
              id={`${id}b09x`}
              x="-60%"
              y="-160%"
              width="220%"
              height="420%"
            >
              <FeGaussianBlur stdDeviation={sd(9)} />
            </Filter>
            <Filter
              id={`${id}b07`}
              x="-60%"
              y="-160%"
              width="220%"
              height="420%"
            >
              <FeGaussianBlur stdDeviation={sd(7)} />
            </Filter>
            <Filter
              id={`${id}b05`}
              x="-60%"
              y="-160%"
              width="220%"
              height="420%"
            >
              <FeGaussianBlur stdDeviation={sd(5)} />
            </Filter>
            <Filter
              id={`${id}b03`}
              x="-40%"
              y="-300%"
              width="180%"
              height="700%"
            >
              <FeGaussianBlur stdDeviation={sd(3)} />
            </Filter>
            <Filter
              id={`${id}b024`}
              x="-40%"
              y="-300%"
              width="180%"
              height="700%"
            >
              <FeGaussianBlur stdDeviation={sd(2.4)} />
            </Filter>
            <Filter
              id={`${id}b04`}
              x="-40%"
              y="-400%"
              width="180%"
              height="900%"
            >
              <FeGaussianBlur stdDeviation={sd(0.4)} />
            </Filter>
            <Filter
              id={`${id}b09`}
              x="-40%"
              y="-400%"
              width="180%"
              height="900%"
            >
              <FeGaussianBlur stdDeviation={sd(0.9)} />
            </Filter>
            <Filter
              id={`${id}b15`}
              x="-40%"
              y="-400%"
              width="180%"
              height="900%"
            >
              <FeGaussianBlur stdDeviation={sd(1.5)} />
            </Filter>
            <LinearGradient id={`${id}hl`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={C.gem} stopOpacity={0} />
              <Stop offset="0.5" stopColor="#fff" />
              <Stop offset="1" stopColor={C.gem} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id={`${id}au`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={C.gem} stopOpacity={0} />
              <Stop offset="0.28" stopColor="#a978ec" stopOpacity={0.55} />
              <Stop offset="0.55" stopColor={C.gem} stopOpacity={0.8} />
              <Stop offset="0.8" stopColor="#ffc46b" stopOpacity={0.45} />
              <Stop offset="1" stopColor={C.gem} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id={`${id}rim`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={C.gem} stopOpacity={0.15} />
              <Stop offset="0.3" stopColor="#fff" stopOpacity={0.9} />
              <Stop offset="0.7" stopColor="#fff" stopOpacity={0.9} />
              <Stop offset="1" stopColor={C.gem} stopOpacity={0.15} />
            </LinearGradient>
            <LinearGradient id={`${id}mkg`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#000" />
              <Stop offset="0.22" stopColor="#888" />
              <Stop offset="0.42" stopColor="#fff" />
              <Stop offset="0.58" stopColor="#fff" />
              <Stop offset="0.78" stopColor="#888" />
              <Stop offset="1" stopColor="#000" />
            </LinearGradient>
            {/* Fades the marquise's flanks into the backdrop so the
                stone reads as straddling the horizon, not sitting
                on top of it. */}
            <Mask id={`${id}mk`}>
              <Rect
                x="0"
                y="0"
                width="100"
                height="100"
                fill={`url(#${id}mkg)`}
              />
            </Mask>
            <LinearGradient id={`${id}fade`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#ffffff" stopOpacity={0.85} />
              <Stop offset="0.35" stopColor={C.gem} stopOpacity={0.5} />
              <Stop offset="0.72" stopColor={C.gem} stopOpacity={0.2} />
              <Stop offset="1" stopColor={C.gem} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id={`${id}fadeL`} x1="1" y1="0" x2="0" y2="0">
              <Stop offset="0" stopColor="#ffffff" stopOpacity={0.85} />
              <Stop offset="0.35" stopColor={C.gem} stopOpacity={0.5} />
              <Stop offset="0.72" stopColor={C.gem} stopOpacity={0.2} />
              <Stop offset="1" stopColor={C.gem} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id={`${id}gm`} x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0" stopColor="#ffffff" />
              <Stop offset="0.3" stopColor={C.gem} />
              <Stop offset="0.58" stopColor="#a9c9ff" />
              <Stop offset="0.8" stopColor="#c9a6ff" />
              <Stop offset="1" stopColor={C.d} />
            </LinearGradient>
          </>
        )}

        <ClipPath id={`${id}cf`}>
          <Polygon points={poly(inner)} />
        </ClipPath>
      </Defs>

      <Circle cx={50} cy={53} r={60} fill={`url(#${id}h)`} />
      {orn}
      <Polygon
        points={poly(frame)}
        fill={`url(#${id}${rad ? 'sp' : 'm'})`}
        stroke={C.d}
        strokeWidth={1.5}
        filter={`url(#${id}frameDrop)`}
      />
      <Polygon
        points={poly(frame)}
        fill="none"
        stroke={C.hi}
        strokeWidth={1}
        strokeOpacity={0.28}
      />
      <Polygon
        points={poly(frame)}
        fill="none"
        stroke={C.d}
        strokeWidth={0.9}
        strokeOpacity={0.5}
      />
      <Polygon
        points={poly(inner)}
        fill={`url(#${id}f)`}
        stroke={C.hi}
        strokeWidth={0.9}
        strokeOpacity={0.4}
      />
      <G clipPath={`url(#${id}cf)`}>
        <G
          transform={`translate(50,53) scale(${k.toFixed(3)}) translate(-50,-54)`}
        >
          {rad ? (
            <S9
              C={C}
              id={id}
              fine={fine}
              spinProps={spinProps}
              twkProps={twkProps}
            />
          ) : (
            <Sculpt C={C} id={id} fine={fine} />
          )}
        </G>
      </G>
    </Svg>
  );
}

/** Emblem name for a tier — for callers that want the artwork's own
 *  label without going through the i18n ladder. */
export function rankEmblemName(tier: number) {
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, Math.round(tier)))].n;
}
