/**
 * Bell-curve math shared between DistributionCard + StandingCard.
 *
 * `bellPath` builds an SVG path string for a gaussian curve with
 * closed-underline (base line) so it can be filled AND stroked
 * with the same path (the fill LinearGradient sits underneath,
 * the stroke draws the top line). Uses the same 6σ virtual
 * window the prototype uses so the ends touch the baseline
 * cleanly at both edges.
 *
 * `erf` + `phi` are the standard-normal CDF approximation used
 * to convert a z-score into a percentile — "N% of the community
 * scored below you". Numerical constants are Abramowitz &
 * Stegun 7.1.26; error < 1.5e-7 across the whole real line —
 * plenty for a UI percentile chip.
 */

/**
 * Build the SVG path for a gaussian curve. Path is closed at
 * both ends by drawing back to the baseline so a `fill` renders
 * as a filled hill rather than an open squiggle.
 *
 * @param width  Total width in SVG user units.
 * @param base   Y-coordinate of the baseline (where the curve
 *               starts + ends).
 * @param amp    Vertical amplitude — peak height above baseline.
 * @param step   Horizontal sampling step; smaller = smoother.
 */
export function bellPath(
  width: number,
  base: number,
  amp: number,
  step = 5
): string {
  let d = `M0,${base}`;
  for (let x = 0; x <= width; x += step) {
    // Map x∈[0,width] to gaussian t∈[-3,3] — same 6σ window
    // the design prototype uses so both ends kiss the baseline.
    const t = (x / width - 0.5) * 6;
    const y = base - Math.exp((-t * t) / 2) * amp;
    d += ` L${x},${y.toFixed(1)}`;
  }
  d += ` L${width},${base} Z`;
  return d;
}

/**
 * Build the "your zone" second-bell fill for StandingCard —
 * a sub-hill from the user's X position to the right edge that
 * highlights the section of the curve the user occupies.
 */
export function bellZonePath(
  width: number,
  base: number,
  amp: number,
  userX: number,
  step = 6
): string {
  const t0 = (userX / width - 0.5) * 6;
  const y0 = base - Math.exp((-t0 * t0) / 2) * amp;
  let d = `M${userX.toFixed(1)},${y0.toFixed(1)}`;
  for (let x = userX; x <= width; x += step) {
    const t = (x / width - 0.5) * 6;
    const y = base - Math.exp((-t * t) / 2) * amp;
    d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
  }
  d += ` L${width},${base} L${userX.toFixed(1)},${base} Z`;
  return d;
}

/**
 * Given a z-score, return the point on the bell (in SVG coords)
 * where the user's dot should sit. Clamped to ±2.9σ so extreme
 * outliers don't fall off the visible curve.
 */
export function bellPointForZ(
  width: number,
  base: number,
  amp: number,
  z: number
): { x: number; y: number; xPct: number } {
  const zc = Math.max(-2.9, Math.min(2.9, z));
  const xPct = (zc / 6 + 0.5) * 100; // 0..100
  const x = (xPct / 100) * width;
  const t = (x / width - 0.5) * 6;
  const y = base - Math.exp((-t * t) / 2) * amp;
  return { x, y, xPct };
}

/**
 * Abramowitz & Stegun 7.1.26 approximation for the Gauss error
 * function. Used only as input to `phi`; not exposed to callers.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/**
 * Standard-normal CDF Φ(z). Returns a probability in [0, 1] —
 * "share of the community with a value ≤ this z-score".
 */
export function phi(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}
