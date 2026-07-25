import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/**
 * Absolute-filling gradient backgrounds for the loadout sheet.
 *
 * The handoff describes every surface as a CSS `radial-gradient` /
 * `linear-gradient`. Those are RN-Web only — on iOS and Android
 * `backgroundImage` is ignored outright and the surface renders flat,
 * which is exactly how the Journey mountains and the module auroras
 * disappeared on device before they were ported to SVG.
 *
 * So each gradient is an `<Svg>` rect instead. Two rules learned the
 * hard way and repeated here:
 *
 * - `gradientUnits="userSpaceOnUse"` with numeric coordinates. The
 *   percentage (`objectBoundingBox`) form is unreliable on native.
 * - Gradient ids come from a module-level counter. `useId()` emits
 *   `:r0:`, which is not a valid SVG id, and hardcoded ids collide in
 *   react-native-svg's shared registry once two instances mount.
 *
 * The viewBox is a fixed 100×100 user space with
 * `preserveAspectRatio="none"`, so coordinates read as percentages of
 * the box — the same mental model as the CSS the design was authored
 * in.
 */

let fillSeq = 0;

export type GradientStop = {
  /** 0–100. */
  offset: number;
  color: string;
  opacity: number;
};

type RadialProps = {
  /** Centre, in 0–100 box space. May sit outside the box. */
  cx: number;
  cy: number;
  /** Radii, in 0–100 box space. */
  rx: number;
  ry: number;
  stops: GradientStop[];
};

export function RadialFill({ cx, cy, rx, ry, stops }: RadialProps) {
  const id = useRef(`pickRad${(fillSeq += 1)}`).current;
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <RadialGradient
          id={id}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fx={cx}
          fy={cy}
          gradientUnits="userSpaceOnUse"
        >
          {stops.map((s) => (
            <Stop
              key={s.offset}
              offset={`${s.offset}%`}
              stopColor={s.color}
              stopOpacity={s.opacity}
            />
          ))}
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

type LinearProps = {
  /** Endpoints in 0–100 box space. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: GradientStop[];
};

export function LinearFill({ x1, y1, x2, y2, stops }: LinearProps) {
  const id = useRef(`pickLin${(fillSeq += 1)}`).current;
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient
          id={id}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          gradientUnits="userSpaceOnUse"
        >
          {stops.map((s) => (
            <Stop
              key={s.offset}
              offset={`${s.offset}%`}
              stopColor={s.color}
              stopOpacity={s.opacity}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

type DashedProps = {
  /** Edge length of the (square) box in pt. */
  size: number;
  radius: number;
  stroke: string;
  fill: string;
};

/**
 * Dashed rounded square for an empty socket.
 *
 * `borderStyle: 'dashed'` combined with `borderRadius` is the obvious
 * RN answer and the wrong one — Android silently falls back to a solid
 * border and iOS renders the corners inconsistently. An SVG rect with
 * `strokeDasharray` looks identical on all three platforms.
 */
export function DashedBox({ size, radius, stroke, fill }: DashedProps) {
  const inset = 0.75; // half the 1.5pt stroke, so it lands inside the box
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width={size}
      height={size}
    >
      <Rect
        x={inset}
        y={inset}
        width={size - inset * 2}
        height={size - inset * 2}
        rx={radius - inset}
        ry={radius - inset}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray="6 5"
      />
    </Svg>
  );
}
