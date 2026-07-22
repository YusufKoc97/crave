import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
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
/** Min/max stroke thickness for hourly arc segments. */
const ARC_STROKE_MIN = 3;
const ARC_STROKE_MAX = 14;
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
        <RadialClock heatmap={heatmap} total={clockTotal} />
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

function RadialClock({
  heatmap,
  total,
}: {
  heatmap: number[][];
  total: number;
}) {
  const cx = CLOCK_SIZE / 2;
  const cy = CLOCK_SIZE / 2;
  const outerR = CLOCK_SIZE / 2 - 4;
  const arcR = outerR - 16;

  // Aggregate craving count per hour of day across the week.
  // Each of the 24 hours becomes one arc segment whose thickness +
  // opacity map to that hour's total count. The busier the hour,
  // the fatter and darker its segment reads.
  const hourlyTotals = useMemo(() => {
    const out: number[] = Array.from({ length: 24 }, () => 0);
    for (let d = 0; d < 7; d++) {
      const row = heatmap[d] ?? [];
      for (let h = 0; h < 24; h++) out[h] += row[h] ?? 0;
    }
    return out;
  }, [heatmap]);
  const maxHour = Math.max(1, ...hourlyTotals);

  // Cardinal labels — sit just outside the ring so the arcs breathe.
  const cardinals = useMemo(() => {
    const labelR = outerR + 12;
    return (
      [
        { hour: 0, text: '12A' },
        { hour: 6, text: '6A' },
        { hour: 12, text: '12P' },
        { hour: 18, text: '6P' },
      ] as const
    ).map(({ hour, text }) => {
      const angle = hourToRadians(hour);
      return {
        text,
        x: cx + labelR * Math.cos(angle),
        y: cy + labelR * Math.sin(angle) + 4,
      };
    });
  }, [cx, cy, outerR]);

  const svgSize = CLOCK_SIZE + 28;
  const offset = 14;

  return (
    <Svg width={svgSize} height={svgSize}>
      <Defs>
        <RadialGradient id="clockGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={triggersAccent} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={triggersAccent} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <G x={offset} y={offset}>
        {/* Inner ambient glow. */}
        <Circle cx={cx} cy={cy} r={arcR + 2} fill="url(#clockGlow)" />

        {/* Base ring — one continuous hairline showing the 24h
            frame. No ticks, no marks, no extra dots. */}
        <Circle
          cx={cx}
          cy={cy}
          r={arcR}
          stroke={triggersAccentAlpha(0.1)}
          strokeWidth={1}
          fill="none"
        />

        {/* Per-hour arc segments — one per hour with a non-zero
            count. Thickness + alpha scale with count/maxHour so a
            busy 8 PM hour visibly towers over a quiet 4 AM. */}
        <G>
          {hourlyTotals.map((count, hour) => {
            if (count <= 0) return null;
            const ratio = count / maxHour;
            const stroke =
              ARC_STROKE_MIN + ratio * (ARC_STROKE_MAX - ARC_STROKE_MIN);
            const alpha = 0.35 + ratio * 0.6;
            // Slight overlap between neighbours (0.02 rad ≈ 1°) so
            // consecutive busy hours read as one thicker band.
            const pad = 0.02;
            const start = hourToRadians(hour) - pad;
            const end = hourToRadians(hour + 1) + pad;
            const d = describeArc(cx, cy, arcR, start, end);
            return (
              <Path
                key={hour}
                d={d}
                stroke={triggersAccentAlpha(alpha)}
                strokeWidth={stroke}
                strokeLinecap="butt"
                fill="none"
              />
            );
          })}
        </G>

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
 * craving count. Bars inside the peak window paint in violet with
 * dramatic height variation (a 5-count hour towers over a 1-count
 * hour so the "peak within the peak" is obvious at a glance).
 * Non-window hours stay as a flat, faint baseline so the eye
 * doesn't have to disambiguate — the swell inside the window IS
 * the story.
 *
 * Height scales COUNT-DIRECTLY (units of px per craving) rather
 * than count/dayMax, so the same "5 cravings" bar looks the same
 * across Tuesday and Monday cards even though their day-maxes
 * differ — the viewer's intuition about "5" stays anchored.
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
  const stripHeight = 34;
  const gap = 2;
  const cellW = (stripWidth - gap * 23) / 24;

  // Direct scale — px per craving. Cap keeps really-busy hours from
  // pushing over the strip; floor keeps 1-count hours visible.
  const PX_PER_CRAVING = 6;
  const MIN_ACTIVE_H = 6; // any non-zero window bar shows this tall
  const MAX_H = stripHeight - 2;
  // Flat baseline outside the window — no scaffolding noise, no
  // count-per-count fluctuation to compete with the peak.
  const OUTSIDE_H = 3;

  return (
    <View style={{ width: stripWidth, height: stripHeight, marginTop: 10 }}>
      <Svg width={stripWidth} height={stripHeight}>
        {Array.from({ length: 24 }, (_, i) => {
          const count = hourlyCounts[i] ?? 0;
          const isInWindow = i >= windowStart && i <= windowEnd;

          let barH: number;
          let fill: string;

          if (isInWindow) {
            // Count-scaled height inside the window. A 0-count hour
            // inside the window still gets the flat baseline so the
            // ordering of hours reads correctly.
            barH =
              count === 0
                ? OUTSIDE_H
                : Math.min(
                    MAX_H,
                    Math.max(MIN_ACTIVE_H, count * PX_PER_CRAVING)
                  );
            // Brightness ALSO scales with count so higher bars pop
            // even more. Top card gets a stronger ceiling.
            const relative =
              count === 0 ? 0 : 0.55 + Math.min(0.4, count * 0.08);
            const alpha =
              (isTop ? 0.95 : 0.75) * (count === 0 ? 0.35 : relative);
            fill =
              count === 0
                ? 'rgba(255,255,255,0.08)'
                : triggersAccentAlpha(Math.min(0.95, alpha + 0.35));
          } else {
            barH = OUTSIDE_H;
            fill = 'rgba(255,255,255,0.08)';
          }

          const y = stripHeight - barH;
          return (
            <Rect
              key={i}
              x={i * (cellW + gap)}
              y={y}
              width={cellW}
              height={barH}
              rx={1.4}
              ry={1.4}
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
