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
  RIPPLE_COUNT,
  SCROLL_CASCADE_COUNT,
  SLOW_PULSE_REST,
  cascadeChevron,
  rippleRing,
  slowPulseFrame,
} from './fakeFeedMotion';
import type { SceneProps } from './types';

/** Cards that carry their own full-screen treatment. */
const NUMBER_CARD_KEY = 'number';
const INVITE_CARD_KEY = 'invitation';
const PULSE_CARD_KEY = 'slow_pulse';

/**
 * Per-card identity colours. These cards deliberately do NOT all wear the
 * feed's blue: card 1 is a cool near-white, card 6 a serene teal. The
 * count-up (card 4) keeps the doomscroll accent it was approved with;
 * everything else owns its own light.
 */
const INVITE_COLOR = '#E3EEFF';
const PULSE_COLOR = '#3FD8C7';

/**
 * Fake Feed — a feed that ends.
 *
 * The doomscroll urge is a *reflex*: the thumb wants to scroll. Fighting
 * that reflex head-on rarely works, so this satisfies it on safe ground
 * — a finite feed the user scrolls through until it runs out. The point
 * of the exercise is the ending: flows can end. Infinite feeds just hide
 * where theirs would be.
 *
 * Every card is FULL-BLEED — no boxed surface. Each one owns the whole
 * page, sitting straight on the shell's atmosphere, so the feed reads as
 * a series of moments rather than a list of cards.
 *
 * Guardrails. Mimicking a feed is only useful if it never becomes one:
 *   1. FINITE — exactly {@link FAKE_FEED_CARD_COUNT} cards, then
 *      `onComplete()`. Nothing loops, nothing exists past the last card,
 *      and `bounces` is off so there is no "pull for more" gesture.
 *   2. NO REWARD — no counters, no streaks, nothing that lands as a hit.
 *      Only two haptics in the whole run: one as the feed winds down, one
 *      at the end.
 *
 * FREE SCROLL. The scroll is never gated: all cards are present from the
 * start and the user moves at their own pace. Finiteness, not a timer, is
 * the lesson — however fast you scroll, you hit the bottom. Reaching the
 * last card ends the exercise.
 */

/**
 * How long the closing card holds the screen before the exercise reports
 * done — not a scroll gate, just a beat so the final line is read rather
 * than flashed past. Cancelled the instant the user scrolls back up.
 *
 * ESTIMATE — a read-time guess, not a measurement.
 */
const END_READ_MS = 1200;

export function FakeFeedScreen({
  accentColor,
  onComplete,
  haptics,
  reducedMotion,
}: SceneProps) {
  // Height of one page — measured, since the scene is laid out by the
  // runner and paging must match it exactly.
  const [pageH, setPageH] = useState(0);

  // Which card is centred right now — arms a card's own animation the
  // moment it lands (nothing should run while off-screen). One re-render
  // per page change, not per frame.
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
  // onMomentumScrollEnd nor onScrollEndDrag — without onScroll the
  // haptics, the per-card arming and the completion beat would never
  // fire on web.
  //
  // Since onScroll also fires mid-gesture, an offset that is not on a
  // page boundary is ignored: paging always comes to rest on one, so an
  // off-boundary sample means the card is still moving.
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
        // No overscroll: no gesture that hints more content could arrive.
        bounces={false}
        overScrollMode="never"
        decelerationRate="fast"
        onMomentumScrollEnd={handleSettle}
        onScrollEndDrag={handleSettle}
        onScroll={handleSettle}
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
 * Dispatcher. Each card is a full-page treatment of its own; memoised so
 * a parent re-render never re-renders every card (props are primitives or
 * stable module-level card objects, so the shallow compare is exact).
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
  /** True while this card is the centred one — arms its animation. */
  active: boolean;
  reducedMotion: boolean;
}) {
  switch (card.key) {
    case NUMBER_CARD_KEY:
      return (
        <NumberCard
          height={height}
          accentColor={accentColor}
          active={active}
          reducedMotion={reducedMotion}
        />
      );
    case INVITE_CARD_KEY:
      return (
        <ScrollInviteCard
          height={height}
          active={active}
          reducedMotion={reducedMotion}
        />
      );
    case PULSE_CARD_KEY:
      return (
        <SlowPulseCard
          height={height}
          active={active}
          reducedMotion={reducedMotion}
        />
      );
    default:
      return <PlainCard card={card} height={height} />;
  }
});

/**
 * A card that is still just its line of copy — full-bleed, centred on the
 * page, no box. These get their own treatments in later steps; until
 * then the words stand on their own on the atmosphere.
 */
function PlainCard({ card, height }: { card: FakeFeedCard; height: number }) {
  return (
    <View style={[styles.fullPage, { height }]}>
      <Text style={styles.plainText}>
        {t(`toolkit.techniques.fake_feed.cards.${card.key}`)}
      </Text>
    </View>
  );
}

/**
 * Continuous foreground clock for a looping card animation. Ticks (via
 * rAF, writing `elapsed` to state) only while the card is `active` and
 * motion is allowed — off-screen cards stop animating, reducedMotion
 * never starts. Each arming resets to zero.
 *
 * rAF rather than Reanimated on purpose: the value is read back into JS
 * to drive the frame, which keeps the animation the same code the tests
 * exercise and observable in the web preview.
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
 * Card 1 — the scroll invitation. Full page: "Scroll down." over a
 * stream of chevrons that fall down the screen and fade, phase-offset
 * into a continuous downward cascade that pulls the eye (and thumb) the
 * way the feed wants to go. Cool near-white, not the feed's blue.
 * reducedMotion leaves the chevrons as a still, spaced column.
 */
const ScrollInviteCard = memo(function ScrollInviteCard({
  height,
  active,
  reducedMotion,
}: {
  height: number;
  active: boolean;
  reducedMotion: boolean;
}) {
  const elapsed = useLoopElapsed(active, reducedMotion);
  const chevrons = Array.from({ length: SCROLL_CASCADE_COUNT }, (_, i) =>
    cascadeChevron(reducedMotion ? 0 : elapsed, i)
  );
  return (
    <View style={[styles.fullPage, { height }]}>
      <Text style={styles.inviteText}>
        {t('toolkit.techniques.fake_feed.cards.invitation')}
      </Text>
      <View style={styles.cascade} pointerEvents="none">
        {chevrons.map((c, i) => (
          <View
            key={i}
            style={[
              styles.cascadeChevron,
              { opacity: c.opacity, transform: [{ translateY: c.translateY }] },
            ]}
          >
            <ChevronDown size={36} color={INVITE_COLOR} strokeWidth={2.5} />
          </View>
        ))}
      </View>
    </View>
  );
});

/**
 * Card 6 — the slow pulse. Full page: a serene teal light that breathes
 * on a deliberately long ~4.5s cycle while rings ripple outward across
 * the screen on the same breath — far slower than the scroll tempo, so
 * watching it eases the reflex. NOT a breathing exercise: no instruction,
 * only a calm light to settle on. Teal, not the feed's blue.
 * reducedMotion leaves a still glow and static rings.
 */
const SlowPulseCard = memo(function SlowPulseCard({
  height,
  active,
  reducedMotion,
}: {
  height: number;
  active: boolean;
  reducedMotion: boolean;
}) {
  const elapsed = useLoopElapsed(active, reducedMotion);
  const core = reducedMotion ? SLOW_PULSE_REST : slowPulseFrame(elapsed);
  const rings = Array.from({ length: RIPPLE_COUNT }, (_, i) =>
    rippleRing(reducedMotion ? 0 : elapsed, i)
  );
  return (
    <View style={[styles.fullPage, { height }]}>
      <View style={styles.pulseStage} pointerEvents="none">
        {rings.map((r, i) => (
          <View
            key={i}
            style={[
              styles.ripple,
              {
                borderColor: hexAlpha(PULSE_COLOR, 0.9),
                opacity: r.opacity,
                transform: [{ scale: r.scale }],
              },
            ]}
          />
        ))}
        <View
          style={[
            styles.pulseHalo,
            {
              backgroundColor: hexAlpha(PULSE_COLOR, 0.3),
              opacity: 0.3 + core.glow * 0.45,
              transform: [{ scale: core.scale * 1.25 }],
            },
          ]}
        />
        <View
          style={[
            styles.pulseCore,
            {
              backgroundColor: hexAlpha(PULSE_COLOR, 0.95),
              opacity: core.opacity,
              transform: [{ scale: core.scale }],
            },
          ]}
        />
      </View>
      <Text style={styles.pulseCopy}>
        {t('toolkit.techniques.fake_feed.cards.slow_pulse')}
      </Text>
    </View>
  );
});

/**
 * Hero pixel size of the numerals. Deliberately far past the display
 * scale (largest token is 48). ESTIMATE, tuned by eye.
 */
const HERO_SIZE = 84;

/**
 * One big count-up figure: a glowing numeral over an offset dark twin.
 * The twin gives it depth; the glow gives it neon presence. Two Text
 * nodes, no SVG — nothing rasterises while the feed scrolls.
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
 * Card 4 — "the number". Two figures count up together the instant the
 * card lands (a scale-and-fade pop), then two context lines rise once
 * both have settled. Full-page, driven by one rAF clock through pure,
 * tested helpers; reducedMotion shows the finals at full size, no motion.
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

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },

  // Shared full-page frame for every card.
  fullPage: {
    width: '100%',
    paddingHorizontal: dsSpacing.x3l,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plainText: {
    color: dsColors.textPrimary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.displayMd,
    fontWeight: dsFont.weight.semibold,
    lineHeight: 38,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
  },

  // Card 1 — scroll invitation.
  inviteText: {
    color: dsColors.textPrimary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.displayLg,
    fontWeight: dsFont.weight.bold,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
    marginBottom: dsSpacing.x3l,
  },
  cascade: {
    width: 60,
    height: 140,
    alignItems: 'center',
  },
  cascadeChevron: {
    position: 'absolute',
    top: 0,
  },

  // Card 6 — slow pulse.
  pulseStage: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
  },
  pulseHalo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    ...Platform.select({ web: { filter: 'blur(26px)' }, default: {} }),
  },
  pulseCore: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 37,
    ...Platform.select({ web: { filter: 'blur(8px)' }, default: {} }),
  },
  pulseCopy: {
    color: dsColors.textPrimary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.displaySm,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
    marginTop: dsSpacing.x4l,
  },

  // Card 4 — the number.
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
