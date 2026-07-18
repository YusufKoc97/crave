import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { Addiction } from '@/constants/addictions';
import { lucideIconFor } from './iconMap';
import {
  CARD_BG_TRACKED_BOT,
  CARD_BG_TRACKED_TOP,
  CARD_BG_UNTRACKED_BOT,
  CARD_BG_UNTRACKED_TOP,
  CARD_PAD_H,
  CARD_PAD_V,
  CARD_RADIUS,
  FONT_STACK,
  ICON_BG_BOT,
  ICON_BG_TOP,
  ICON_SIZE,
  INSET_HIGHLIGHT_TRACKED,
  INSET_HIGHLIGHT_UNTRACKED,
  RING_BOX,
  RING_CIRCUMFERENCE,
  RING_RADIUS,
  RING_STROKE,
  RING_TRACK_UNTRACKED,
  TEXT_NAME_TRACKED,
  TEXT_NAME_UNTRACKED,
  TEXT_STATUS_MUTED,
  TEXT_STATUS_UNTRACKED,
  UNTRACKED_BORDER,
  hexAlpha,
} from './cardStyle';

/**
 * Info-tab addiction card — mirrors the design handoff spec.
 *
 * Two variants driven by the `tracked` prop:
 *   - Tracked   → colored progress ring, filled icon, rank bar
 *                 with "Lv N   {progress}% → {NextRank}" line
 *   - Untracked → faded track-only ring, dimmed icon, "+ Track"
 *                 pill CTA in place of the bar
 *
 * The card body is a Pressable; the "+ Track" pill on untracked
 * cards is a nested Pressable that stops propagation so a single
 * tap on the pill starts tracking without also firing the outer
 * navigation. Tracked cards have no nested pill — the whole card
 * opens the addiction detail.
 *
 * All accent tinting reads from `addiction.color`. No brand palette
 * is defined here.
 */

type Props = {
  addiction: Addiction;
  tracked: boolean;
  /** 0..1 — where the user is inside their current rank's band.
   *  Untracked cards ignore this (ring is track-only). */
  progress: number;
  /** Cumulative score for this addiction — rendered inline after
   *  the rank name on tracked cards. Ignored when untracked. */
  score: number;
  /** Copy shown in the status line — usually the rank name for
   *  tracked cards. Untracked cards render fixed "Not tracked". */
  statusMain: string;
  onPress: () => void;
  /** Only used by untracked cards. Ignored when `tracked`. */
  onStartTracking?: () => void;
};

export function AddictionCard({
  addiction,
  tracked,
  progress,
  score,
  statusMain,
  onPress,
  onStartTracking,
}: Props) {
  const hue = addiction.color;
  const Icon = lucideIconFor(addiction.id);
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const dashOffset = RING_CIRCUMFERENCE * (1 - clampedProgress);

  // The card body wraps everything except the +Track pill so we
  // can attach the "open detail" onPress to just the body and let
  // the pill (rendered in the same visual card but outside this
  // Pressable) hit its own handler without the outer swallowing
  // the event. RN doesn't have stopPropagation across Pressables,
  // so we structure them as siblings inside a shared visual frame.
  return (
    <View style={[styles.frame, cardSurface(tracked, hue)]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.body, pressed && styles.pressedBody]}
        accessibilityRole="button"
        accessibilityLabel={`${addiction.name} details`}
      >
        <View style={styles.iconWrap}>
          <Svg
            width={RING_BOX}
            height={RING_BOX}
            viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}
            style={styles.ringSvg}
          >
            {/* Ring track — hue-tinted when tracked, faded white when not. */}
            <Circle
              cx={RING_BOX / 2}
              cy={RING_BOX / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={tracked ? hexAlpha(hue, 0.16) : RING_TRACK_UNTRACKED}
              strokeWidth={RING_STROKE}
            />
            {/* Progress arc — tracked only. */}
            {tracked && (
              <Circle
                cx={RING_BOX / 2}
                cy={RING_BOX / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={hue}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${RING_CIRCUMFERENCE}`}
                strokeDashoffset={`${dashOffset}`}
                transform={`rotate(-90 ${RING_BOX / 2} ${RING_BOX / 2})`}
              />
            )}
          </Svg>
          <View
            style={[
              styles.iconInner,
              {
                backgroundColor: hexAlpha(hue, tracked ? 0.14 : 0.08),
              },
            ]}
          >
            <Icon
              size={26}
              color={tracked ? hue : hexAlpha(hue, 0.6)}
              strokeWidth={2}
            />
          </View>
        </View>

        <View style={styles.textBlock}>
          <Text
            style={[
              styles.name,
              { color: tracked ? TEXT_NAME_TRACKED : TEXT_NAME_UNTRACKED },
            ]}
            numberOfLines={1}
          >
            {addiction.name}
          </Text>
          <Text style={styles.statusLine} numberOfLines={1}>
            <Text
              style={{
                color: tracked ? hue : TEXT_STATUS_UNTRACKED,
                fontWeight: '600',
              }}
            >
              {statusMain}
            </Text>
            {tracked && (
              <Text style={{ color: TEXT_STATUS_MUTED, fontWeight: '600' }}>
                {' '}
                · {score} pts
              </Text>
            )}
          </Text>
        </View>
      </Pressable>

      {!tracked && (
        <Pressable
          onPress={onStartTracking}
          style={({ pressed }) => [
            styles.trackPill,
            {
              backgroundColor: hexAlpha(hue, pressed ? 0.2 : 0.12),
              borderColor: hexAlpha(hue, 0.3),
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Start tracking ${addiction.name}`}
        >
          <Text style={[styles.trackPillText, { color: hexAlpha(hue, 0.9) }]}>
            + Track
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function cardSurface(tracked: boolean, hue: string) {
  // React Native doesn't do multi-layer backgrounds cleanly, so we
  // stack a solid dark base + optional shadow. Web uses backgroundImage
  // (via style-as-any) to approximate the design's radial + linear
  // combo; native gets a single-tone linear approximation.
  // Tracked-card glow tuning: earlier values (Y=13, opacity 0.5,
  // spread -14) bled too much off the bottom edge, especially on
  // bright hues (junk-food yellow, doomscroll blue). Reduced the
  // downward offset, tightened spread, and dropped opacity so the
  // glow reads as ambient rim light instead of a headlamp under
  // the card.
  const base = tracked
    ? {
        backgroundColor: CARD_BG_TRACKED_TOP,
        borderColor: hexAlpha(hue, 0.4),
        shadowColor: hue,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
        elevation: 5,
      }
    : {
        backgroundColor: CARD_BG_UNTRACKED_TOP,
        borderColor: UNTRACKED_BORDER,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 4,
      };
  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webBg: any = tracked
      ? {
          backgroundImage: `radial-gradient(115% 85% at 50% -5%, ${hexAlpha(hue, 0.22)}, ${hexAlpha(hue, 0.04)} 55%, transparent 80%), linear-gradient(160deg, ${CARD_BG_TRACKED_TOP}, ${CARD_BG_TRACKED_BOT})`,
          boxShadow: `inset 0 1px 0 ${INSET_HIGHLIGHT_TRACKED}, 0 4px 18px -12px ${hexAlpha(hue, 0.35)}`,
        }
      : {
          backgroundImage: `linear-gradient(160deg, ${CARD_BG_UNTRACKED_TOP}, ${CARD_BG_UNTRACKED_BOT})`,
          boxShadow: `inset 0 1px 0 ${INSET_HIGHLIGHT_UNTRACKED}, 0 6px 16px -10px rgba(0,0,0,0.6)`,
        };
    return { ...base, ...webBg };
  }
  return base;
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
  },
  body: {
    paddingHorizontal: CARD_PAD_H,
    paddingTop: CARD_PAD_V,
    paddingBottom: 13,
    alignItems: 'center',
    gap: 13,
  },
  pressedBody: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  iconWrap: {
    width: RING_BOX,
    height: RING_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  iconInner: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        backgroundImage: `radial-gradient(120% 120% at 28% 18%, rgba(255,255,255,0.06), transparent 64%), linear-gradient(160deg, ${ICON_BG_TOP}, ${ICON_BG_BOT})`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
      } as never,
      default: {
        backgroundColor: ICON_BG_TOP,
      },
    }),
  },
  textBlock: {
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
    fontFamily: FONT_STACK,
  },
  statusLine: {
    marginTop: 3,
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: FONT_STACK,
  },
  trackPill: {
    alignSelf: 'center',
    marginBottom: CARD_PAD_V,
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  trackPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontFamily: FONT_STACK,
  },
});
