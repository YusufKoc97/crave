import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { DAY_KEYS } from '@/constants/heatmap';
import type { TriggerMapPeak, TriggerMapTrigger } from '@/lib/triggerMap';
import { t } from '@/lib/i18n';
import {
  ADDICTION_TRIGGERS,
  COMMON_TRIGGERS,
  triggerLabel,
} from '@/constants/triggerCatalog';
import {
  triggersAccent,
  triggersAccentAlpha,
  triggersColorFor,
  triggersHexAlpha,
  triggersSurface,
} from './triggersTheme';

/**
 * Peak Hours — Modül 3 redesign.
 *
 * Two layers:
 *   1. Radial 24h clock — subtle tick ring, glow at each peak
 *      window, white dot tips at each arc's leading edge, thin
 *      needle to the strongest peak, big centered total.
 *   2. Rich peak cards — rank badge, day + range label, per-hour
 *      histogram strip (heights ∝ craving count so intensity
 *      is legible at a glance), plus trigger tags derived from
 *      the overall distribution.
 *
 * The window around each peak is a 3-hour cluster (peak.hour-1
 * through peak.hour+1), so a "8 PM" peak reads as "7-10 PM" like
 * a person would describe it in conversation.
 */

type Props = {
  peaks: TriggerMapPeak[];
  /** Full [day][hour] counts — used to draw the histogram bars. */
  heatmap: number[][];
  /** Full distribution — used to pick top tags. */
  triggers: TriggerMapTrigger[];
  /** Which addiction we're in — needed for trigger label lookups. */
  addictionId: string;
  /** Kept for API compat — module now paints from its own violet. */
  accentColor?: string;
};

const CLOCK_SIZE = 220;
const CLOCK_STROKE_MAJOR = 2;
const CLOCK_STROKE_MINOR = 1;
const CLOCK_TICK_LEN_MAJOR = 10;
const CLOCK_TICK_LEN_MINOR = 5;
const CLOCK_ARC_STROKE = 9;
/** How many hours around each peak to include in its window. */
const PEAK_WINDOW_RADIUS = 1;

function formatHour12(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${suffix}`;
}

/**
 * "7-10 PM" style range label. `startHour` inclusive, `endHourExc`
 * is one PAST the last window hour so a 3-hour cluster (hours
 * 19, 20, 21) reads as "7-10 PM".
 */
function formatWindowLabel(startHour: number, endHourExc: number): string {
  const startSuffix = ((startHour % 24) + 24) % 24 < 12 ? 'AM' : 'PM';
  const endSuffix = ((endHourExc % 24) + 24) % 24 < 12 ? 'AM' : 'PM';
  const start12 = (startHour % 12 || 12).toString();
  const end12 = (endHourExc % 12 || 12).toString();
  if (startSuffix === endSuffix) return `${start12}-${end12} ${endSuffix}`;
  return `${start12} ${startSuffix} - ${end12} ${endSuffix}`;
}

export function PeakHoursList({
  peaks,
  heatmap,
  triggers,
  addictionId,
  accentColor,
}: Props) {
  void accentColor;

  // Windows: [peak-r ... peak+r] inclusive on both ends → the
  // histogram bars + count reflect the true 3-hour block. The
  // label formatter turns that into "7-10 PM" (end-exclusive).
  const enrichedPeaks = useMemo(
    () =>
      peaks.map((peak) => {
        const startHour = Math.max(0, peak.hour - PEAK_WINDOW_RADIUS);
        const endHourInc = Math.min(23, peak.hour + PEAK_WINDOW_RADIUS);
        const dayRow = heatmap[peak.day] ?? [];
        let windowCount = 0;
        for (let h = startHour; h <= endHourInc; h++) {
          windowCount += dayRow[h] ?? 0;
        }
        return {
          ...peak,
          startHour,
          endHourInc,
          windowCount: Math.max(peak.count, windowCount),
          hourlyCounts: dayRow.slice(),
        };
      }),
    [peaks, heatmap]
  );

  // For the radial clock's total ring value — sum every peak's
  // windowCount so the big number is meaningful even when the
  // Edge Function only returns 3 peaks.
  const clockTotal = enrichedPeaks.reduce((sum, p) => sum + p.windowCount, 0);

  // Top-2 triggers → tag chips per card (we don't have per-peak
  // trigger data from the Edge Function yet, so approximate with
  // the overall distribution's leaders).
  const topTriggerIds = triggers.slice(0, 2).map((row) => row.trigger_id);

  if (peaks.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.subtitle}>
        {t('trigger_map.peak_hours.subtitle')}
      </Text>

      <View style={styles.clockWrap}>
        <RadialClock peaks={enrichedPeaks} total={clockTotal} />
      </View>

      {enrichedPeaks.map((peak, idx) => {
        const dayKey = DAY_KEYS[peak.day] ?? 'mon';
        const dayLabel = t(`trigger_map.heatmap.days_long.${dayKey}`);
        return (
          <PeakCard
            key={`${peak.day}-${peak.hour}`}
            rank={idx + 1}
            dayLabel={dayLabel}
            rangeLabel={formatWindowLabel(peak.startHour, peak.endHourInc + 1)}
            count={peak.windowCount}
            hourlyCounts={peak.hourlyCounts}
            windowStart={peak.startHour}
            windowEnd={peak.endHourInc}
            triggerIds={topTriggerIds}
            addictionId={addictionId}
          />
        );
      })}
    </View>
  );
}

// ─────────────────────── Radial 24h clock ───────────────────────

type EnrichedPeak = TriggerMapPeak & {
  startHour: number;
  /** Last hour that's part of the window (inclusive). */
  endHourInc: number;
  windowCount: number;
  hourlyCounts: number[];
};

function RadialClock({
  peaks,
  total,
}: {
  peaks: EnrichedPeak[];
  total: number;
}) {
  const cx = CLOCK_SIZE / 2;
  const cy = CLOCK_SIZE / 2;
  const outerR = CLOCK_SIZE / 2 - 4;
  const arcR = outerR - 20;
  const innerGuideR = arcR - 16;

  // Order arcs weakest-first so the strongest paints on top.
  const sortedPeaks = useMemo(
    () => [...peaks].sort((a, b) => a.windowCount - b.windowCount),
    [peaks]
  );
  const strongestPeak = useMemo(
    () =>
      peaks.reduce(
        (best, p) => (p.windowCount > (best?.windowCount ?? -1) ? p : best),
        peaks[0]
      ),
    [peaks]
  );

  // 24 tick marks, majors at 0/6/12/18.
  const ticks = useMemo(() => {
    const out: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      major: boolean;
    }[] = [];
    for (let h = 0; h < 24; h++) {
      const major = h % 6 === 0;
      const angle = hourToRadians(h);
      const tickLen = major ? CLOCK_TICK_LEN_MAJOR : CLOCK_TICK_LEN_MINOR;
      const x1 = cx + (outerR - tickLen) * Math.cos(angle);
      const y1 = cy + (outerR - tickLen) * Math.sin(angle);
      const x2 = cx + outerR * Math.cos(angle);
      const y2 = cy + outerR * Math.sin(angle);
      out.push({ x1, y1, x2, y2, major });
    }
    return out;
  }, [cx, cy, outerR]);

  // Cardinal labels (12A / 6A / 12P / 6P) — sit just outside the
  // ring so the arc geometry has room to breathe inside.
  const cardinals = useMemo(() => {
    const labelR = outerR + 12;
    return (
      [
        { hour: 0, text: '12A', dx: 0, dy: 4 },
        { hour: 6, text: '6A', dx: 0, dy: 4 },
        { hour: 12, text: '12P', dx: 0, dy: 4 },
        { hour: 18, text: '6P', dx: 0, dy: 4 },
      ] as const
    ).map(({ hour, text, dx, dy }) => {
      const angle = hourToRadians(hour);
      return {
        text,
        x: cx + labelR * Math.cos(angle) + dx,
        y: cy + labelR * Math.sin(angle) + dy,
      };
    });
  }, [cx, cy, outerR]);

  const svgSize = CLOCK_SIZE + 28; // room for cardinal labels
  const offset = 14;

  return (
    <Svg width={svgSize} height={svgSize}>
      <Defs>
        <RadialGradient id="clockGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={triggersAccent} stopOpacity={0.22} />
          <Stop offset="100%" stopColor={triggersAccent} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <G x={offset} y={offset}>
        {/* Inner ambient glow. */}
        <Circle cx={cx} cy={cy} r={arcR + 2} fill="url(#clockGlow)" />

        {/* Base ring — subtle full circle so ticks feel anchored. */}
        <Circle
          cx={cx}
          cy={cy}
          r={outerR}
          stroke={triggersAccentAlpha(0.14)}
          strokeWidth={1}
          fill="none"
        />

        {/* Inner guide ring (super subtle). */}
        <Circle
          cx={cx}
          cy={cy}
          r={innerGuideR}
          stroke={triggersAccentAlpha(0.14)}
          strokeWidth={1}
          fill="none"
        />

        {/* Tick marks. */}
        <G>
          {ticks.map((tick, i) => (
            <Line
              key={i}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke={
                tick.major
                  ? triggersAccentAlpha(0.6)
                  : triggersAccentAlpha(0.25)
              }
              strokeWidth={tick.major ? CLOCK_STROKE_MAJOR : CLOCK_STROKE_MINOR}
              strokeLinecap="round"
            />
          ))}
        </G>

        {/* Peak arcs + white-dot tips at both ends of each arc. */}
        <G>
          {sortedPeaks.map((peak) => {
            const isTop =
              peak.hour === strongestPeak?.hour &&
              peak.day === strongestPeak?.day;
            const alpha = isTop ? 0.95 : 0.5;
            const arcStartH = peak.startHour;
            const arcEndH = peak.endHourInc + 1; // inclusive → +1 span
            const start = hourToRadians(arcStartH);
            const end = hourToRadians(arcEndH);
            const d = describeArc(cx, cy, arcR, start, end);
            const leadX = cx + arcR * Math.cos(end);
            const leadY = cy + arcR * Math.sin(end);
            const tailX = cx + arcR * Math.cos(start);
            const tailY = cy + arcR * Math.sin(start);
            return (
              <G key={`${peak.day}-${peak.hour}`}>
                <Path
                  d={d}
                  stroke={triggersAccentAlpha(alpha)}
                  strokeWidth={CLOCK_ARC_STROKE}
                  strokeLinecap="round"
                  fill="none"
                />
                {/* White dot tips — start (dim) + end (bright) so the
                    arc's direction reads as "swelling toward peak". */}
                <Circle
                  cx={tailX}
                  cy={tailY}
                  r={2.6}
                  fill="#FFFFFF"
                  fillOpacity={0.55}
                />
                <Circle
                  cx={leadX}
                  cy={leadY}
                  r={3.2}
                  fill="#FFFFFF"
                  fillOpacity={0.95}
                />
              </G>
            );
          })}
        </G>

        {/* Thin needle from center to the strongest peak's midpoint. */}
        {strongestPeak
          ? (() => {
              const midHour =
                (strongestPeak.startHour + strongestPeak.endHourInc + 1) / 2;
              const angle = hourToRadians(midHour);
              const nx = cx + (arcR - 6) * Math.cos(angle);
              const ny = cy + (arcR - 6) * Math.sin(angle);
              return (
                <G>
                  <Line
                    x1={cx}
                    y1={cy}
                    x2={nx}
                    y2={ny}
                    stroke={triggersAccent}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeOpacity={0.85}
                  />
                  <Circle cx={nx} cy={ny} r={3} fill="#FFFFFF" />
                  <Circle cx={cx} cy={cy} r={3} fill={triggersAccent} />
                </G>
              );
            })()
          : null}

        {/* Cardinal labels. */}
        <G>
          {cardinals.map((c) => (
            <SvgText
              key={c.text}
              x={c.x}
              y={c.y}
              fill="#8FA5CC"
              fontSize={11}
              fontWeight="700"
              textAnchor="middle"
            >
              {c.text}
            </SvgText>
          ))}
        </G>

        {/* Center total + kicker. */}
        <SvgText
          x={cx}
          y={cy - 2}
          fill="#F1F5FF"
          fontSize={30}
          fontWeight="800"
          textAnchor="middle"
        >
          {String(total)}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 16}
          fill={triggersAccent}
          fontSize={9}
          fontWeight="700"
          letterSpacing="1.4"
          textAnchor="middle"
        >
          PEAK CRAVINGS
        </SvgText>
      </G>
    </Svg>
  );
}

/** Map an "hour" (0-24) to a clock-face angle in radians (12A = top). */
function hourToRadians(hour: number): number {
  const normalized = ((hour % 24) + 24) % 24;
  return (normalized / 24) * Math.PI * 2 - Math.PI / 2;
}

/** SVG arc path from start→end radian angles at (cx, cy, r). */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = {
    x: cx + r * Math.cos(startAngle),
    y: cy + r * Math.sin(startAngle),
  };
  const end = {
    x: cx + r * Math.cos(endAngle),
    y: cy + r * Math.sin(endAngle),
  };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  ].join(' ');
}

// ─────────────────────── Rich peak cards ───────────────────────

function PeakCard({
  rank,
  dayLabel,
  rangeLabel,
  count,
  hourlyCounts,
  windowStart,
  windowEnd,
  triggerIds,
  addictionId,
}: {
  rank: number;
  dayLabel: string;
  rangeLabel: string;
  count: number;
  hourlyCounts: number[];
  windowStart: number;
  windowEnd: number;
  triggerIds: string[];
  addictionId: string;
}) {
  const isTop = rank === 1;
  return (
    <View style={[styles.peakCard, isTop && styles.peakCardTop]}>
      <View style={styles.peakHeadRow}>
        <View
          style={[
            styles.rankBadge,
            isTop
              ? styles.rankBadgeTop
              : {
                  backgroundColor: triggersAccentAlpha(0.12),
                  borderColor: triggersAccentAlpha(0.35),
                },
          ]}
        >
          <Text
            style={[
              styles.rankText,
              { color: isTop ? '#FFFFFF' : triggersAccent },
            ]}
          >
            {rank}
          </Text>
        </View>
        <View style={styles.peakTitleCol}>
          <Text style={styles.dayText} numberOfLines={1}>
            {dayLabel}
          </Text>
          <Text style={styles.rangeText} numberOfLines={1}>
            {rangeLabel}
          </Text>
        </View>
        <View style={styles.countCol}>
          <Text style={styles.countText}>{count}</Text>
          <Text style={styles.cravingsLabel}>CRAVINGS</Text>
        </View>
      </View>

      <PeakHistogramStrip
        hourlyCounts={hourlyCounts}
        windowStart={windowStart}
        windowEnd={windowEnd}
        isTop={isTop}
      />

      {triggerIds.length > 0 ? (
        <View style={styles.tagRow}>
          {triggerIds.map((id) => (
            <TriggerTag key={id} triggerId={id} addictionId={addictionId} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * 24-cell strip where each cell's HEIGHT reflects that hour's
 * craving count (relative to the day's max). Cells inside the
 * peak window use the violet accent; the rest render as
 * faint grey scaffolding so the peak reads as a "swell" against
 * a hush background.
 */
function PeakHistogramStrip({
  hourlyCounts,
  windowStart,
  windowEnd,
  isTop,
}: {
  hourlyCounts: number[];
  windowStart: number;
  windowEnd: number;
  isTop: boolean;
}) {
  const stripWidth = 288;
  const stripHeight = 22;
  const gap = 2;
  const cellW = (stripWidth - gap * 23) / 24;
  const dayMax = Math.max(1, ...hourlyCounts);
  const inWindowAlpha = isTop ? 0.95 : 0.7;
  return (
    <View style={{ width: stripWidth, height: stripHeight, marginTop: 10 }}>
      <Svg width={stripWidth} height={stripHeight}>
        {Array.from({ length: 24 }, (_, i) => {
          const count = hourlyCounts[i] ?? 0;
          const isInWindow = i >= windowStart && i <= windowEnd;
          // Minimum height so empty hours still show scaffolding.
          const baseH = 3;
          const scaledH = Math.max(
            baseH,
            Math.round((count / dayMax) * (stripHeight - 2))
          );
          const y = stripHeight - scaledH;
          const fill = isInWindow
            ? triggersAccentAlpha(inWindowAlpha)
            : 'rgba(255,255,255,0.08)';
          return (
            <Rect
              key={i}
              x={i * (cellW + gap)}
              y={y}
              width={cellW}
              height={scaledH}
              rx={1.2}
              ry={1.2}
              fill={fill}
            />
          );
        })}
      </Svg>
    </View>
  );
}

function TriggerTag({
  triggerId,
  addictionId,
}: {
  triggerId: string;
  addictionId: string;
}) {
  const color = triggersColorFor(triggerId);
  const label = resolveTriggerLabel(triggerId, addictionId);
  return (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: triggersHexAlpha(color, 0.14),
          borderColor: triggersHexAlpha(color, 0.4),
        },
      ]}
    >
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

function resolveTriggerLabel(id: string, addictionId: string): string {
  if (COMMON_TRIGGERS.some((row) => row.id === id)) {
    return triggerLabel({ id, scope: 'common', displayOrder: 0 });
  }
  const list = ADDICTION_TRIGGERS[addictionId] ?? [];
  if (list.some((row) => row.id === id)) {
    return triggerLabel({ id, scope: addictionId, displayOrder: 0 });
  }
  return id;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: triggersSurface.bg,
    borderWidth: 1,
    borderColor: triggersSurface.border,
    borderRadius: triggersSurface.radius,
    paddingVertical: 18,
    paddingHorizontal: 16,
    ...Platform.select({
      web: {
        boxShadow: `0 8px 26px ${triggersAccentAlpha(0.14)}`,
      },
      default: {
        shadowColor: triggersAccent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 3,
      },
    }),
  },
  subtitle: {
    color: '#8FA5CC',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  clockWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  peakCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  peakCardTop: {
    backgroundColor: triggersAccentAlpha(0.09),
    borderColor: triggersAccentAlpha(0.4),
  },
  peakHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankBadgeTop: {
    backgroundColor: triggersAccent,
    borderColor: triggersAccent,
    ...Platform.select({
      web: {
        boxShadow: `0 0 14px ${triggersAccentAlpha(0.7)}`,
      },
      default: {
        shadowColor: triggersAccent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.75,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  rankText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  peakTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  dayText: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  rangeText: {
    color: '#8FA5CC',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  countCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 24,
  },
  cravingsLabel: {
    color: triggersAccentAlpha(0.75),
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 1,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

// Kept for API compat with earlier callers that formatted rows
// externally — not used by this component but exported so tests
// or shared utilities can reuse the 12h formatter.
export { formatHour12 };
