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
import type { TriggerMapPeak } from '@/lib/triggerMap';
import { t } from '@/lib/i18n';
import {
  triggersAccent,
  triggersAccentAlpha,
  triggersSurface,
} from './triggersTheme';

/**
 * Peak Hours — Modül 3 redesign.
 *
 * Split into two visual layers:
 *   1. A radial 24h clock at the top — 24 tick marks, glowing arcs
 *      at each peak window, a "needle" pointing at the strongest
 *      peak, and a centered total count.
 *   2. Rich peak cards below (top 3) — rank badge, day + hour
 *      range, count, and a 24h mini strip showing where in the
 *      day this peak sits.
 *
 * Data source is unchanged (`peaks[]` from the Edge Function).
 * The clock derives everything it needs from that list — no
 * additional round-trip required.
 */

type Props = {
  peaks: TriggerMapPeak[];
  /** Kept for API compat — module now paints from its own violet. */
  accentColor?: string;
};

const CLOCK_SIZE = 220;
const CLOCK_STROKE_MAJOR = 2;
const CLOCK_STROKE_MINOR = 1;
const CLOCK_TICK_LEN_MAJOR = 10;
const CLOCK_TICK_LEN_MINOR = 5;
const CLOCK_ARC_STROKE = 8;
const CLOCK_INNER_GUIDE_STROKE = 1;

function formatHour(h: number): string {
  return String(h).padStart(2, '0');
}

export function PeakHoursList({ peaks, accentColor }: Props) {
  void accentColor;
  if (peaks.length === 0) return null;

  const totalPeakCount = peaks.reduce((sum, p) => sum + p.count, 0);

  return (
    <View style={styles.wrap}>
      <Text style={styles.subtitle}>
        {t('trigger_map.peak_hours.subtitle')}
      </Text>

      <View style={styles.clockWrap}>
        <RadialClock peaks={peaks} total={totalPeakCount} />
      </View>

      {peaks.map((peak, idx) => {
        const dayKey = DAY_KEYS[peak.day] ?? 'mon';
        const dayLabel = t(`trigger_map.heatmap.days_long.${dayKey}`);
        const rangeLabel = t('trigger_map.peak_hours.row_range', {
          day: dayLabel,
          startHour: formatHour(peak.hour),
          endHour: formatHour((peak.hour + 1) % 24),
        });
        return (
          <PeakCard
            key={`${peak.day}-${peak.hour}`}
            rank={idx + 1}
            rangeLabel={rangeLabel}
            count={peak.count}
            hour={peak.hour}
          />
        );
      })}
    </View>
  );
}

// ─────────────────────── Radial 24h clock ───────────────────────

function RadialClock({
  peaks,
  total,
}: {
  peaks: TriggerMapPeak[];
  total: number;
}) {
  const cx = CLOCK_SIZE / 2;
  const cy = CLOCK_SIZE / 2;
  const outerR = CLOCK_SIZE / 2 - 4;
  const arcR = outerR - 18;
  const innerGuideR = arcR - 14;

  // Peaks sorted for arc rendering (weakest first so the strongest
  // paints on top).
  const sortedPeaks = useMemo(
    () => [...peaks].sort((a, b) => a.count - b.count),
    [peaks]
  );
  const strongestPeak = useMemo(
    () =>
      peaks.reduce(
        (best, p) => (p.count > (best?.count ?? -1) ? p : best),
        peaks[0]
      ),
    [peaks]
  );

  // Tick geometry: 24 ticks total, major at 0/6/12/18.
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

  // Cardinal labels (12A / 6A / 12P / 6P) — sit just inside the
  // outer tick ring.
  const cardinals = useMemo(() => {
    const labelR = outerR - 24;
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
        y: cy + labelR * Math.sin(angle) + 3, // baseline nudge
      };
    });
  }, [cx, cy, outerR]);

  // Needle pointing at the strongest peak — a soft glowing line
  // from center to the arc radius.
  const needle = useMemo(() => {
    const angle = hourToRadians(strongestPeak.hour + 0.5);
    return {
      x: cx + arcR * Math.cos(angle),
      y: cy + arcR * Math.sin(angle),
    };
  }, [cx, cy, arcR, strongestPeak]);

  return (
    <Svg width={CLOCK_SIZE} height={CLOCK_SIZE}>
      <Defs>
        <RadialGradient id="clockGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={triggersAccent} stopOpacity={0.25} />
          <Stop offset="100%" stopColor={triggersAccent} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Inner ambient glow. */}
      <Circle cx={cx} cy={cy} r={arcR + 4} fill="url(#clockGlow)" />

      {/* Inner guide ring (super subtle). */}
      <Circle
        cx={cx}
        cy={cy}
        r={innerGuideR}
        stroke={triggersAccentAlpha(0.16)}
        strokeWidth={CLOCK_INNER_GUIDE_STROKE}
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
              tick.major ? triggersAccentAlpha(0.55) : triggersAccentAlpha(0.22)
            }
            strokeWidth={tick.major ? CLOCK_STROKE_MAJOR : CLOCK_STROKE_MINOR}
            strokeLinecap="round"
          />
        ))}
      </G>

      {/* Peak arcs — softer for the weaker peaks, brightest for
          the strongest. Each arc spans a 1-hour window plus a
          little pad so it reads as a "swell" not a needle. */}
      <G>
        {sortedPeaks.map((peak, i) => {
          const isTop =
            peak.hour === strongestPeak.hour && peak.day === strongestPeak.day;
          const alpha = isTop ? 0.95 : 0.42 + i * 0.1;
          const arcPad = 0.35; // hours on each side of the peak
          const start = hourToRadians(peak.hour - arcPad);
          const end = hourToRadians(peak.hour + 1 + arcPad);
          const d = describeArc(cx, cy, arcR, start, end);
          return (
            <Path
              key={`${peak.day}-${peak.hour}`}
              d={d}
              stroke={triggersAccentAlpha(alpha)}
              strokeWidth={CLOCK_ARC_STROKE}
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
      </G>

      {/* White tip on the strongest peak's arc — matches the
          brief's "beyaz uç noktası" cue. */}
      {(() => {
        const tipAngle = hourToRadians(strongestPeak.hour + 0.5);
        const tipX = cx + arcR * Math.cos(tipAngle);
        const tipY = cy + arcR * Math.sin(tipAngle);
        return (
          <Circle cx={tipX} cy={tipY} r={3} fill="#FFFFFF" fillOpacity={0.95} />
        );
      })()}

      {/* Needle for the strongest peak. */}
      <Line
        x1={cx}
        y1={cy}
        x2={needle.x}
        y2={needle.y}
        stroke={triggersAccent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeOpacity={0.75}
      />
      <Circle cx={cx} cy={cy} r={3} fill={triggersAccent} />

      {/* Cardinal labels (12A / 6A / 12P / 6P). */}
      <G>
        {cardinals.map((c) => (
          <SvgText
            key={c.text}
            x={c.x}
            y={c.y}
            fill="#8FA5CC"
            fontSize={10}
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
        y={cy - 4}
        fill="#F1F5FF"
        fontSize={30}
        fontWeight="800"
        textAnchor="middle"
      >
        {String(total)}
      </SvgText>
      <SvgText
        x={cx}
        y={cy + 14}
        fill={triggersAccent}
        fontSize={9}
        fontWeight="700"
        letterSpacing="1.4"
        textAnchor="middle"
      >
        PEAK CRAVINGS
      </SvgText>
    </Svg>
  );
}

/** Map an "hour" (0-24) to a clock-face angle in radians (12A = top). */
function hourToRadians(hour: number): number {
  const normalized = ((hour % 24) + 24) % 24;
  // 0h → -π/2 (top). Full revolution over 24 h.
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
  rangeLabel,
  count,
  hour,
}: {
  rank: number;
  rangeLabel: string;
  count: number;
  hour: number;
}) {
  const isTop = rank === 1;
  return (
    <View style={[styles.peakCard, isTop && styles.peakCardTop]}>
      <View style={styles.peakRow}>
        <View
          style={[
            styles.rankBadge,
            isTop
              ? styles.rankBadgeTop
              : {
                  backgroundColor: triggersAccentAlpha(0.1),
                  borderColor: triggersAccentAlpha(0.32),
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
        <View style={styles.rangeCol}>
          <Text style={styles.rangeText} numberOfLines={1}>
            {rangeLabel}
          </Text>
          <PeakMiniStrip hour={hour} highlight={isTop} />
        </View>
        <View style={styles.countCol}>
          <Text style={styles.countText}>{count}</Text>
          <Text style={styles.cravingsLabel}>CRAVINGS</Text>
        </View>
      </View>
    </View>
  );
}

/** 24-cell horizontal strip highlighting where the peak sits. */
function PeakMiniStrip({
  hour,
  highlight,
}: {
  hour: number;
  highlight: boolean;
}) {
  const stripWidth = 152;
  const stripHeight = 8;
  const gap = 1;
  const cellW = (stripWidth - gap * 23) / 24;
  const highlightAlpha = highlight ? 0.95 : 0.6;
  return (
    <View style={{ width: stripWidth, height: stripHeight, marginTop: 6 }}>
      <Svg width={stripWidth} height={stripHeight}>
        {Array.from({ length: 24 }, (_, i) => {
          const isPeak = i === hour;
          return (
            <Rect
              key={i}
              x={i * (cellW + gap)}
              y={0}
              width={cellW}
              height={stripHeight}
              rx={1}
              ry={1}
              fill={
                isPeak
                  ? triggersAccentAlpha(highlightAlpha)
                  : 'rgba(255,255,255,0.08)'
              }
            />
          );
        })}
      </Svg>
    </View>
  );
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
    marginBottom: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  clockWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  peakCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  peakCardTop: {
    backgroundColor: triggersAccentAlpha(0.1),
    borderColor: triggersAccentAlpha(0.4),
  },
  peakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
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
        boxShadow: `0 0 12px ${triggersAccentAlpha(0.7)}`,
      },
      default: {
        shadowColor: triggersAccent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  rangeCol: {
    flex: 1,
    minWidth: 0,
  },
  rangeText: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
  },
  countCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 22,
  },
  cravingsLabel: {
    color: triggersAccentAlpha(0.75),
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 1,
  },
});
