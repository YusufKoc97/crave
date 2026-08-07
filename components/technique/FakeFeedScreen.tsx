import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import {
  dsColors,
  dsFont,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';
import { FONT_STACK } from '@/components/toolkit/carouselStyle';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
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

/**
 * The opening card's requirement. Shorter, because card one invites the
 * scroll and an invitation that cannot be accepted for seven seconds
 * reads as a bug. ESTIMATE, like DWELL_MS.
 */
const FIRST_DWELL_MS = 2500;

/** Poll cadence for reading the (UI-thread) dwell accumulator. */
const TICK_MS = 150;

/**
 * `reducedMotion` is intentionally not consumed: this scene has no
 * decorative motion to freeze. The only movement is the user's own
 * scroll, and the cards are static — so the reduced-motion contract is
 * satisfied by construction rather than by a branch. Anything added
 * later that animates on its own must read the prop.
 */
export function FakeFeedScreen({
  accentColor,
  onComplete,
  haptics,
}: SceneProps) {
  // Height of one page — measured, since the scene is laid out by the
  // runner and paging must match it exactly.
  const [pageH, setPageH] = useState(0);
  /** How many cards exist in the feed right now (the rest aren't
   *  rendered, which is what enforces the pace). */
  const [unlocked, setUnlocked] = useState(1);

  /**
   * Monotonic foreground clock, in ms. Only ever written on the UI
   * thread; JS reads it and subtracts `cardStartRef` to get the current
   * card's dwell.
   *
   * It is a clock rather than a per-card accumulator because resetting
   * an accumulator from JS is an *asynchronous* write to the UI runtime
   * while the interval's read is synchronous — so a tick landing in that
   * window would see the previous card's dwell and could unlock a card
   * (or, on card ten, complete the exercise) that was never actually
   * served. Subtracting two synchronously-read values has no such gap.
   */
  const clock = useSharedValue(0);
  /** Clock value at which the current card came on screen. */
  const cardStartRef = useRef(0);

  const unlockedRef = useRef(1);
  const indexRef = useRef(0);
  const completedRef = useRef(false);
  const depletionTappedRef = useRef(false);

  useFrameCallback((frame) => {
    'worklet';
    const dt = frame.timeSincePreviousFrame ?? 16;
    // A resume frame carries the ENTIRE time the app spent backgrounded
    // in one delta (the display link pauses, the timestamp source does
    // not). Adding it raw would silently serve a card the user never
    // looked at — and on card ten would fire the closing haptic and
    // complete the exercise the instant they returned. Anything longer
    // than a few dropped frames is not time spent reading.
    clock.value += dt > 64 ? 0 : dt;
  });

  const scrollRef = useRef<ScrollView>(null);

  // Measured on the ScrollView itself, not on a wrapper: a page must be
  // exactly the scrolling viewport or paging snaps to one height while
  // the eye reads another, and Math.round(offset / pageH) starts
  // returning the wrong card. (Observed: 642pt cards inside a 734pt
  // viewport after a resize.)
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      setPageH((prev) => {
        if (prev === h) return prev;
        // Card one's clock starts when the feed is actually on screen,
        // not at mount.
        if (prev === 0) cardStartRef.current = clock.value;
        return h;
      });
    },
    [clock]
  );

  // A rotation / split-view / keyboard change resizes the page. Without
  // re-anchoring, the old offset now points between two cards and every
  // later index is off by the accumulated drift.
  useEffect(() => {
    if (pageH <= 0) return;
    scrollRef.current?.scrollTo({
      y: indexRef.current * pageH,
      animated: false,
    });
  }, [pageH]);

  // Settle handler. Wired to onScroll as well as the two native
  // end-of-gesture events, because react-native-web emits NEITHER
  // onMomentumScrollEnd nor onScrollEndDrag — without onScroll the feed
  // deadlocks on web after the first unlock, with the user staring at a
  // card that never advances.
  //
  // Since onScroll also fires mid-gesture, an offset that is not on a
  // page boundary is ignored: paging (native snap / CSS scroll-snap)
  // always comes to rest on one, so an off-boundary sample means the
  // card is still moving. That also stops an aborted half-swipe from
  // resetting the clock on a card the user never actually left.
  const handleSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageH <= 0) return;
      const exact = e.nativeEvent.contentOffset.y / pageH;
      const next = Math.round(exact);
      if (Math.abs(exact - next) > 0.02) return; // mid-gesture
      if (next === indexRef.current) return;
      indexRef.current = next;
      // A fresh card starts its own clock; time spent on the previous
      // one never counts toward it.
      cardStartRef.current = clock.value;
      if (
        FAKE_FEED_DEPLETION_START >= 0 &&
        next === FAKE_FEED_DEPLETION_START &&
        !depletionTappedRef.current
      ) {
        depletionTappedRef.current = true;
        haptics?.tap();
      }
    },
    [pageH, clock, haptics]
  );

  // The pace guard itself: once the current card has held the screen
  // long enough, either append the next card or — if this was the last
  // one — end the exercise.
  useEffect(() => {
    const id = setInterval(() => {
      if (completedRef.current) return;
      const at = indexRef.current;
      const step = feedStep({
        index: at,
        unlocked: unlockedRef.current,
        dwellMs: clock.value - cardStartRef.current,
        // Card one says "Scroll down." — it must not be a lie. A full
        // dwell there leaves the gesture inert for seven seconds while
        // the copy invites it, which reads as a broken screen rather
        // than a paced one. The opening beat is shorter; every card
        // after it carries the real pace.
        requiredMs: at === 0 ? FIRST_DWELL_MS : DWELL_MS,
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
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        onLayout={handleLayout}
        style={styles.root}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        // No overscroll: there must be no gesture that hints more
        // content could arrive (guardrail 1).
        bounces={false}
        overScrollMode="never"
        decelerationRate="fast"
        onMomentumScrollEnd={handleSettle}
        onScrollEndDrag={handleSettle}
        onScroll={handleSettle}
        // Only the settle matters, and handleSettle discards
        // off-boundary samples anyway — so there is no reason to ship
        // 60 scroll events a second to JS mid-swipe. The end-of-drag
        // and momentum callbacks are not gated by this.
        scrollEventThrottle={250}
      >
        {pageH > 0
          ? FAKE_FEED_CARDS.slice(0, unlocked).map((card) => (
              <FeedCard
                key={card.key}
                card={card}
                height={pageH}
                accentColor={accentColor}
              />
            ))
          : null}
      </ScrollView>
    </View>
  );
}

/**
 * Memoised: every unlock re-renders the scene, and without this each
 * already-rendered card (and its SVG) re-renders with it — 55 renders
 * over a full run instead of 10. All props are primitives or stable
 * module-level card objects, so the shallow compare is exact.
 *
 * There is deliberately NO entrance animation. An earlier version faded
 * appended cards in, which was invisible in practice (the card appends
 * off-screen, below the fold) — and making it visible would be worse,
 * not better: a card that perceptibly *arrives* is the notification
 * beat guardrail 2 exists to keep out. If a reveal is ever wanted it
 * must key off the card entering the viewport, never off it appending.
 */
const FeedCard = memo(function FeedCard({
  card,
  height,
  accentColor,
}: {
  card: FakeFeedCard;
  height: number;
  accentColor: string;
}) {
  // Depletion drains the SURFACE, never the words. The card's own
  // background and border recede toward the navy as the feed runs out —
  // but the copy stays at full strength. On the last card that means the
  // message ("Now put the phone down") reads as a sharp line floating on
  // an almost-dissolved card, which is both the point of the exercise
  // and the strongest way to show it winding down. Fading the text too,
  // as an earlier version did, buried the one line that matters.
  const drain = card.depletion ?? 0;

  return (
    <View style={[styles.page, { height }]}>
      <SurfaceCard
        variant="elevated"
        style={[
          styles.card,
          {
            // Left slightly translucent even at full strength, so the
            // shell's nebula reads faintly through every card — the
            // family's layered depth — then dissolved toward the void as
            // the feed depletes.
            backgroundColor: hexAlpha(
              dsColors.cardSurface,
              0.92 - drain * 0.55
            ),
            borderColor: hexAlpha(dsColors.borderAccent, 1 - drain * 0.8),
          },
        ]}
      >
        <Text style={styles.cardText}>
          {t(`toolkit.techniques.fake_feed.cards.${card.key}`)}
        </Text>

        {/* The one doomscroll-accent highlight — a short rule that thins
            as the feed empties. Views only, so nothing rasterises while
            the user scrolls. */}
        <View
          style={[
            styles.rule,
            {
              backgroundColor: hexAlpha(accentColor, 0.55 * (1 - drain)),
              width: 40 * (1 - drain * 0.8),
            },
          ]}
        />
      </SurfaceCard>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  page: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: dsSpacing.xxl,
  },
  card: {
    width: '100%',
    paddingVertical: dsSpacing.x4l,
    paddingHorizontal: dsSpacing.xxl,
    alignItems: 'center',
  },
  cardText: {
    color: dsColors.textPrimary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.displaySm,
    fontWeight: dsFont.weight.semibold,
    lineHeight: 30,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
  },
  rule: {
    height: 2,
    borderRadius: 1,
    marginTop: dsSpacing.xl,
  },
});
