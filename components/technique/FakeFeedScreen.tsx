import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ChevronUp } from 'lucide-react-native';
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
  EMPTY_REVEAL_MS,
  FILL_TOTAL_RAD,
  SCROLL_CASCADE_COUNT,
  THUMB_REST,
  cascadeChevron,
  emptyLineOpacity,
  fillGain,
  ghostY,
  shortestAngle,
  thumbArc,
} from './fakeFeedMotion';
import type { SceneHaptics, SceneProps } from './types';

/** Cards that carry their own full-screen treatment. */
const NUMBER_CARD_KEY = 'number';
const INVITE_CARD_KEY = 'invitation';
const PULSE_CARD_KEY = 'slow_pulse';
const MIRROR_CARD_KEY = 'speed_mirror';
const EMPTY_CARD_KEY = 'empty_search';
const THUMB_CARD_KEY = 'thumb';

/** Card 3's fingertip — a soft cool light, its own understated colour. */
const THUMB_COLOR = '#D6E2F5';

/**
 * The right thumb's swipe-up arc, in the lower-right. A quadratic bezier
 * that starts low near the right edge and sweeps up and inward, bowed
 * right — the natural path a thumb traces when it pivots from its joint
 * to flick the feed up. p0 = bottom (start), p2 = top (end), p1 = the
 * outward control that gives it the curve.
 */
const THUMB_ARC = {
  w: 184,
  h: 268,
  p0: [152, 240] as const,
  p1: [180, 92] as const,
  p2: [64, 26] as const,
};
const THUMB_TIP = 28;

/** Point on a quadratic bezier at t. */
function bezier(t: number, a: number, b: number, c: number): number {
  const u = 1 - t;
  return u * u * a + 2 * u * t * b + t * t * c;
}

/**
 * Card 2's ghost feed — DISTINCT blurred posts, not identical blocks.
 * Identical evenly-spaced skeletons look static even while scrolling
 * (the eye has nothing to track); varied heights and layouts give it a
 * reference, so the upward flow reads as a fast scroll rather than a
 * frozen loading screen.
 */
const GHOST_TEMPLATES = [
  { h: 132, image: true, lines: 2 },
  { h: 86, image: false, lines: 2 },
  { h: 158, image: true, lines: 1 },
  { h: 74, image: false, lines: 1 },
  { h: 116, image: false, lines: 3 },
  { h: 104, image: true, lines: 2 },
] as const;
const GHOST_COUNT = GHOST_TEMPLATES.length;
const GHOST_SPACING = 184;

/**
 * Card 1's own light — a cool near-white, not the feed's blue. Card 4
 * (numbers) and card 6 (the fill ring) wear the doomscroll accent; the
 * rest own their own colour rather than all matching.
 */
const INVITE_COLOR = '#E3EEFF';

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
 *   2. NO REWARD — no counters, no streaks, nothing that lands as a hit
 *      per scroll. The only haptics are earned, not sprayed: one as the
 *      feed winds down, one when card 6's slow-drag ring is completed
 *      (a mindful action, not a swipe), and one at the end.
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

  // Card 6's drag ring locks the feed while a fill is in progress, so
  // turning the ring doesn't also scroll the page (the two gestures were
  // fighting). Only the ring area locks it, and only until the finger
  // lifts — outside the ring, and after completion, the feed scrolls
  // normally. See DragToFillCard.
  const [scrollLocked, setScrollLocked] = useState(false);

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
        scrollEnabled={!scrollLocked}
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
                haptics={haptics}
                onDragLock={setScrollLocked}
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
  haptics,
  onDragLock,
}: {
  card: FakeFeedCard;
  height: number;
  accentColor: string;
  /** True while this card is the centred one — arms its animation. */
  active: boolean;
  reducedMotion: boolean;
  haptics?: SceneHaptics;
  /** Card 6 uses this to freeze the feed while its ring is being dragged. */
  onDragLock: (locked: boolean) => void;
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
        <DragToFillCard
          height={height}
          accentColor={accentColor}
          reducedMotion={reducedMotion}
          haptics={haptics}
          onDragLock={onDragLock}
        />
      );
    case MIRROR_CARD_KEY:
      return (
        <ScrollMirrorCard
          height={height}
          active={active}
          reducedMotion={reducedMotion}
        />
      );
    case EMPTY_CARD_KEY:
      return (
        <EmptyCard
          height={height}
          active={active}
          reducedMotion={reducedMotion}
        />
      );
    case THUMB_CARD_KEY:
      return (
        <ThumbCard
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
function useLoopElapsed(
  active: boolean,
  reducedMotion: boolean,
  stopAtMs?: number
): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    if (reducedMotion) {
      // No motion, but keep the timeline: a card whose reveal is timed
      // (card 5) still waits, it just doesn't tween. Others read 0.
      if (stopAtMs != null) setElapsed(stopAtMs);
      return;
    }
    let raf = 0;
    let t0 = 0;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const e = ts - t0;
      setElapsed(e);
      if (stopAtMs != null && e >= stopAtMs) return; // one-shot: stop
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reducedMotion, stopAtMs]);
  return elapsed;
}

/**
 * Card 2 — "This is how we scroll." Not the user's data: a generic,
 * blurred, unreadable stream of content ghosts flying up fast, the
 * doomscroll tempo seen from the outside. The collective "we" lets the
 * user recognise their own pace in it. reducedMotion freezes the strip.
 *
 * The ghosts are plain rounded shapes (a faint avatar dot + two bars),
 * blurred on web so they read as "content" without being any content.
 * On native, where the blur is unavailable, they stay low-contrast and
 * featureless enough to read as ghosts rather than real posts.
 */
const ScrollMirrorCard = memo(function ScrollMirrorCard({
  height,
  active,
  reducedMotion,
}: {
  height: number;
  active: boolean;
  reducedMotion: boolean;
}) {
  const elapsed = useLoopElapsed(active, reducedMotion);
  return (
    <View style={[styles.fullPage, { height }]}>
      <View style={styles.mirrorFlow} pointerEvents="none">
        {GHOST_TEMPLATES.map((tpl, i) => {
          const y = ghostY(
            reducedMotion ? 0 : elapsed,
            i,
            GHOST_SPACING,
            GHOST_COUNT
          );
          return (
            <View
              key={i}
              style={[styles.ghost, { top: y - GHOST_SPACING, height: tpl.h }]}
            >
              <View style={styles.ghostHeader}>
                <View style={styles.ghostAvatar} />
                <View style={styles.ghostHeaderLines}>
                  <View style={[styles.ghostBar, { width: '52%' }]} />
                  <View
                    style={[
                      styles.ghostBar,
                      styles.ghostBarThin,
                      { width: '34%' },
                    ]}
                  />
                </View>
              </View>
              {tpl.image && <View style={styles.ghostImage} />}
              <View style={styles.ghostBody}>
                {Array.from({ length: tpl.lines }, (_, k) => (
                  <View
                    key={k}
                    style={[styles.ghostBar, { width: `${88 - k * 16}%` }]}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
      {/* A veil so the stream reads as atmosphere behind the words. */}
      <View style={styles.mirrorVeil} pointerEvents="none" />
      <Text style={styles.mirrorText}>
        {t('toolkit.techniques.fake_feed.cards.speed_mirror')}
      </Text>
    </View>
  );
});

/**
 * Card 5 — the deliberate emptiness. Opens as pure void; only after a
 * few seconds of real silence does one faint line fade in to confirm the
 * emptiness is the point (not a failed load). The pause before the line
 * is what makes the void land — and what tells the user it was chosen.
 * Distinct from card 9's "bottom": this is the absence of what you came
 * looking for, not the end of the feed.
 */
const EmptyCard = memo(function EmptyCard({
  height,
  active,
  reducedMotion,
}: {
  height: number;
  active: boolean;
  reducedMotion: boolean;
}) {
  const elapsed = useLoopElapsed(active, reducedMotion, EMPTY_REVEAL_MS + 2400);
  const opacity = emptyLineOpacity(elapsed);
  return (
    <View style={[styles.fullPage, { height }]}>
      <Text style={[styles.emptyText, { opacity }]}>
        {t('toolkit.techniques.fake_feed.cards.empty_search')}
      </Text>
    </View>
  );
});

/**
 * Card 3 — "Notice your thumb." The autopilot scroll gesture, made
 * visible without a literal thumb: a soft, glowing capsule (a stylised
 * fingertip) drifts down a faint track in the lower-right, pressing in
 * slightly, fading out at the bottom and repeating on a calm ~2s loop.
 * Deliberately abstract and understated — a hint of a fingertip, not a
 * hand — so it belongs to the atmosphere rather than startling. Its own
 * soft cool light, not the feed's blue. reducedMotion holds it still.
 */
const ThumbCard = memo(function ThumbCard({
  height,
  active,
  reducedMotion,
}: {
  height: number;
  active: boolean;
  reducedMotion: boolean;
}) {
  const elapsed = useLoopElapsed(active, reducedMotion);
  const {
    t: arcT,
    opacity,
    scale,
  } = reducedMotion ? THUMB_REST : thumbArc(elapsed);
  const { w, h, p0, p1, p2 } = THUMB_ARC;
  const fx = bezier(arcT, p0[0], p1[0], p2[0]);
  const fy = bezier(arcT, p0[1], p1[1], p2[1]);
  return (
    <View style={[styles.fullPage, { height }]}>
      <Text style={styles.thumbText}>
        {t('toolkit.techniques.fake_feed.cards.thumb')}
      </Text>
      <View style={styles.thumbZone} pointerEvents="none">
        <Svg width={w} height={h}>
          {/* The faint arc — the thumb's path, so the sweep reads as a
              curved gesture rather than a floating dot. */}
          <Path
            d={`M${p0[0]},${p0[1]} Q${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`}
            stroke={hexAlpha(THUMB_COLOR, 0.14)}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
        {/* The fingertip, riding the arc from bottom to top. */}
        <View
          style={[
            styles.thumbTip,
            {
              left: fx - THUMB_TIP / 2,
              top: fy - THUMB_TIP / 2,
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <View style={styles.thumbTipCore} />
        </View>
      </View>
    </View>
  );
});

/**
 * Card 1 — the scroll invitation. Full page: a stream of chevrons that
 * RISE up the screen and fade, phase-offset into a continuous cascade
 * that points the thumb the way the feed actually advances (swipe up),
 * over the "Scroll down." line. Big, slow and smooth — a calm pull, not
 * a nervous flicker. Cool near-white, not the feed's blue. reducedMotion
 * leaves the chevrons as a still, spaced column.
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
      <View style={styles.cascade} pointerEvents="none">
        {chevrons.map((c, i) => (
          <View
            key={i}
            style={[
              styles.cascadeChevron,
              { opacity: c.opacity, transform: [{ translateY: c.translateY }] },
            ]}
          >
            <ChevronUp size={46} color={INVITE_COLOR} strokeWidth={2.25} />
          </View>
        ))}
      </View>
      <Text style={styles.inviteText}>
        {t('toolkit.techniques.fake_feed.cards.invitation')}
      </Text>
    </View>
  );
});

// Fill-ring geometry.
const RING_SIZE = 240;
const RING_R = 96;
const RING_CX = RING_SIZE / 2;
const RING_STROKE = 9;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Card 6 — "Slow down", made a mechanic instead of a picture. A ring
 * waits to be filled; the user drags a handle around it, and it only
 * fills while the drag is SLOW — rush it and the fill stalls and slips
 * back a touch (see {@link fillGain}). So the instruction is lived in the
 * thumb: to make progress the body has to brake the scroll reflex. When
 * the ring closes it glows and gives one earned haptic.
 *
 * The feed is free-scroll, so no one is ever trapped here — a user who
 * can't or won't drag just swipes on to the next card. reducedMotion
 * keeps the full mechanic (it's a motion preference, not an access need)
 * and only drops the completion bloom.
 *
 * Distinct from card 7 (Hold to pause): this is a drag, that is a press.
 */
const DragToFillCard = memo(function DragToFillCard({
  height,
  accentColor,
  reducedMotion,
  haptics,
  onDragLock,
}: {
  height: number;
  accentColor: string;
  reducedMotion: boolean;
  haptics?: SceneHaptics;
  onDragLock: (locked: boolean) => void;
}) {
  const [progress, setProgress] = useState(0); // radians accrued
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0); // 0→1 one-shot completion anim
  const doneRef = useRef(false);
  const stageRef = useRef<View>(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const lastAngleRef = useRef(0);
  const lastTimeRef = useRef(0);
  const hapticsRef = useRef(haptics);
  hapticsRef.current = haptics;
  const onDragLockRef = useRef(onDragLock);
  onDragLockRef.current = onDragLock;

  // Make sure the feed is never left frozen if the card unmounts mid-drag.
  useEffect(() => () => onDragLockRef.current(false), []);

  // Completion celebration: a one-shot ~750ms curve the ring reads off to
  // pop, flash a shockwave and settle into a steady glow. reducedMotion
  // jumps straight to the settled state — no burst.
  useEffect(() => {
    if (!done) return;
    if (reducedMotion) {
      setBurst(1);
      return;
    }
    let raf = 0;
    let t0 = 0;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min(1, (ts - t0) / 750);
      setBurst(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done, reducedMotion]);

  // Ring centre in window coords, so a touch anywhere can be turned into
  // an angle. Re-measured on layout and at the start of each drag.
  const measure = useCallback(() => {
    stageRef.current?.measureInWindow?.((x, y, w, h) => {
      centerRef.current = { x: x + w / 2, y: y + h / 2 };
    });
  }, []);

  const angleAt = useCallback(
    (pageX: number, pageY: number) =>
      Math.atan2(pageY - centerRef.current.y, pageX - centerRef.current.x),
    []
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Once the ring is full it no longer claims touches, so the feed
        // scrolls normally again even with a finger on the ring.
        onStartShouldSetPanResponder: () => !doneRef.current,
        onMoveShouldSetPanResponder: () => !doneRef.current,
        // While a fill is in progress, refuse to hand the gesture to the
        // parent ScrollView — the drag owns it, so turning the ring can't
        // also scroll the page.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e) => {
          onDragLockRef.current(true); // freeze the feed for this drag
          measure();
          lastAngleRef.current = angleAt(
            e.nativeEvent.pageX,
            e.nativeEvent.pageY
          );
          lastTimeRef.current = Date.now();
        },
        onPanResponderMove: (e) => {
          if (doneRef.current) return;
          const ang = angleAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
          const now = Date.now();
          const gain = fillGain(
            shortestAngle(lastAngleRef.current, ang),
            now - lastTimeRef.current
          );
          lastAngleRef.current = ang;
          lastTimeRef.current = now;
          setProgress((prev) => {
            const next = Math.max(0, Math.min(FILL_TOTAL_RAD, prev + gain));
            if (next >= FILL_TOTAL_RAD && !doneRef.current) {
              doneRef.current = true;
              setDone(true);
              hapticsRef.current?.commit();
            }
            return next;
          });
        },
        // Finger up (or the gesture stolen anyway): let the feed scroll.
        onPanResponderRelease: () => onDragLockRef.current(false),
        onPanResponderTerminate: () => onDragLockRef.current(false),
      }),
    [measure, angleAt]
  );

  const frac = Math.min(1, progress / FILL_TOTAL_RAD);
  const theta = -Math.PI / 2 + frac * 2 * Math.PI;
  const handleX = RING_CX + RING_R * Math.cos(theta);
  const handleY = RING_CX + RING_R * Math.sin(theta);

  // Completion curve → the burst's shockwave and settled glow.
  const eo = 1 - (1 - burst) * (1 - burst); // easeOut
  const litStroke = done ? '#CDE8FF' : accentColor; // fill brightens when full
  const dashOffset = RING_C * (1 - frac);
  const rot = `rotate(-90 ${RING_CX} ${RING_CX})`;

  return (
    <View style={[styles.fullPage, { height }]}>
      <View
        ref={stageRef}
        onLayout={measure}
        style={styles.dragStage}
        {...pan.panHandlers}
      >
        {/* Settled glow behind the ring once it closes. */}
        {done && (
          <View style={styles.overlayCenter} pointerEvents="none">
            <View
              style={[
                styles.completeGlow,
                {
                  backgroundColor: hexAlpha(accentColor, 0.55),
                  opacity: 0.22 + 0.5 * eo,
                  transform: [{ scale: 0.85 + 0.4 * eo }],
                },
              ]}
            />
          </View>
        )}

        <Svg width={RING_SIZE} height={RING_SIZE}>
          {/* Track. */}
          <Circle
            cx={RING_CX}
            cy={RING_CX}
            r={RING_R}
            stroke={hexAlpha(accentColor, 0.16)}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          {/* Neon halo — a wide, soft stroke under the crisp fill. */}
          <Circle
            cx={RING_CX}
            cy={RING_CX}
            r={RING_R}
            stroke={hexAlpha(litStroke, 0.28)}
            strokeWidth={RING_STROKE * 2.6}
            fill="none"
            strokeDasharray={RING_C}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={rot}
          />
          {/* Crisp fill. */}
          <Circle
            cx={RING_CX}
            cy={RING_CX}
            r={RING_R}
            stroke={litStroke}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={RING_C}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={rot}
          />
          {/* Handle — the tip the finger drags; it tracks the fill 1:1. */}
          <Circle
            cx={handleX}
            cy={handleY}
            r={done ? 13 : 11}
            fill={done ? '#FFFFFF' : accentColor}
          />
        </Svg>

        {/* Shockwave — a bright ring that expands out of the circle once
            and fades, the "done" pop. */}
        {done && !reducedMotion && (
          <View style={styles.overlayCenter} pointerEvents="none">
            <View
              style={[
                styles.shockwave,
                {
                  borderColor: hexAlpha('#FFFFFF', 0.85 * (1 - eo)),
                  opacity: 1 - eo,
                  transform: [{ scale: 1 + 0.8 * eo }],
                },
              ]}
            />
          </View>
        )}
      </View>
      <Text style={styles.dragText}>
        {t('toolkit.techniques.fake_feed.cards.slow_pulse')}
      </Text>
      <Text style={styles.dragHint}>
        {t('toolkit.techniques.fake_feed.pulse_hint')}
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

  // Card 1 — scroll invitation (rising chevrons over the copy).
  inviteText: {
    color: dsColors.textPrimary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.displayLg,
    fontWeight: dsFont.weight.bold,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
  },
  cascade: {
    width: 60,
    height: 150,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: dsSpacing.x3l,
  },
  cascadeChevron: {
    position: 'absolute',
    bottom: 0,
  },

  // Card 6 — drag-to-fill ring.
  dragStage: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: dsSpacing.x4l,
  },
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeGlow: {
    width: RING_SIZE * 0.8,
    height: RING_SIZE * 0.8,
    borderRadius: RING_SIZE,
    ...Platform.select({ web: { filter: 'blur(38px)' }, default: {} }),
  },
  shockwave: {
    width: RING_SIZE * 0.82,
    height: RING_SIZE * 0.82,
    borderRadius: RING_SIZE,
    borderWidth: 3,
  },

  // Card 2 — the collective scroll flow.
  mirrorFlow: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    ...Platform.select({ web: { filter: 'blur(7px)' }, default: {} }),
  },
  ghost: {
    position: 'absolute',
    left: dsSpacing.xxl,
    right: dsSpacing.xxl,
    borderRadius: 18,
    backgroundColor: hexAlpha(dsColors.cardSurface, 0.5),
    padding: dsSpacing.lg,
    overflow: 'hidden',
    gap: dsSpacing.md,
  },
  ghostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dsSpacing.md,
  },
  ghostHeaderLines: { flex: 1, gap: dsSpacing.sm },
  ghostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: hexAlpha(dsColors.textSecondary, 0.28),
  },
  ghostImage: {
    height: 56,
    borderRadius: 12,
    backgroundColor: hexAlpha(dsColors.textSecondary, 0.16),
  },
  ghostBody: { gap: dsSpacing.sm },
  ghostBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: hexAlpha(dsColors.textSecondary, 0.24),
  },
  ghostBarThin: { height: 9 },
  mirrorVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: hexAlpha(dsColors.bgBase, 0.58),
  },
  mirrorText: {
    color: dsColors.textPrimary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.displayLg,
    fontWeight: dsFont.weight.bold,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
  },

  // Card 5 — the deliberate emptiness.
  emptyText: {
    color: dsColors.textTertiary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.body,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
  },

  // Card 3 — notice your thumb.
  thumbText: {
    color: dsColors.textPrimary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.displayMd,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
  },
  thumbZone: {
    position: 'absolute',
    right: 20,
    bottom: 92,
    width: THUMB_ARC.w,
    height: THUMB_ARC.h,
  },
  thumbTip: {
    position: 'absolute',
    width: THUMB_TIP,
    height: THUMB_TIP,
    borderRadius: THUMB_TIP / 2,
    backgroundColor: hexAlpha(THUMB_COLOR, 0.18),
    borderWidth: 1,
    borderColor: hexAlpha(THUMB_COLOR, 0.45),
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: `0 0 20px ${hexAlpha(THUMB_COLOR, 0.4)}` },
      default: {},
    }),
  },
  thumbTipCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: hexAlpha(THUMB_COLOR, 0.75),
    ...Platform.select({ web: { filter: 'blur(1px)' }, default: {} }),
  },
  dragText: {
    color: dsColors.textPrimary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.displaySm,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
  },
  dragHint: {
    color: dsColors.textSecondary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.body,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: dsSpacing.sm,
    maxWidth: 300,
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
