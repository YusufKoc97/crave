import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { PathScene } from '@/components/journey/PathScene';
import { GlowDisc } from '@/components/ui/GlowDisc';
import { GradientSurface } from '@/components/ui/GradientSurface';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { RankEmblem, rankEmblemColor } from '@/components/ranks/RankEmblem';
import { RANK_LADDER } from '@/constants/rankLadder';
import type { JourneyView } from '@/context/AddictionScoresContext';
import { t } from '@/lib/i18n';
import {
  dsSectionHeaderStyle,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';

/**
 * Journey view for Module 1 — hero rank card at top, vertical
 * ladder underneath. Design refresh (Journey redesign):
 *
 *   Hero card layout is now score-ring-left / rank-right:
 *   ┌─────────────────────────────────────────────┐
 *   │  ╭───╮   YOUR RANK                          │
 *   │  │40 │   Base                               │
 *   │  ╰───╯   The climb begins                   │
 *   │                                             │
 *   │  ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │
 *   │           60 more to First Step             │
 *   └─────────────────────────────────────────────┘
 *
 *   - Score sits INSIDE a mini progress ring (78×78 SVG) that
 *     tracks progressWithinRank — same data as the bar below,
 *     restated as a visual so the "score" reads as journey-in-
 *     progress rather than a static number.
 *   - Right column: YOUR RANK caps + big rank name + per-rank
 *     blurb (comes from rank.description).
 *   - Full-width bar underneath with a Reanimated sheen that
 *     sweeps left→right on a 3.4s loop.
 *   - Container gains an accent-tinted radial wash (web) and
 *     an accent-color halo shadow.
 *
 *   Vertical ladder below is unchanged in this milestone; the
 *   handoff's "THE PATH" reversal + atmospheric scene lands in
 *   the next passes.
 */

type Props = {
  view: JourneyView;
  /** Color-locked accent (from the addiction catalog). */
  accentColor: string;
};

// ─── Ring geometry ────────────────────────────────────────────
const RING_BOX = 78;
const RING_RADIUS = 34;
const RING_STROKE = 6;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~213.6

// Faint accent particles sprinkled inside the hero card — static,
// low-alpha; positioned so they cluster near the lower-right glow.
const HERO_PARTICLES = [
  { left: '30%', top: 118, size: 3, alpha: 0.5 },
  { left: '58%', top: 132, size: 2.5, alpha: 0.4 },
  { left: '74%', top: 108, size: 3, alpha: 0.45 },
  { left: '46%', top: 96, size: 2, alpha: 0.35 },
] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function JourneyBar({ view, accentColor }: Props) {
  const { score, currentRank, nextRank, progress, unlockedIds, unlockedAt } =
    view;

  const remaining = nextRank ? Math.max(0, nextRank.thresholdScore - score) : 0;

  // Ring arc (0..progress) — same easing; drives strokeDashoffset
  // via width transform we can't use, so we use a shared value +
  // useAnimatedProps for the SVG Circle.
  const ringAnim = useSharedValue(0);
  useEffect(() => {
    ringAnim.value = 0;
    ringAnim.value = withTiming(progress, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [ringAnim, progress]);
  // For SVG we compute the resting dashoffset from progress at
  // render time — cheap and doesn't need a Reanimated animated
  // prop for a mount-only easing. The next mount uses the same
  // technique with the new progress value.
  const ringDashOffset =
    RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <View style={styles.root}>
      {/* ── Hero rank card ─────────────────────────────────────── */}
      <View style={[styles.heroCard, heroCardBg(accentColor)]}>
        {/* Native has no backgroundImage — paint the card's linear +
            accent radial base with SVG so device matches web. */}
        {Platform.OS !== 'web' && (
          <GradientSurface
            top="#141d2e"
            bottom="#0b1220"
            accent={accentColor}
            accentPeak={0.14}
            accentMid={0.04}
          />
        )}
        {/* Neon ambient glow behind the card content — two soft
            accent discs + faint drifting particles. Renders on both
            web and native (GlowDisc uses SVG radial, no filter). */}
        <View style={styles.heroGlow} pointerEvents="none">
          <GlowDisc
            leftPct={22}
            topPct={18}
            size={260}
            color={hexAlpha(accentColor, 0.32)}
          />
          <GlowDisc
            leftPct={84}
            topPct={82}
            size={200}
            color={hexAlpha(accentColor, 0.2)}
          />
          {HERO_PARTICLES.map((p, i) => (
            <View
              key={i}
              style={[
                styles.heroParticle,
                {
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  borderRadius: p.size / 2,
                  backgroundColor: hexAlpha(accentColor, p.alpha),
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.heroTopRow}>
          {/* Left — score ring */}
          <View style={styles.ringWrap}>
            <Svg
              width={RING_BOX}
              height={RING_BOX}
              viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}
            >
              <Circle
                cx={RING_BOX / 2}
                cy={RING_BOX / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={hexAlpha(accentColor, 0.14)}
                strokeWidth={RING_STROKE}
              />
              <Circle
                cx={RING_BOX / 2}
                cy={RING_BOX / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={accentColor}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${RING_CIRCUMFERENCE}`}
                strokeDashoffset={`${ringDashOffset}`}
                transform={`rotate(-90 ${RING_BOX / 2} ${RING_BOX / 2})`}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.ringScore}>{compactScore(score)}</Text>
              <Text style={styles.ringLabel}>{t('journey.score_label')}</Text>
            </View>
          </View>

          {/* Right — emblem + rank + blurb. The emblem leads and the
              name is its caption, in the rank's own colour — same
              rule as everywhere else a rank name appears. */}
          <View style={styles.rankCol}>
            <Text style={styles.rankKicker}>{t('journey.your_rank')}</Text>
            <View style={styles.rankHead}>
              <RankEmblem
                tier={currentRank.order - 1}
                size={68}
                haloBoost={1.5}
              />
              <Text
                style={[
                  styles.rankName,
                  { color: rankEmblemColor(currentRank.order - 1) },
                ]}
                numberOfLines={1}
              >
                {currentRank.name}
              </Text>
            </View>
            <Text style={styles.rankBlurb} numberOfLines={2}>
              {currentRank.description}
            </Text>
          </View>
        </View>

        {/* The full-width bar that used to sit here is gone: the score
            ring on the left and the ladder below already tell the
            same progress story — three meters was two too many. */}
        <Text style={styles.nextHint}>
          {nextRank
            ? t('journey.next_rank_progress', {
                remaining,
                name: nextRank.name,
              })
            : t('journey.at_ceiling')}
        </Text>
      </View>

      {/* ── THE PATH — vertical spine, reversed order ────────── */}
      <Text style={styles.pathKicker}>{t('journey.ladder_title')}</Text>
      <PathSpine
        score={score}
        currentRankId={currentRank.id}
        accentColor={accentColor}
        unlockedIds={unlockedIds}
        unlockedAt={unlockedAt}
      />
    </View>
  );
}

// ─── Path (spine) styles — kept in a separate StyleSheet so
//     they can be moved into their own file without touching
//     the hero card. Defined BEFORE PathSpine so hot-reload
//     evaluation order stays clean. ────────────────────────
const pathStyles = StyleSheet.create({
  container: {
    marginTop: 10,
    paddingLeft: 44,
    paddingRight: dsSpacing.lg,
    paddingVertical: dsSpacing.xl,
    borderRadius: 24,
    backgroundColor: hexAlpha('#0b1220', 0.72),
    borderWidth: 1,
    borderColor: 'rgba(160,180,220,0.12)',
    overflow: 'hidden',
    // Atmospheric scene (mountains, aurora, stars) mounts inside
    // this container in M3a — placed absolutely behind the rows.
  },
  row: {
    position: 'relative',
    minHeight: 60,
    paddingVertical: 8,
  },
  dot: {
    position: 'absolute',
    left: -30,
    top: 12,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseHalo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
  },
  currentInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0d1424',
  },
  connector: {
    position: 'absolute',
    left: -23,
    // Start just under this row's dot (dot top=12, dot height=16
    // → 12 + 16 = 28). Extend into the next row until we meet
    // the top of the next dot (row starts at 0, next dot top=12).
    // That means we need bottom = -12 so the segment visually
    // touches the next dot without a gap. Container's overflow
    // hidden clips anything past the outer rounded edge.
    top: 28,
    bottom: -12,
    width: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  connectorTrack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  connectorFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 2,
    transformOrigin: 'bottom',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  textTop: {
    // Left-packed: emblem, then name right beside it, hugging the
    // spine — space-between used to strand the name mid-card, which
    // read as centred. Only the threshold value stays on the right.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
  },
  rowEmblem: {
    width: 40,
    // The emblem is 1.16× as tall as it is wide; giving the wrapper
    // the same ratio keeps the row's baseline from jumping.
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  rankValue: {
    marginLeft: 'auto',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  status: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    minHeight: 14,
  },
});

// ─── THE PATH — vertical spine ────────────────────────────────
//
// Handoff reversal: high ranks on TOP, current at the BOTTOM,
// progress fills the connector segments BOTTOM-UP. This turns
// the ladder into a mountain-climbing metaphor — the atmospheric
// scene (mountains + horizon aurora + stars) lands in M3a.
//
// Each row carries an absolute-positioned dot (left side of the
// content, sitting inside the container's padding-left gutter)
// and a connector to the row BELOW it. Fill semantics for the
// connector between R (this row) and rankBelow (next row down
// in visual order, which is the LOWER threshold):
//   - if rankBelow is null (bottom row) → no connector
//   - if R.threshold <= score → R reached → fill 1 (full)
//   - if rankBelow is current & R is next → fill pct (partial)
//   - otherwise (locked) → fill 0

type PathSpineProps = {
  score: number;
  currentRankId: string;
  accentColor: string;
  unlockedIds: ReadonlySet<string>;
  unlockedAt: ReadonlyMap<string, string>;
};

function PathSpine({
  score,
  currentRankId,
  accentColor,
  unlockedIds,
  unlockedAt,
}: PathSpineProps) {
  const currentIdx = RANK_LADDER.findIndex((r) => r.id === currentRankId);
  const currentRank = RANK_LADDER[currentIdx];
  const nextRank = RANK_LADDER[currentIdx + 1] ?? null;
  const pct = nextRank
    ? Math.max(
        0,
        Math.min(
          1,
          (score - currentRank.thresholdScore) /
            Math.max(1, nextRank.thresholdScore - currentRank.thresholdScore)
        )
      )
    : 1;

  // Reverse order: highest rank first, current at the bottom.
  const rowsTopDown = [...RANK_LADDER].reverse();

  return (
    <View style={pathStyles.container}>
      <PathScene />
      {rowsTopDown.map((rank, visualIdx) => {
        // The row visually BELOW this one — this is our
        // connector's terminus (drops down out of this row's dot
        // toward the next lower row).
        const rankBelow = rowsTopDown[visualIdx + 1] ?? null;
        const isLast = rankBelow === null;

        const isCurrent = rank.id === currentRankId;
        const isReached = score >= rank.thresholdScore && !isCurrent;
        const isNext = nextRank?.id === rank.id;

        // Fill for the connector R → rankBelow:
        let fill: number;
        if (!rankBelow) fill = 0;
        else if (rankBelow.thresholdScore <= score && !isCurrent) fill = 1;
        else if (rankBelow.id === currentRankId && isNext) fill = pct;
        else if (score >= rank.thresholdScore) fill = 1;
        else fill = 0;

        return (
          <PathRow
            key={rank.id}
            tier={rank.order - 1}
            rankName={rank.name}
            rankValue={rank.thresholdScore}
            score={score}
            isCurrent={isCurrent}
            isReached={isReached}
            isNext={isNext}
            isLast={isLast}
            connectorFill={fill}
            pctText={isNext ? Math.round(pct * 100) : 0}
            accentColor={accentColor}
            unlockedIso={unlockedAt.get(rank.id)}
            wasUnlocked={unlockedIds.has(rank.id)}
          />
        );
      })}
    </View>
  );
}

type PathRowProps = {
  /** 0-based ladder index for the emblem. */
  tier: number;
  rankName: string;
  rankValue: number;
  score: number;
  isCurrent: boolean;
  isReached: boolean;
  isNext: boolean;
  isLast: boolean;
  connectorFill: number;
  pctText: number;
  accentColor: string;
  unlockedIso: string | undefined;
  wasUnlocked: boolean;
};

function PathRow({
  tier,
  rankName,
  rankValue,
  score,
  isCurrent,
  isReached,
  isNext,
  isLast,
  connectorFill,
  pctText,
  accentColor,
  unlockedIso,
  wasUnlocked,
}: PathRowProps) {
  // Current-dot pulse — a soft ring that grows + fades on a
  // 2.2s loop. Two shared values drive one halo View.
  const pulseAnim = useSharedValue(0);
  useEffect(() => {
    if (!isCurrent) return;
    pulseAnim.value = 0;
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      false
    );
    return () => cancelAnimation(pulseAnim);
  }, [isCurrent, pulseAnim]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.55 - pulseAnim.value * 0.45,
    transform: [{ scale: 1 + pulseAnim.value * 0.9 }],
  }));

  // Segment fillRise on mount — scaleY 0→1 anchored at bottom.
  const fillAnim = useSharedValue(0);
  useEffect(() => {
    if (isLast) return;
    fillAnim.value = 0;
    fillAnim.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [fillAnim, isLast, connectorFill]);
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: fillAnim.value }],
  }));

  // Right-side value: current row shows score in accent; others
  // show the rank threshold.
  const rightValue = isCurrent ? score : rankValue;
  const rightColor = isCurrent
    ? accentColor
    : isReached
      ? '#c7d2e2'
      : '#4d5f7d';

  // Every rank name in the app wears its rank's own colour; state
  // only modulates how lit it is, never the hue.
  const nameColor = rankEmblemColor(tier);
  const nameOpacity = isCurrent || isReached ? 1 : isNext ? 0.85 : 0.55;

  const statusLabel = isCurrent
    ? t('journey.current')
    : isNext
      ? t('journey.next_progress', { percent: pctText })
      : isReached
        ? unlockedIso
          ? t('journey.unlocked_at', { date: formatDate(unlockedIso) })
          : t('journey.unlocked')
        : '';
  const statusColor = isCurrent
    ? accentColor
    : isNext
      ? '#8aa0c4'
      : isReached
        ? '#6a7fa0'
        : '#4d5f7d';

  return (
    <View style={pathStyles.row}>
      {/* Dot — sits in the container padding gutter on the left */}
      <View
        style={[
          pathStyles.dot,
          isCurrent || isReached
            ? { backgroundColor: accentColor, borderColor: accentColor }
            : isNext
              ? {
                  backgroundColor: '#0a1120',
                  borderColor: hexAlpha(accentColor, 0.55),
                }
              : {
                  backgroundColor: '#0a1120',
                  borderColor: 'rgba(255,255,255,0.15)',
                },
        ]}
      >
        {isCurrent && (
          <>
            {/* Pulse halo (accent color, expanding + fading) */}
            <Animated.View
              pointerEvents="none"
              style={[
                pathStyles.pulseHalo,
                pulseStyle,
                { backgroundColor: hexAlpha(accentColor, 0.7) },
              ]}
            />
            {/* Inner dark dot — reads as a bullseye */}
            <View style={pathStyles.currentInner} />
          </>
        )}
        {/* Marker `wasUnlocked` for future date attributions — the
            unlocked-at map is already read above for the label. */}
        {wasUnlocked ? null : null}
      </View>

      {/* Connector — absolute, top of dot to bottom of row.
          Fill is bottom-anchored so scaleY animates upward. */}
      {!isLast && (
        <View style={pathStyles.connector} pointerEvents="none">
          <View style={pathStyles.connectorTrack} />
          <Animated.View
            style={[
              pathStyles.connectorFill,
              fillStyle,
              {
                height: `${connectorFill * 100}%`,
                backgroundColor: accentColor,
                shadowColor: accentColor,
                shadowOpacity: 0.5,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          />
        </View>
      )}

      {/* Text */}
      <View style={pathStyles.textCol}>
        <View style={pathStyles.textTop}>
          {/* 34 is the handoff's list-row size, below the `fine`
              threshold — the ornaments are dropped and only the
              frame + sculpture read, which is what a row wants.
              Locked ranks are dimmed rather than hidden so the
              ladder still previews what is coming. */}
          <View
            style={[
              pathStyles.rowEmblem,
              !(isCurrent || isReached) && { opacity: 0.4 },
            ]}
          >
            <RankEmblem tier={tier} size={40} />
          </View>
          <Text
            style={[
              pathStyles.rankName,
              { color: nameColor, opacity: nameOpacity },
            ]}
            numberOfLines={1}
          >
            {rankName}
          </Text>
          <Text style={[pathStyles.rankValue, { color: rightColor }]}>
            {rightValue}
          </Text>
        </View>
        {statusLabel ? (
          <Text style={[pathStyles.status, { color: statusColor }]}>
            {statusLabel}
          </Text>
        ) : (
          <View style={{ height: 14 }} />
        )}
      </View>
    </View>
  );
}

/** 12000+ scores overflow the ring — abbreviate as k. */
function compactScore(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)}k`;
  return `${n}`;
}

/** Hero container gradient + border tint. Web gets a real radial
 *  wash from the accent color; native uses the same solid bg
 *  plus shadow to approximate the "lit from above" feel. */
function heroCardBg(accent: string) {
  const base = {
    borderColor: hexAlpha(accent, 0.28),
    shadowColor: accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 6,
    backgroundColor: '#141d2e',
  };
  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webBg: any = {
      backgroundImage: `radial-gradient(120% 110% at 100% 0%, ${hexAlpha(accent, 0.14)}, transparent 55%), linear-gradient(160deg, #141d2e, #0b1220)`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 14px 30px -16px ${hexAlpha(accent, 0.3)}`,
    };
    return { ...base, ...webBg };
  }
  return base;
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: dsSpacing.xl,
    paddingBottom: dsSpacing.x4l,
  },
  heroCard: {
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  heroParticle: {
    position: 'absolute',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 18,
  },
  ringWrap: {
    width: RING_BOX,
    height: RING_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringScore: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 24,
  },
  ringLabel: {
    marginTop: 2,
    color: '#7f93b3',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  rankCol: {
    flex: 1,
    minWidth: 0,
  },
  rankHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  rankKicker: {
    color: '#7f93b3',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rankName: {
    // Colour is injected per-rank at the call site; 22 instead of 32
    // because the emblem is the headline and the name its caption.
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 26,
    flexShrink: 1,
  },
  rankBlurb: {
    color: '#8397b6',
    fontSize: 13,
    lineHeight: 18,
  },
  nextHint: {
    marginTop: 12,
    color: '#8aa0c4',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  pathKicker: {
    ...dsSectionHeaderStyle,
    paddingHorizontal: 2,
  },
});
