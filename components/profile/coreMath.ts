/**
 * Pure geometry for the Core hero. No React, no RN — every function
 * here is a plain number cruncher so the hero component stays about
 * composition and the SVG maths stays testable in isolation.
 */

/** Hero canvas is a fixed square; all radii below are relative to it. */
export const HERO_SIZE = 290;
/** Rank-ring radius. */
export const RING_R = 76;
/** Gap between two ring segments, in path units. */
export const RING_GAP = 7;
/** One segment per rank in the 9-step ladder. */
export const RING_SEGMENTS = 9;

/** Ring circumference. */
export const RING_C = 2 * Math.PI * RING_R;
/** Arc length of a single segment once the nine gaps are removed. */
export const RING_SEG_LEN = (RING_C - RING_SEGMENTS * RING_GAP) / RING_SEGMENTS;

export type RingSegment = {
  index: number;
  /** `strokeDasharray` — draw `len`, then skip the rest of the circle. */
  dashArray: string;
  /** `strokeDashoffset` that rotates this segment into its slot. */
  dashOffset: number;
};

/**
 * The nine dash windows that make one circle look like nine arcs.
 *
 * Each segment is the *same* full-circumference dash pattern rotated
 * by a negative offset — that is why they can all share one `<Circle>`
 * radius and still animate independently: only the offset differs.
 */
export function ringSegments(): RingSegment[] {
  return Array.from({ length: RING_SEGMENTS }, (_, index) => ({
    index,
    dashArray: `${RING_SEG_LEN} ${RING_C - RING_SEG_LEN}`,
    dashOffset: -index * (RING_SEG_LEN + RING_GAP),
  }));
}

/** Widest the filament fan ever opens — the design's five-addiction case. */
const FAN_MAX_SPAN = 250;
/** Angular breathing room between two neighbouring filaments. */
const FAN_STEP = 70;

/**
 * Where a filament points, in degrees (0° = right, -90° = up).
 *
 * The fan is always centred on straight-up and its opening is always
 * at the bottom, where the rank name and points block sits. The span
 * grows with the number of addictions instead of being fixed at 250°:
 * a fixed span would fling two addictions out to the horizon and leave
 * the whole upper half of the ring bare. At five — the design's
 * reference case — this resolves to exactly the specified 250°.
 */
export function filamentAngle(index: number, count: number): number {
  if (count <= 1) return -90;
  const span = Math.min(FAN_MAX_SPAN, FAN_STEP * (count - 1));
  return -90 - span / 2 + index * (span / (count - 1));
}

/** Polar → cartesian around the hero centre. */
export function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const c = HERO_SIZE / 2;
  return { x: c + Math.cos(rad) * radius, y: c + Math.sin(rad) * radius };
}

/**
 * Filled-area path for the weekly sparkline in the LIFETIME panel.
 *
 * Closes down to the baseline so it can carry a gradient fill, and
 * normalises against the series max (not min→max) so a week of
 * low-but-nonzero days still reads as low instead of being stretched
 * to full height.
 */
export function sparkAreaPath(
  values: readonly number[],
  width: number,
  height: number,
  pad = 4
): { line: string; area: string } {
  if (values.length < 2) return { line: '', area: '' };
  const max = Math.max(1, ...values);
  const innerH = height - pad * 2;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => ({
    x: i * stepX,
    y: pad + (1 - v / max) * innerH,
  }));
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return { line, area };
}
