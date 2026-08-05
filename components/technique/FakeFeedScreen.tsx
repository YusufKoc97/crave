import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  FadeIn,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { hexAlpha } from '@/constants/designSystem';
import { t } from '@/lib/i18n';
import {
  FAKE_FEED_CARDS,
  FAKE_FEED_DEPLETION_START,
  feedStep,
  type FakeFeedCard,
} from './fakeFeedCards';
import type { SceneProps } from './types';

/**
 * Fake Feed — a feed that ends.
 *
 * The doomscroll urge is a *reflex*: the thumb wants to scroll. Fighting
 * that reflex head-on rarely works, so this satisfies it on safe ground
 * — a finite feed the user scrolls through until it runs out. The point
 * of the exercise is the ending: flows can end. Infinite feeds just hide
 * where theirs would be.
 *
 * Three guardrails shape every decision here. Mimicking a feed is only
 * useful if it never becomes one:
 *
 *   1. FINITE — exactly {@link FAKE_FEED_CARD_COUNT} cards, then
 *      `onComplete()`. Nothing loops, nothing appends past the last
 *      card, and `bounces` is off so there is no "pull for more" gesture
 *      to discover.
 *   2. NO REWARD — no counters, no streaks, no per-card haptic, nothing
 *      that lands as a hit. A haptic on every card would be exactly the
 *      variable-reward loop the exercise is treating, so there are only
 *      two in the whole run: one when the feed starts winding down, one
 *      at the end.
 *   3. DEPLETES — the closing cards fade (see `depletion` in
 *      {@link FAKE_FEED_CARDS}) so the feed visibly runs out of energy
 *      instead of stopping mid-stride.
 *
 * PACE GUARD. A fast scroller could otherwise clear ten cards in six
 * seconds and learn nothing; the urge needs time to pass. Rather than
 * toggling `scrollEnabled` (which fights the gesture mid-swipe and
 * feels broken), the feed simply **does not contain** the next card
 * yet: only cleared cards are rendered, so there is nowhere to scroll
 * to. A card clears after {@link DWELL_MS} of *foreground* time on
 * screen, then the next one appends. Scrolling fast just lands you at
 * the bottom sooner, waiting.
 *
 * Dwell accrues through a frame callback rather than a timer, so
 * backgrounding the app cannot advance the feed — the same
 * foreground-only accounting Ride the Wave uses. A long absence
 * restarts the scene anyway via the registry's `foregroundGraceMs`.
 *
 * Deliberately does NOT report `onProgress`: the shell's atmosphere
 * blooms with progress, and a feed that gets brighter as it empties
 * would contradict guardrail 3. The atmosphere stays at its ambient
 * baseline and the depletion is carried by the cards themselves.
 */

/**
 * Minimum foreground time a card must hold the screen before the next
 * one becomes reachable. Ten cards puts a full run at roughly 70-80s
 * even for someone scrolling flat out.
 *
 * ESTIMATE — derived from the brief's "~1-2 min", not from measurement.
 * It is the one number worth re-tuning on a real device: too short and
 * the reflex wins, too long and it reads as a punishment.
 */
const DWELL_MS = 7000;

/** Poll cadence for reading the (UI-thread) dwell accumulator. */
const TICK_MS = 150;

export function FakeFeedScreen({
  accentColor,
  onComplete,
  haptics,
  reducedMotion,
}: SceneProps) {
  // Height of one page — measured, since the scene is laid out by the
  // runner and paging must match it exactly.
  const [pageH, setPageH] = useState(0);
  /** How many cards exist in the feed right now (the rest aren't
   *  rendered, which is what enforces the pace). */
  const [unlocked, setUnlocked] = useState(1);

  // Foreground-only dwell accumulator for the current card.
  const dwell = useSharedValue(0);

  const unlockedRef = useRef(1);
  const indexRef = useRef(0);
  const completedRef = useRef(false);
  const depletionTappedRef = useRef(false);

  useFrameCallback((frame) => {
    'worklet';
    dwell.value += frame.timeSincePreviousFrame ?? 16;
  });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setPageH((prev) => (prev === h ? prev : h));
  }, []);

  // Settle handler — paging means the offset lands on a card boundary.
  const handleSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageH <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.y / pageH);
      if (next === indexRef.current) return;
      indexRef.current = next;
      // A fresh card starts its own clock; time spent on the previous
      // one never counts toward it.
      dwell.value = 0;
      if (
        FAKE_FEED_DEPLETION_START >= 0 &&
        next === FAKE_FEED_DEPLETION_START &&
        !depletionTappedRef.current
      ) {
        depletionTappedRef.current = true;
        haptics?.tap();
      }
    },
    [pageH, dwell, haptics]
  );

  // The pace guard itself: once the current card has held the screen
  // long enough, either append the next card or — if this was the last
  // one — end the exercise.
  useEffect(() => {
    const id = setInterval(() => {
      if (completedRef.current) return;
      const step = feedStep({
        index: indexRef.current,
        unlocked: unlockedRef.current,
        dwellMs: dwell.value,
        requiredMs: DWELL_MS,
      });
      if (step.kind === 'wait') return;
      if (step.kind === 'unlock') {
        unlockedRef.current = step.unlocked;
        setUnlocked(step.unlocked);
        return;
      }
      // Last card served — the feed is out of content. This is the
      // whole exercise: it ends.
      completedRef.current = true;
      clearInterval(id);
      haptics?.celebrate();
      onComplete();
    }, TICK_MS);
    return () => clearInterval(id);
    // Mount-once; the runner remounts the scene (fresh key) to restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root} onLayout={handleLayout}>
      {pageH > 0 ? (
        <ScrollView
          pagingEnabled
          showsVerticalScrollIndicator={false}
          // No overscroll: there must be no gesture that hints more
          // content could arrive (guardrail 1).
          bounces={false}
          overScrollMode="never"
          decelerationRate="fast"
          onMomentumScrollEnd={handleSettle}
          onScrollEndDrag={handleSettle}
          scrollEventThrottle={16}
        >
          {FAKE_FEED_CARDS.slice(0, unlocked).map((card, i) => (
            <FeedCard
              key={card.key}
              card={card}
              height={pageH}
              accentColor={accentColor}
              reducedMotion={reducedMotion}
              // The first card is there from mount; later ones appear
              // as the feed unlocks, so only those animate in.
              animateIn={i > 0}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function FeedCard({
  card,
  height,
  accentColor,
  reducedMotion,
  animateIn,
}: {
  card: FakeFeedCard;
  height: number;
  accentColor: string;
  reducedMotion?: boolean;
  animateIn: boolean;
}) {
  // Depletion drains the card rather than the shell: text and surface
  // both recede, so the closing stretch reads as a feed running out.
  const drain = card.depletion ?? 0;
  const gradId = `ff_${card.key}`;

  const body = (
    <View style={[styles.page, { height }]}>
      <View
        style={[
          styles.card,
          {
            borderColor: hexAlpha(accentColor, 0.22 * (1 - drain * 0.7)),
            backgroundColor: hexAlpha('#0d1730', 0.72 - drain * 0.22),
            opacity: 1 - drain * 0.55,
          },
        ]}
      >
        {/* Soft accent bloom behind the copy — the app's atmospheric
            language, not a bright social-feed surface. */}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <RadialGradient id={gradId} cx="0.28" cy="0.2" r="0.85">
              <Stop
                offset="0"
                stopColor={accentColor}
                stopOpacity={0.16 * (1 - drain)}
              />
              <Stop
                offset="0.55"
                stopColor={accentColor}
                stopOpacity={0.05 * (1 - drain)}
              />
              <Stop offset="1" stopColor={accentColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`url(#${gradId})`}
          />
        </Svg>

        <Text style={styles.cardText}>
          {t(`toolkit.techniques.fake_feed.cards.${card.key}`)}
        </Text>

        {/* Hairline that thins out as the feed depletes. */}
        <View
          style={[
            styles.rule,
            {
              backgroundColor: hexAlpha(accentColor, 0.5 * (1 - drain)),
              width: 44 * (1 - drain * 0.8),
            },
          ]}
        />
      </View>
    </View>
  );

  if (!animateIn || reducedMotion) return body;
  return <Animated.View entering={FadeIn.duration(420)}>{body}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  page: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  card: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 44,
    paddingHorizontal: 26,
    overflow: 'hidden',
    alignItems: 'center',
  },
  cardText: {
    color: '#eaf2ff',
    fontSize: 22,
    fontWeight: '500',
    lineHeight: 32,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  rule: {
    height: 2,
    borderRadius: 1,
    marginTop: 22,
  },
});
