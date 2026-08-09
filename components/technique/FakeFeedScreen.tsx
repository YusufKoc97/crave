import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
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
  FAKE_FEED_CARD_COUNT,
  FAKE_FEED_DEPLETION_START,
  type FakeFeedCard,
} from './fakeFeedCards';
import {
  FAKE_FEED_NUMBER,
  FAKE_FEED_NUMBER_TOTAL_MS,
  contextOpacity,
  countUpValue,
  entranceOpacity,
  entranceScale,
} from './fakeFeedNumber';
import {
  SCROLL_INVITE_REST,
  SLOW_PULSE_REST,
  scrollInviteFrame,
  slowPulseFrame,
} from './fakeFeedMotion';
import type { SceneProps } from './types';

/** Cards that carry a micro-interaction so far. */
const NUMBER_CARD_KEY = 'number';
const INVITE_CARD_KEY = 'invitation';
const PULSE_CARD_KEY = 'slow_pulse';

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
 *      `onComplete()`. Nothing loops, nothing exists past the last card,
 *      and `bounces` is off so there is no "pull for more" gesture to
 *      discover.
 *   2. NO REWARD — no counters, no streaks, no per-card haptic, nothing
 *      that lands as a hit. A haptic on every card would be exactly the
 *      variable-reward loop the exercise is treating, so there are only
 *      two in the whole run: one when the feed starts winding down, one
 *      at the end.
 *   3. DEPLETES — the closing cards fade (see `depletion` in
 *      {@link FAKE_FEED_CARDS}) so the feed visibly runs out of energy
 *      instead of stopping mid-stride.
 *
 * FREE SCROLL. The scroll is never gated: all cards are present from the
 * start and the user moves through them at whatever pace they like. An
 * earlier build withheld the next card until the current one had served
 * a dwell (a "pace guard" so a fast scroller couldn't clear the feed in
 * seconds) — but a feed you cannot advance for seven seconds reads as a
 * frozen screen, not a paced one. The finiteness, not a timer, is what
 * makes the point: however fast you scroll, you hit the bottom, and the
 * bottom is the lesson. Reaching the last card ends the exercise.
 *
 * Deliberately does NOT report `onProgress`: the shell's atmosphere
 * blooms with progress, and a feed that gets brighter as it empties
 * would contradict guardrail 3. The atmosphere stays at its ambient
 * baseline and the depletion is carried by the cards themselves.
 */

/**
 * How long the closing card holds the screen before the exercise reports
 * done. Not a scroll gate — there is nothing below the last card to
 * scroll to — just a beat so the final line ("Now put the phone down")
 * is read rather than flashed past on the way to the completion screen.
 * Cancelled the instant the user scrolls back up.
 *
 * ESTIMATE — a read-time guess, not a measurement; worth a device pass.
 */
const END_READ_MS = 1200;

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
  reducedMotion,
}: SceneProps) {
  // Height of one page — measured, since the scene is laid out by the
  // runner and paging must match it exactly.
  const [pageH, setPageH] = useState(0);

  // Which card is centred right now. Only used to arm a card's own
  // micro-interaction the moment it lands (card 4's count-up must not
  // run while it is still off-screen). Updated once per settle, not per
  // frame, so it costs one re-render per page change.
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const completedRef = useRef(false);
  const depletionTappedRef = useRef(false);
  // Pending "feed has ended" timer, so scrolling back off the last card
  // cancels the completion instead of firing it late.
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Measured on the ScrollView itself, not on a wrapper: a page must be
  // exactly the scrolling viewport or paging snaps to one height while
  // the eye reads another, and Math.round(offset / pageH) starts
  // returning the wrong card. (Observed: 642pt cards inside a 734pt
  // viewport after a resize.)
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setPageH((prev) => (prev === h ? prev : h));
  }, []);

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

  // Clear any pending completion timer if the scene unmounts mid-beat.
  useEffect(
    () => () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    },
    []
  );

  // Settle handler. Wired to onScroll as well as the two native
  // end-of-gesture events, because react-native-web emits NEITHER
  // onMomentumScrollEnd nor onScrollEndDrag — without onScroll the two
  // haptics and the completion beat would never fire on web.
  //
  // Since onScroll also fires mid-gesture, an offset that is not on a
  // page boundary is ignored: paging (native snap / CSS scroll-snap)
  // always comes to rest on one, so an off-boundary sample means the
  // card is still moving.
  const handleSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageH <= 0) return;
      const exact = e.nativeEvent.contentOffset.y / pageH;
      const next = Math.round(exact);
      if (Math.abs(exact - next) > 0.02) return; // mid-gesture
      if (next === indexRef.current) return;
      indexRef.current = next;
      // Arm whatever the newly-centred card wants to do on arrival.
      setActiveIndex(next);

      // One quiet haptic as the feed begins to wind down (guardrail 2).
      if (
        FAKE_FEED_DEPLETION_START >= 0 &&
        next === FAKE_FEED_DEPLETION_START &&
        !depletionTappedRef.current
      ) {
        depletionTappedRef.current = true;
        haptics?.tap();
      }

      // Any move cancels a pending end-beat: if the user scrolled back up
      // off the last card, the feed has not ended after all.
      if (endTimerRef.current) {
        clearTimeout(endTimerRef.current);
        endTimerRef.current = null;
      }

      // Reaching the last card is the whole exercise: the feed is out of
      // content. Hold it briefly so the closing line is read, then end.
      if (next === FAKE_FEED_CARD_COUNT - 1 && !completedRef.current) {
        endTimerRef.current = setTimeout(() => {
          if (completedRef.current) return;
          completedRef.current = true;
          haptics?.celebrate();
          onComplete();
        }, END_READ_MS);
      }
    },
    [pageH, haptics, onComplete]
  );

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
        // Only the settle matters, and handleSettle discards off-boundary
        // samples anyway — so there is no reason to ship 60 scroll events
        // a second to JS mid-swipe.
        scrollEventThrottle={250}
      >
        {pageH > 0
          ? FAKE_FEED_CARDS.map((card, i) => (
              <FeedCard
                key={card.key}
                card={card}
                height={pageH}
                accentColor={accentColor}
                active={i === activeIndex}
                reducedMotion={reducedMotion ?? false}
              />
            ))
          : null}
      </ScrollView>
    </View>
  );
}

/**
 * Memoised so a parent re-render never re-renders ten static cards. All
 * props are primitives or stable module-level card objects, so the
 * shallow compare is exact.
 *
 * There is deliberately NO entrance animation. A card that perceptibly
 * *arrives* is the notification beat guardrail 2 exists to keep out.
 */
const FeedCard = memo(function FeedCard({
  card,
  height,
  accentColor,
  active,
  reducedMotion,
}: {
  card: FakeFeedCard;
  height: number;
  accentColor: string;
  /** True while this card is the centred one — arms its interaction. */
  active: boolean;
  reducedMotion: boolean;
}) {
  // Card 4 is not a boxed card at all — it takes the whole page, sitting
  // straight on the shell's atmosphere, so it reads as a moment rather
  // than one more item in the list.
  if (card.key === NUMBER_CARD_KEY) {
    return (
      <NumberCard
        height={height}
        accentColor={accentColor}
        active={active}
        reducedMotion={reducedMotion}
      />
    );
  }

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
        {/* Card 6 leads with the pulse, the copy sits under it. */}
        {card.key === PULSE_CARD_KEY && (
          <SlowPulse
            active={active}
            reducedMotion={reducedMotion}
            accentColor={accentColor}
          />
        )}

        <Text style={styles.cardText}>
          {t(`toolkit.techniques.fake_feed.cards.${card.key}`)}
        </Text>

        {card.key === INVITE_CARD_KEY ? (
          // Card 1: a chevron that drifts down and fades, inviting the
          // scroll, in place of the static accent rule.
          <ScrollInvite
            active={active}
            reducedMotion={reducedMotion}
            accentColor={accentColor}
          />
        ) : card.key === PULSE_CARD_KEY ? null : (
          // The one doomscroll-accent highlight — a short rule that thins
          // as the feed empties. Views only, so nothing rasterises while
          // the user scrolls.
          <View
            style={[
              styles.rule,
              {
                backgroundColor: hexAlpha(accentColor, 0.55 * (1 - drain)),
                width: 40 * (1 - drain * 0.8),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </View>
  );
});

/**
 * Hero pixel size of the numerals. Deliberately far past the display
 * scale (largest token is 48) — card 4 is the one screen that should
 * feel oversized. ESTIMATE, tuned by eye, not a measurement.
 */
const HERO_SIZE = 84;

/**
 * One big count-up figure: a glowing numeral over an offset dark twin.
 * The twin gives it depth (the number reads as lifted off the surface
 * rather than painted flat), the glow gives it the neon presence the
 * doomscroll accent is for. Two Text nodes, no SVG — nothing rasterises
 * while the feed scrolls.
 */
function StatNumber({
  value,
  accentColor,
  label,
}: {
  value: number;
  accentColor: string;
  label: string;
}) {
  return (
    <View style={styles.statBlock}>
      <View style={styles.heroWrap}>
        {/* Depth twin, sitting just below and behind. */}
        <Text
          style={styles.heroBack}
          allowFontScaling={false}
          numberOfLines={1}
        >
          ~{value}
        </Text>
        <Text
          style={[
            styles.heroFront,
            { color: accentColor, textShadowColor: hexAlpha(accentColor, 0.6) },
          ]}
          allowFontScaling={false}
          numberOfLines={1}
        >
          ~{value}
        </Text>
      </View>
      <Text style={styles.numberLabel}>{label}</Text>
    </View>
  );
}

/**
 * Card 4 — "the number". Two figures count up together from the instant
 * the card lands (a scale-and-fade pop, not a fade-in), then two context
 * lines rise once both have settled to give the numbers a lifetime-scale
 * meaning. It takes the whole page rather than sitting in a boxed card,
 * so it lands as a moment.
 *
 * The count is driven by a plain rAF loop writing `elapsed` to state,
 * not Reanimated: entrance, both counts and the context fade are all
 * re-derived from the same pure helpers each frame, so the maths is the
 * code the tests exercise and there is nothing left animating once the
 * sequence is done.
 *
 * Armed by `active`: nothing runs until the card is the centred one, so
 * it never fires while off-screen and it replays if the user scrolls
 * away and back. With `reducedMotion` the numbers appear already at
 * their targets, full size, and the context is static — no motion.
 */
const NumberCard = memo(function NumberCard({
  active,
  reducedMotion,
  accentColor,
  height,
}: {
  active: boolean;
  reducedMotion: boolean;
  accentColor: string;
  height: number;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0); // reset so a return to the card replays it
      return;
    }
    if (reducedMotion) {
      setElapsed(FAKE_FEED_NUMBER_TOTAL_MS); // straight to final state
      return;
    }
    let raf = 0;
    let t0 = 0;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const e = ts - t0;
      if (e < FAKE_FEED_NUMBER_TOTAL_MS) {
        setElapsed(e);
        raf = requestAnimationFrame(tick);
      } else {
        setElapsed(FAKE_FEED_NUMBER_TOTAL_MS);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reducedMotion]);

  const distance = Math.round(countUpValue(elapsed, FAKE_FEED_NUMBER.distance));
  const videos = Math.round(countUpValue(elapsed, FAKE_FEED_NUMBER.videos));
  const ctx = contextOpacity(elapsed);
  const enter = {
    opacity: entranceOpacity(elapsed),
    transform: [{ scale: entranceScale(elapsed) }],
  };

  return (
    <View style={[styles.numberPage, { height }]}>
      <View style={styles.numbersGroup}>
        <View style={enter}>
          <StatNumber
            value={distance}
            accentColor={accentColor}
            label={t('toolkit.techniques.fake_feed.number_card.distance_label')}
          />
        </View>
        <View style={enter}>
          <StatNumber
            value={videos}
            accentColor={accentColor}
            label={t('toolkit.techniques.fake_feed.number_card.videos_label')}
          />
        </View>
      </View>

      {/* The meaning, after the figures. Rises as one block once both
          numbers have landed — bright and legible, not a footnote. */}
      <View style={[styles.contextGroup, { opacity: ctx }]}>
        <View
          style={[
            styles.contextDivider,
            { backgroundColor: hexAlpha(accentColor, 0.5) },
          ]}
        />
        <Text style={styles.context}>
          {t('toolkit.techniques.fake_feed.number_card.context_distance')}
        </Text>
        <Text style={styles.context}>
          {t('toolkit.techniques.fake_feed.number_card.context_videos')}
        </Text>
      </View>
    </View>
  );
});

/**
 * Continuous foreground clock for a looping card animation. Ticks (via
 * rAF, writing `elapsed` to state) only while the card is `active` and
 * motion is allowed — a card scrolled off-screen stops animating, and
 * reducedMotion never starts. Each arming resets to zero, so the loop
 * begins cleanly when the card is returned to.
 *
 * The pure frame maths lives in fakeFeedMotion.ts; this just supplies
 * the clock. rAF rather than Reanimated on purpose: the value is read
 * back into JS to drive the frame, which keeps the animation the same
 * code the tests exercise and observable in the web preview.
 */
function useLoopElapsed(active: boolean, reducedMotion: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || reducedMotion) return;
    let raf = 0;
    let t0 = 0;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      setElapsed(ts - t0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reducedMotion]);
  return elapsed;
}

/**
 * Card 1's scroll invitation: a chevron under "Scroll down." that drifts
 * down and fades on a calm ~1.7s loop, nudging the reflex the exercise
 * rides. reducedMotion leaves a still chevron in its place.
 */
const ScrollInvite = memo(function ScrollInvite({
  active,
  reducedMotion,
  accentColor,
}: {
  active: boolean;
  reducedMotion: boolean;
  accentColor: string;
}) {
  const elapsed = useLoopElapsed(active, reducedMotion);
  const { translateY, opacity } = reducedMotion
    ? SCROLL_INVITE_REST
    : scrollInviteFrame(elapsed);
  return (
    <View style={styles.invitationWrap} pointerEvents="none">
      <View style={{ opacity, transform: [{ translateY }] }}>
        <ChevronDown size={30} color={accentColor} strokeWidth={2.5} />
      </View>
    </View>
  );
});

/**
 * Card 6's slow pulse: a soft accent light that breathes on a
 * deliberately long ~4.5s cycle — slower than the scroll tempo, so
 * watching it eases the user off the reflex. NOT a breathing exercise:
 * there is no instruction, only a calm light to settle on. A faint halo
 * (blurred on web) behind a brighter core, both riding the same breath.
 * reducedMotion leaves a still glow.
 */
const SlowPulse = memo(function SlowPulse({
  active,
  reducedMotion,
  accentColor,
}: {
  active: boolean;
  reducedMotion: boolean;
  accentColor: string;
}) {
  const elapsed = useLoopElapsed(active, reducedMotion);
  const { scale, opacity, glow } = reducedMotion
    ? SLOW_PULSE_REST
    : slowPulseFrame(elapsed);
  return (
    <View style={styles.pulseWrap} pointerEvents="none">
      <View
        style={[
          styles.pulseHalo,
          {
            backgroundColor: hexAlpha(accentColor, 0.22),
            opacity: 0.35 + glow * 0.4,
            transform: [{ scale: scale * 1.15 }],
          },
        ]}
      />
      <View
        style={[
          styles.pulseCore,
          {
            backgroundColor: hexAlpha(accentColor, 0.9),
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
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
  invitationWrap: {
    height: 48,
    marginTop: dsSpacing.md,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pulseWrap: {
    width: 160,
    height: 160,
    marginBottom: dsSpacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseHalo: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    ...Platform.select({ web: { filter: 'blur(22px)' }, default: {} }),
  },
  pulseCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    ...Platform.select({ web: { filter: 'blur(6px)' }, default: {} }),
  },
  numberPage: {
    width: '100%',
    paddingHorizontal: dsSpacing.x3l,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numbersGroup: {
    alignItems: 'center',
    gap: dsSpacing.x4l,
  },
  statBlock: { alignItems: 'center', gap: dsSpacing.sm },
  heroWrap: { alignItems: 'center', justifyContent: 'center' },
  heroBack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    fontFamily: FONT_STACK,
    fontSize: HERO_SIZE,
    fontWeight: dsFont.weight.bold,
    letterSpacing: -1,
    color: 'rgba(0, 0, 0, 0.55)',
    transform: [{ translateY: 6 }],
    textAlign: 'center',
  },
  heroFront: {
    fontFamily: FONT_STACK,
    fontSize: HERO_SIZE,
    fontWeight: dsFont.weight.bold,
    letterSpacing: -1,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 26,
    textAlign: 'center',
  },
  numberLabel: {
    color: dsColors.textSecondary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.bodyLg,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
  },
  contextGroup: {
    marginTop: dsSpacing.x4l,
    alignItems: 'center',
    gap: dsSpacing.sm,
  },
  contextDivider: {
    width: 44,
    height: 2,
    borderRadius: 1,
    marginBottom: dsSpacing.xs,
  },
  context: {
    color: dsColors.textSecondary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.bodyLg,
    lineHeight: 24,
    textAlign: 'center',
  },
});
