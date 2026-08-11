import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
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
  FLICK_MS,
  BOTTOM_REVEAL_ATTEMPTS,
  BOTTOM_REVEAL_MS,
  END_HOLD_MS,
  END_TEXT_FADE_MS,
  REEL_COUNT,
  SCROLL_CASCADE_COUNT,
  SHIVER_MS,
  SKIP_AFTER_MS,
  THUMB_REST,
  THUMB_TRAIL_DASH,
  THUMB_TRAIL_GAP,
  WIND_DOWN_MS,
  WIND_DOWN_STATIC_DRAIN,
  bottomMsgOpacity,
  cascadeChevron,
  emptyLineOpacity,
  endTextOpacity,
  fillGain,
  flickEasing,
  flickPause,
  flickTarget,
  holdStep,
  shiverOffset,
  shortestAngle,
  thumbSwipe,
  windDownDrain,
} from './fakeFeedMotion';
import type { SceneHaptics, SceneProps } from './types';

/** Cards that carry their own full-screen treatment. */
const NUMBER_CARD_KEY = 'number';
const INVITE_CARD_KEY = 'invitation';
const PULSE_CARD_KEY = 'slow_pulse';
const MIRROR_CARD_KEY = 'speed_mirror';
const EMPTY_CARD_KEY = 'empty_search';
const THUMB_CARD_KEY = 'thumb';
const HOLD_CARD_KEY = 'hold';
const WINDING_CARD_KEY = 'winding_down';
const BOTTOM_CARD_KEY = 'bottom';
const END_CARD_KEY = 'end';

/**
 * Card 3 — "Notice your thumb." — is drawn on a fixed 390×620 design
 * canvas (the handoff's) and scaled to fill the card. The accent blue is
 * deliberate here: the swipe gesture is *the* doomscroll reflex, so it
 * wears the feed's own colour (as card 6's ring does).
 */
const THUMB_ACCENT = '#42A5F5';
const THUMB_BRIGHT = '#8FCBFF';

/**
 * The right thumb's swipe-up arc: a cubic bezier that starts low
 * (238,539) and sweeps up and inward to the top-right (335,330), bowed
 * the way a thumb pivots from its joint to flick the feed up. The dash
 * comet, the moving fingertip and the faint track all ride this path.
 */
const THUMB_PATH = 'M238,539 C206,474 238,384 335,330';
const THUMB_P = {
  x: [238, 206, 238, 335] as const,
  y: [539, 474, 384, 330] as const,
};
const THUMB_START = { x: 238, y: 539 };
const THUMB_DASH: readonly number[] = [THUMB_TRAIL_DASH, THUMB_TRAIL_GAP];
/** Slight rightward nudge of the whole gesture — a right thumb lives on
 *  the right side of the screen. In 390-wide design units. */
const THUMB_NUDGE_X = 18;

/** Scalar cubic bezier at t for control values (a,b,c,d). */
function cubic(t: number, a: number, b: number, c: number, d: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

/**
 * Card 2 — "Notice the pull." — is built at the handoff's fixed phone
 * dimensions and scaled to fit the page. A neon phone outline holds a
 * clipped screen; inside, blank reel frames flick past.
 */
const FRAME_W = 412;
const FRAME_PAD = 13;
const SCREEN_W = 386;
const SCREEN_H = 800;
const FRAME_OUTER_H = SCREEN_H + FRAME_PAD * 2;
const REEL_H = 764;
const REEL_MARGIN = 16;

/** Per-reel grey tints (slightly varied so a flick reads as motion). The
 *  white border is what must read; these are the fill behind it — lifted
 *  clear of the near-black screen so each frame is legible. */
const REEL_TINTS = [
  '#2c313c',
  '#292f3b',
  '#2e333e',
  '#272d39',
  '#2c323d',
  '#2a3040',
  '#2b303a',
];

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
  const depletionTappedRef = useRef(false);

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

      // Reaching the last card no longer auto-ends here: card 10 (EndCard)
      // owns the closing beat — it reads its line, then completes after a
      // hold or an early tap. Keeping the timing inside that card lets the
      // line be read at full opacity for a set time rather than racing a
      // parent timer.
    },
    [pageH, haptics]
  );

  // The shared escape hatch (cards 6 & 7): a tap on the faint "Skip"
  // advances one card, through the same paging path a swipe would take.
  const goNext = useCallback(() => {
    if (pageH <= 0) return;
    const next = Math.min(FAKE_FEED_CARD_COUNT - 1, indexRef.current + 1);
    scrollRef.current?.scrollTo({ y: next * pageH, animated: true });
  }, [pageH]);

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
                onAdvance={goNext}
                onComplete={onComplete}
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
  onAdvance,
  onComplete,
}: {
  card: FakeFeedCard;
  height: number;
  accentColor: string;
  /** True while this card is the centred one — arms its animation. */
  active: boolean;
  reducedMotion: boolean;
  haptics?: SceneHaptics;
  /** Cards 6, 7 & 9 use this to freeze the feed while a gesture owns it. */
  onDragLock: (locked: boolean) => void;
  /** Cards 6 & 7's shared "Skip" — advance one card. */
  onAdvance: () => void;
  /** Card 10 ends the exercise (hold expiry or an early tap). */
  onComplete: () => void;
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
          active={active}
          reducedMotion={reducedMotion}
          haptics={haptics}
          onDragLock={onDragLock}
          onAdvance={onAdvance}
        />
      );
    case HOLD_CARD_KEY:
      return (
        <HoldToFadeCard
          height={height}
          accentColor={accentColor}
          active={active}
          reducedMotion={reducedMotion}
          haptics={haptics}
          onDragLock={onDragLock}
          onAdvance={onAdvance}
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
    case WINDING_CARD_KEY:
      return (
        <WindDownCard
          height={height}
          active={active}
          reducedMotion={reducedMotion}
        />
      );
    case BOTTOM_CARD_KEY:
      return (
        <BottomCard
          height={height}
          accentColor={accentColor}
          active={active}
          reducedMotion={reducedMotion}
          onDragLock={onDragLock}
        />
      );
    case END_CARD_KEY:
      return (
        <EndCard
          height={height}
          active={active}
          reducedMotion={reducedMotion}
          haptics={haptics}
          onComplete={onComplete}
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
 * Card 8 — "winding down". Not interactive: cards 6 and 7 asked the user
 * to act; here they just watch. On arrival the ghost feed behind drains
 * over {@link WIND_DOWN_MS} — it loses its light, its frames lose their
 * edges, and the column sinks a little: the feed running out of pull, not
 * cut off. Bridges card 7 (feed put out) to card 9 (the bottom). One
 * rAF clock, stops at full drain. reducedMotion rests it visibly depleted.
 */
const WIND_ROWS = 3;
const WindDownCard = memo(function WindDownCard({
  height,
  active,
  reducedMotion,
}: {
  height: number;
  active: boolean;
  reducedMotion: boolean;
}) {
  const elapsed = useLoopElapsed(active, reducedMotion, WIND_DOWN_MS);
  const drain = reducedMotion ? WIND_DOWN_STATIC_DRAIN : windDownDrain(elapsed);
  const rowH = Math.max(150, Math.round(height * 0.26));
  const rows = useMemo(
    () => Array.from({ length: WIND_ROWS * 2 }, (_, i) => i),
    []
  );
  return (
    <View style={[styles.fullPage, { height }]}>
      <View style={styles.holdGhostClip} pointerEvents="none">
        <View
          style={[
            styles.windTrack,
            {
              opacity: 1 - drain * 0.92,
              transform: [{ translateY: drain * 26 }],
            },
          ]}
        >
          {rows.map((i) => (
            <View
              key={i}
              style={[
                styles.windRow,
                {
                  height: rowH,
                  borderColor: hexAlpha('#FFFFFF', 0.12 * (1 - drain)),
                  backgroundColor: hexAlpha('#1b2536', 1 - drain * 0.55),
                },
              ]}
            />
          ))}
        </View>
      </View>
      <Text style={styles.windText}>
        {t('toolkit.techniques.fake_feed.cards.winding_down')}
      </Text>
    </View>
  );
});

/**
 * Card 9 — "the bottom". The feed's content is spent: a single faint
 * horizon line over a void. The reflex to scroll for more hits nothing —
 * while the bottom hasn't spoken the feed is frozen, so a down-swipe moves
 * NOTHING and the horizon only flinches (a decaying shiver) to acknowledge
 * the dead pull. After a couple of dead swipes, or a few seconds, the line
 * fades in and the feed unlocks so card 10 is reachable. Calm, not a scare
 * — a peaceful bottom, and a different emptiness from card 5 ("what you
 * came for isn't here"). reducedMotion drops the shiver but keeps the dead
 * scroll and the reveal.
 */
const BottomCard = memo(function BottomCard({
  height,
  accentColor,
  active,
  reducedMotion,
  onDragLock,
}: {
  height: number;
  accentColor: string;
  active: boolean;
  reducedMotion: boolean;
  onDragLock: (locked: boolean) => void;
}) {
  const [shiver, setShiver] = useState(0);
  const [msgO, setMsgO] = useState(0);
  const revealedRef = useRef(false);
  const attemptsRef = useRef(0);
  const countedRef = useRef(false);
  const shiverRafRef = useRef(0);
  const msgRafRef = useRef(0);
  const onDragLockRef = useRef(onDragLock);
  onDragLockRef.current = onDragLock;

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    onDragLockRef.current(false); // release the feed so card 10 is reachable
    if (reducedMotion) {
      setMsgO(1);
      return;
    }
    let t0 = 0;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const p = bottomMsgOpacity(ts - t0);
      setMsgO(p);
      if (p < 1) msgRafRef.current = requestAnimationFrame(tick);
    };
    msgRafRef.current = requestAnimationFrame(tick);
  }, [reducedMotion]);
  const revealRef = useRef(reveal);
  revealRef.current = reveal;

  const shiverNow = useCallback(() => {
    if (reducedMotion || revealedRef.current) return;
    cancelAnimationFrame(shiverRafRef.current);
    let t0 = 0;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const s = ts - t0;
      setShiver(shiverOffset(s));
      if (s < SHIVER_MS) shiverRafRef.current = requestAnimationFrame(tick);
      else setShiver(0);
    };
    shiverRafRef.current = requestAnimationFrame(tick);
  }, [reducedMotion]);

  const registerAttempt = useCallback(() => {
    if (revealedRef.current) return;
    attemptsRef.current += 1;
    shiverNow();
    if (attemptsRef.current >= BOTTOM_REVEAL_ATTEMPTS) revealRef.current();
  }, [shiverNow]);

  // Freeze the feed while the bottom hasn't spoken (so the swipe hits
  // nothing); reveal after the timeout even if the user never swipes.
  useEffect(() => {
    if (!active) return;
    onDragLockRef.current(true);
    const id = setTimeout(() => revealRef.current(), BOTTOM_REVEAL_MS);
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(shiverRafRef.current);
      cancelAnimationFrame(msgRafRef.current);
      onDragLockRef.current(false);
    };
  }, [active]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !revealedRef.current,
        onMoveShouldSetPanResponder: (_e, g) =>
          !revealedRef.current && Math.abs(g.dy) > 6,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          countedRef.current = false;
        },
        onPanResponderMove: (_e, g) => {
          if (!countedRef.current && Math.abs(g.dy) > 16) {
            countedRef.current = true;
            registerAttempt();
          }
        },
      }),
    [registerAttempt]
  );

  return (
    <View style={[styles.fullPage, { height }]} {...pan.panHandlers}>
      <View style={styles.bottomWrap} pointerEvents="box-none">
        <View
          style={[
            styles.horizonLine,
            {
              backgroundColor: hexAlpha(accentColor, 0.5),
              transform: [{ translateY: shiver }],
            },
          ]}
        />
        <Text style={[styles.bottomText, { opacity: msgO }]}>
          {t('toolkit.techniques.fake_feed.cards.bottom')}
        </Text>
      </View>
    </View>
  );
});

/**
 * Card 10 — "the end". The closing line reads at FULL opacity (it is the
 * lesson, not atmosphere) after a clean fade-in, then the exercise
 * completes on its own after {@link END_HOLD_MS} — or the instant the user
 * taps, a "you can just stop now" out. onComplete hands off to the shared
 * feedback shell. reducedMotion shows the line at once and keeps the hold
 * and the tap.
 */
const EndCard = memo(function EndCard({
  height,
  active,
  reducedMotion,
  haptics,
  onComplete,
}: {
  height: number;
  active: boolean;
  reducedMotion: boolean;
  haptics?: SceneHaptics;
  onComplete: () => void;
}) {
  const elapsed = useLoopElapsed(active, reducedMotion, END_TEXT_FADE_MS);
  const textO = reducedMotion ? 1 : endTextOpacity(elapsed);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const hapticsRef = useRef(haptics);
  hapticsRef.current = haptics;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    hapticsRef.current?.celebrate();
    onCompleteRef.current();
  }, []);

  // Auto-complete once the line has been read; a tap ends it sooner.
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(finish, END_HOLD_MS);
    return () => clearTimeout(id);
  }, [active, finish]);

  return (
    <Pressable
      style={[styles.fullPage, { height }]}
      onPress={finish}
      accessibilityRole="button"
    >
      <Text style={[styles.endText, { opacity: textO }]}>
        {t('toolkit.techniques.fake_feed.cards.end')}
      </Text>
    </Pressable>
  );
});

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
 * One blank reel frame — a bordered grey rectangle, no chrome. The 2.5px
 * white border is what must read against the dark screen; the fill is a
 * faint, slightly-varied grey so a flick is perceptible.
 */
const Reel = memo(function Reel({ index }: { index: number }) {
  return (
    <View
      style={[styles.reel, { backgroundColor: REEL_TINTS[index % REEL_COUNT] }]}
    />
  );
});

/**
 * Card 2 — "Notice the pull." (design handoff). A phone within the phone:
 * a neon outline holds a clipped screen where blank reel frames flick
 * past, one at a time, continuously UP — the current reel exits the top,
 * the next rises from the bottom (a real thumb-swipe's direction) — in a
 * stepped, human rhythm (quick taps with the occasional linger), not a
 * linear crawl. Two identical 7-frame copies are stacked so the wrap from
 * the last frame back to the first is invisible: at step 7 the track sits
 * on copy-2 frame 0, pixel-identical to copy-1 frame 0, so resetting to
 * step 0 with no animation never shows a jump.
 *
 * Driven by an rAF loop that only writes state during the ~400ms flick
 * (idle, no re-renders, through each human pause) and moves ONLY the
 * track's transform — the 14 reels are memoised and never re-render.
 * reducedMotion holds the feed still on the first frame.
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
  const { width: winW } = useWindowDimensions();
  // Build at the handoff's fixed size, then scale the whole frame down so
  // it sits as a smaller phone centred on the page (fullPage centres it),
  // not a full-bleed screen. The 0.66 cap is the "smaller, in the middle"
  // look; it still fits width/height on small screens via the two ratios.
  const scale = Math.min(
    (winW - 24) / FRAME_W,
    (height - 24) / FRAME_OUTER_H,
    0.66
  );

  const [trackY, setTrackY] = useState(0);
  const yRef = useRef(0);
  const stepRef = useRef(0);
  const phaseRef = useRef<'anim' | 'rest'>('rest');
  const restUntilRef = useRef(0);
  const animRef = useRef({ from: 0, to: 0, start: 0 });

  useEffect(() => {
    if (!active || reducedMotion) return;
    let raf = 0;
    const beginFlick = (now: number) => {
      const next = stepRef.current + 1;
      if (next > REEL_COUNT) {
        // Seamless wrap: the current position (copy-2 frame 0) is
        // identical to copy-1 frame 0, so snap to step 0 with no anim.
        stepRef.current = 0;
        yRef.current = 0;
        setTrackY(0);
        phaseRef.current = 'rest';
        restUntilRef.current =
          now + flickPause(Math.random(), Math.random(), Math.random());
        return;
      }
      stepRef.current = next;
      animRef.current = {
        from: yRef.current,
        to: flickTarget(next),
        start: now,
      };
      phaseRef.current = 'anim';
    };
    const tick = (ts: number) => {
      if (phaseRef.current === 'anim') {
        const a = animRef.current;
        const p = Math.min(1, (ts - a.start) / FLICK_MS);
        const y = a.from + (a.to - a.from) * flickEasing(p);
        yRef.current = y;
        setTrackY(y);
        if (p >= 1) {
          phaseRef.current = 'rest';
          restUntilRef.current =
            ts + flickPause(Math.random(), Math.random(), Math.random());
        }
      } else if (ts >= restUntilRef.current) {
        beginFlick(ts);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reducedMotion]);

  return (
    <View style={[styles.fullPage, { height }]}>
      <View style={{ transform: [{ scale }] }}>
        <View style={styles.phoneFrame}>
          <View style={styles.phoneScreen}>
            <View style={styles.feedClip} pointerEvents="none">
              <View
                style={[
                  styles.reelTrack,
                  { transform: [{ translateY: trackY }] },
                ]}
              >
                {Array.from({ length: REEL_COUNT * 2 }, (_, i) => (
                  <Reel key={i} index={i} />
                ))}
              </View>
            </View>
            <View style={styles.fadeTop} pointerEvents="none" />
            <View style={styles.fadeBottom} pointerEvents="none" />
            <View style={styles.msgOverlay} pointerEvents="none">
              <Text style={styles.mirrorText}>
                {t('toolkit.techniques.fake_feed.cards.speed_mirror')}
              </Text>
            </View>
            <View style={styles.island} pointerEvents="none" />
          </View>
        </View>
      </View>
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
 * visible without a literal thumb: a neon comet flows UP a curved track
 * in the lower-right (the arc a right thumb traces to flick the feed),
 * led by a bright fingertip, with a soft ripple where the thumb "lands".
 * It sweeps up, the tip fades, and the loop resets invisibly — never a
 * down-swipe. Abstract, not a hand. The feed's own accent blue, because
 * this IS the doomscroll reflex. reducedMotion holds the comet mid-arc.
 *
 * Built on the house rAF+SVG pattern (not Reanimated) to stay consistent
 * with every other card and web-verifiable; the trail is a real SVG
 * gradient + dash sweep, and the "glow" is layered wide strokes rather
 * than a blur filter (cheap on device — see the perf note below).
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
  const { trailOffset, dotT, dotOpacity, pulseR, pulseOpacity } = reducedMotion
    ? THUMB_REST
    : thumbSwipe(elapsed);
  const dx = cubic(
    dotT,
    THUMB_P.x[0],
    THUMB_P.x[1],
    THUMB_P.x[2],
    THUMB_P.x[3]
  );
  const dy = cubic(
    dotT,
    THUMB_P.y[0],
    THUMB_P.y[1],
    THUMB_P.y[2],
    THUMB_P.y[3]
  );
  return (
    <View style={[styles.fullPage, { height }]}>
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox="0 0 390 620"
        preserveAspectRatio="xMidYMid meet"
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient
            id="thumbTrail"
            x1="238"
            y1="539"
            x2="335"
            y2="330"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={THUMB_ACCENT} stopOpacity={0} />
            <Stop offset="0.35" stopColor={THUMB_ACCENT} stopOpacity={0.4} />
            <Stop offset="1" stopColor={THUMB_BRIGHT} stopOpacity={0.95} />
          </LinearGradient>
          <RadialGradient
            id="thumbBloom"
            cx="236"
            cy="468"
            r="146"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={THUMB_ACCENT} stopOpacity={0.16} />
            <Stop offset="0.62" stopColor={THUMB_ACCENT} stopOpacity={0.06} />
            <Stop offset="1" stopColor={THUMB_ACCENT} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* The whole gesture nudged slightly right — a right thumb lives
            on the right side of the screen, so the arc sits there too. */}
        <G x={THUMB_NUDGE_X}>
          {/* Ambient bloom, so the arc sits in a pool of light, not on a
            flat void. Fades fully to transparent well inside the viewBox
            so it never meets a hard clip edge (that showed as a seam). */}
          <Circle cx="236" cy="468" r="146" fill="url(#thumbBloom)" />

          {/* The faint static track — the thumb's whole path, always there
            under the moving comet. */}
          <Path
            d={THUMB_PATH}
            stroke={THUMB_ACCENT}
            strokeWidth={2.5}
            strokeOpacity={0.13}
            strokeLinecap="round"
            fill="none"
          />

          {/* Fake glow: two wide, faint copies of the comet under the crisp
            one — a cheap stand-in for a blur filter. */}
          <Path
            d={THUMB_PATH}
            stroke={THUMB_ACCENT}
            strokeWidth={14}
            strokeOpacity={0.1}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={THUMB_DASH}
            strokeDashoffset={trailOffset}
          />
          <Path
            d={THUMB_PATH}
            stroke={THUMB_ACCENT}
            strokeWidth={8}
            strokeOpacity={0.18}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={THUMB_DASH}
            strokeDashoffset={trailOffset}
          />
          {/* The crisp neon comet, on the trail gradient. */}
          <Path
            d={THUMB_PATH}
            stroke="url(#thumbTrail)"
            strokeWidth={4.5}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={THUMB_DASH}
            strokeDashoffset={trailOffset}
          />

          {/* Contact ripple where the thumb touches down each loop. */}
          <Circle
            cx={THUMB_START.x}
            cy={THUMB_START.y}
            r={pulseR}
            stroke={THUMB_BRIGHT}
            strokeWidth={2.2}
            fill="none"
            opacity={pulseOpacity}
          />

          {/* The bright fingertip head: a soft halo + a solid core. */}
          <Circle
            cx={dx}
            cy={dy}
            r={17}
            fill={THUMB_ACCENT}
            opacity={dotOpacity * 0.22}
          />
          <Circle
            cx={dx}
            cy={dy}
            r={9}
            fill={THUMB_BRIGHT}
            opacity={dotOpacity}
          />
        </G>
      </Svg>

      <View style={styles.thumbTextWrap} pointerEvents="none">
        <Text style={styles.thumbText}>
          {t('toolkit.techniques.fake_feed.cards.thumb')}
        </Text>
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
  active,
  reducedMotion,
  haptics,
  onDragLock,
  onAdvance,
}: {
  height: number;
  accentColor: string;
  active: boolean;
  reducedMotion: boolean;
  haptics?: SceneHaptics;
  onDragLock: (locked: boolean) => void;
  onAdvance: () => void;
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
      <SkipHint
        active={active}
        reducedMotion={reducedMotion}
        onSkip={onAdvance}
      />
    </View>
  );
});

/**
 * The shared escape hatch for the two interactive cards (6 & 7). After
 * {@link SKIP_AFTER_MS} of the card sitting centred, a faint "Skip"
 * fades in at the bottom; tapping it advances one card. Same component,
 * same timing, same place on both cards — deliberately identical, so a
 * user who met it once recognises it. (The feed itself is always
 * free-scroll; this is just the visible way out for anyone stuck.)
 */
function SkipHint({
  active,
  reducedMotion,
  onSkip,
}: {
  active: boolean;
  reducedMotion: boolean;
  onSkip: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [fade, setFade] = useState(0);
  useEffect(() => {
    if (!active) {
      setShown(false);
      setFade(0);
      return;
    }
    const id = setTimeout(() => setShown(true), SKIP_AFTER_MS);
    return () => clearTimeout(id);
  }, [active]);
  // Soft ~500ms fade-in; reducedMotion just appears.
  useEffect(() => {
    if (!shown) return;
    if (reducedMotion) {
      setFade(1);
      return;
    }
    let raf = 0;
    let t0 = 0;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min(1, (ts - t0) / 500);
      setFade(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, reducedMotion]);
  if (!shown) return null;
  return (
    <Pressable
      onPress={onSkip}
      style={[styles.skipHint, { opacity: fade }]}
      hitSlop={14}
      accessibilityRole="button"
    >
      <Text style={styles.skipText}>
        {t('toolkit.techniques.fake_feed.skip')}
      </Text>
    </Pressable>
  );
}

// Card 7's ghost feed — the thing the hold extinguishes. Row sizing is
// relative to the page; drift speed and opacities are ESTIMATES, tuned
// by eye.
const HOLD_GHOST_ROWS = 3; // per copy; two copies stack for a seamless wrap
const HOLD_GHOST_GAP = 20;
const HOLD_GHOST_BASE_OPACITY = 0.62;
const HOLD_DRIFT_PX_S = 16; // ghost-feed upward crawl speed (ESTIMATE)
/** Defensive cap on one rAF step, so a throttled tab can't grant seconds
 *  of hold (or decay) in a single jump. */
const HOLD_DT_CLAMP_MS = 500;
/** Completion beat: shockwave + glow + the message's soft fade, one
 *  clock. Slightly longer than card 6's 750ms so the line lands gently. */
const HOLD_CELEBRATE_MS = 1100;

/**
 * Card 7's ghost feed — faint reel frames crawling up behind the ring,
 * the thing the hold puts out. It owns its OWN rAF so the continuous
 * crawl re-renders only itself, never the ring SVG; the parent's progress
 * updates reach it solely through `frac` (which sets the opacity, its one
 * tie to the hold). The crawl runs at a constant speed while the card is
 * centred and the feed is still alight, and stops once the pause completes
 * (`done`, when it's invisible anyway) or under reducedMotion. The static
 * rows are memoised so a drift tick only moves the track's transform.
 */
const HoldGhostFeed = memo(function HoldGhostFeed({
  frac,
  active,
  reducedMotion,
  done,
  ghostH,
}: {
  frac: number;
  active: boolean;
  reducedMotion: boolean;
  done: boolean;
  ghostH: number;
}) {
  const wrap = (ghostH + HOLD_GHOST_GAP) * HOLD_GHOST_ROWS;
  const [drift, setDrift] = useState(0);
  const driftRef = useRef(0);
  useEffect(() => {
    if (!active || reducedMotion || done) return;
    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      if (!last) last = ts;
      const dt = Math.min(ts - last, HOLD_DT_CLAMP_MS);
      last = ts;
      driftRef.current =
        (driftRef.current + (HOLD_DRIFT_PX_S * dt) / 1000) % wrap;
      setDrift(driftRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reducedMotion, done, wrap]);
  const rows = useMemo(
    () =>
      Array.from({ length: HOLD_GHOST_ROWS * 2 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.holdGhostRow,
            { height: ghostH, marginBottom: HOLD_GHOST_GAP },
          ]}
        />
      )),
    [ghostH]
  );
  return (
    <View style={styles.holdGhostClip} pointerEvents="none">
      <View
        style={[
          styles.holdGhostTrack,
          {
            opacity: HOLD_GHOST_BASE_OPACITY * (1 - frac),
            transform: [{ translateY: -drift }],
          },
        ]}
      >
        {rows}
      </View>
    </View>
  );
});

/**
 * Card 7 — "Hold to fade". The last interactive card: press and HOLD
 * (card 6 was a drag — different gesture, different lesson) and the whole
 * card reads off ONE progress value: the ring fills at a constant rate
 * (6s of uninterrupted hold, a fixed design decision) while the ghost
 * feed behind dims by exactly the same number — the user is putting the
 * feed out with their own finger. Let go and progress slides back at
 * 15%/s (a backslide, not a pause), so the card asks for one continuous
 * hold rather than accumulated pieces. At full: the feed is out, the
 * ring blooms, one earned haptic, and "You're in control of the pause."
 * fades in.
 *
 * Scroll: the hold zone freezes the feed while held (card 6's lesson) —
 * outside the zone, and after completion, the feed scrolls normally.
 * Escape: free scroll always, plus the same 20s {@link SkipHint} as
 * card 6. reducedMotion: the mechanic is unchanged (hold 6s → message);
 * only the drift, burst and fades are dropped.
 */
const HoldToFadeCard = memo(function HoldToFadeCard({
  height,
  accentColor,
  active,
  reducedMotion,
  haptics,
  onDragLock,
  onAdvance,
}: {
  height: number;
  accentColor: string;
  active: boolean;
  reducedMotion: boolean;
  haptics?: SceneHaptics;
  onDragLock: (locked: boolean) => void;
  onAdvance: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const progressRef = useRef(0);
  const holdingRef = useRef(false);
  const doneRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const lastRef = useRef(0);
  const hapticsRef = useRef(haptics);
  hapticsRef.current = haptics;
  const onDragLockRef = useRef(onDragLock);
  onDragLockRef.current = onDragLock;

  // Never leave the feed frozen if the card unmounts mid-hold.
  useEffect(() => () => onDragLockRef.current(false), []);

  // Ghost-feed geometry, relative to the page.
  const ghostH = Math.max(180, Math.round(height * 0.36));

  // The progress engine — integrates the one value everything reads off
  // (hold → climb, release → backslide, via the pure {@link holdStep}).
  // It is start-on-demand and SELF-TERMINATING: it runs only while there
  // is something to integrate (a hold in progress, or a release still
  // decaying) and stops the instant there isn't — so an untouched card and
  // a completed one both cost zero frames, no perpetual no-op rAF. A press
  // re-arms it via {@link pumpRef}. The crawling ghost feed animates itself
  // (see HoldGhostFeed), so the only thing that re-renders the ring here is
  // a real progress change.
  const pump = useCallback(() => {
    if (runningRef.current || !activeRef.current || doneRef.current) return;
    runningRef.current = true;
    lastRef.current = 0;
    const tick = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      const dt = Math.min(ts - lastRef.current, HOLD_DT_CLAMP_MS);
      lastRef.current = ts;
      const p = holdStep(progressRef.current, dt, holdingRef.current);
      if (p !== progressRef.current) {
        progressRef.current = p;
        setProgress(p);
      }
      if (p >= 1) {
        // Completion is terminal: the pause was held, the feed stays out.
        doneRef.current = true;
        setDone(true);
        onDragLockRef.current(false);
        hapticsRef.current?.commit();
        runningRef.current = false;
        return;
      }
      // Nothing left to integrate — go idle until the next press re-arms.
      if (!holdingRef.current && p <= 0) {
        runningRef.current = false;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);
  const pumpRef = useRef(pump);
  pumpRef.current = pump;

  // Cancel the engine when the card leaves centre; re-arm it on return
  // only if a release-decay was still in flight (so a half-filled ring
  // keeps sliding back). An idle or completed card starts nothing.
  useEffect(() => {
    if (active && !doneRef.current && progressRef.current > 0) pump();
    return () => {
      cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
    };
  }, [active, pump]);

  // Completion beat — shockwave, settled glow and the message's fade all
  // read this one clock. reducedMotion jumps straight to the end state.
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
      const p = Math.min(1, (ts - t0) / HOLD_CELEBRATE_MS);
      setBurst(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [done, reducedMotion]);

  // The hold gesture. Claimed on touch-down anywhere in the stage; the
  // feed is frozen for exactly as long as the finger is down (card 6's
  // gesture-conflict lesson), and once the ring is full the stage stops
  // claiming touches so the card scrolls normally under a resting finger.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !doneRef.current,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          holdingRef.current = true;
          onDragLockRef.current(true);
          pumpRef.current(); // wake the (self-terminating) progress engine
        },
        onPanResponderRelease: () => {
          holdingRef.current = false;
          onDragLockRef.current(false);
        },
        onPanResponderTerminate: () => {
          holdingRef.current = false;
          onDragLockRef.current(false);
        },
      }),
    []
  );

  const frac = progress;
  const eo = 1 - (1 - burst) * (1 - burst); // easeOut
  // The message's own share of the beat: starts once the pop has landed.
  const msgO = done
    ? reducedMotion
      ? 1
      : Math.max(0, (burst - 0.3) / 0.7)
    : 0;
  const litStroke = done ? '#CDE8FF' : accentColor;
  const dashOffset = RING_C * (1 - frac);
  const rot = `rotate(-90 ${RING_CX} ${RING_CX})`;

  return (
    <View style={[styles.fullPage, { height }]}>
      {/* The ghost feed — faint reel frames crawling up behind the ring,
          dimming by (1 - progress) as the hold puts it out. Isolated so
          its per-frame crawl never re-renders the ring. */}
      <HoldGhostFeed
        frac={frac}
        active={active}
        reducedMotion={reducedMotion}
        done={done}
        ghostH={ghostH}
      />

      <View style={styles.dragStage} {...pan.panHandlers}>
        {/* Settled glow once the pause is complete. */}
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
          {/* The press pad — a soft disc that brightens as the hold
              accrues. No handle: nothing here is dragged (that was
              card 6), it is pressed. */}
          <Circle
            cx={RING_CX}
            cy={RING_CX}
            r={RING_R - 30}
            fill={hexAlpha(litStroke, 0.1 + 0.24 * frac)}
          />
          {/* Neon halo under the crisp fill. */}
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
          {/* Crisp fill — the same number the feed's dimming reads. */}
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
        </Svg>

        {/* Shockwave — the one-shot "done" pop. */}
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

      {/* Title + hint give way to the completion line — one crossfade. */}
      <View style={styles.holdTextWrap}>
        <View style={{ opacity: 1 - msgO }}>
          <Text style={styles.dragText}>
            {t('toolkit.techniques.fake_feed.cards.hold')}
          </Text>
          <Text style={styles.dragHint}>
            {t('toolkit.techniques.fake_feed.hold_hint')}
          </Text>
        </View>
        <View
          style={[
            styles.holdDoneWrap,
            {
              opacity: msgO,
              transform: [{ translateY: 10 * (1 - msgO) }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.holdDoneText}>
            {t('toolkit.techniques.fake_feed.hold_done')}
          </Text>
        </View>
      </View>

      <SkipHint
        active={active}
        reducedMotion={reducedMotion}
        onSkip={onAdvance}
      />
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

  // Card 8 — winding down (draining ghost feed).
  windTrack: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
  },
  windRow: {
    borderRadius: 24,
    borderWidth: 2,
    marginBottom: 20,
  },
  windText: {
    color: dsColors.textPrimary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.displayMd,
    fontWeight: dsFont.weight.semibold,
    lineHeight: 38,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
  },

  // Card 9 — the bottom (horizon line + void).
  bottomWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizonLine: {
    width: '62%',
    height: 1.5,
    borderRadius: 1,
    ...Platform.select({
      web: { boxShadow: `0 0 18px ${hexAlpha('#42A5F5', 0.45)}` },
      default: {},
    }),
  },
  bottomText: {
    color: dsColors.textSecondary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.body,
    lineHeight: 24,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
    marginTop: dsSpacing.xxl,
    maxWidth: 300,
  },

  // Card 10 — the end (the lesson, fully legible).
  endText: {
    color: dsColors.textPrimary,
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.displayMd,
    fontWeight: dsFont.weight.semibold,
    lineHeight: 40,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
    maxWidth: 340,
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

  // Card 2 — the reel-flick feed (a phone within the phone).
  phoneFrame: {
    width: FRAME_W,
    padding: FRAME_PAD,
    borderRadius: 58,
    backgroundColor: '#06070c',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    ...Platform.select({
      web: {
        boxShadow:
          '0 0 1px #fff, 0 0 9px rgba(255,255,255,0.8), 0 0 26px rgba(255,255,255,0.5), 0 0 60px rgba(255,255,255,0.28), inset 0 0 14px rgba(255,255,255,0.14)',
      },
      default: {},
    }),
  },
  phoneScreen: {
    width: SCREEN_W,
    height: SCREEN_H,
    borderRadius: 44,
    overflow: 'hidden',
    backgroundColor: '#070a14',
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(120% 70% at 50% -8%, rgba(66,165,245,0.12), transparent 55%), linear-gradient(180deg,#0a0f1e,#070a14 55%,#05070f)',
      },
      default: {},
    }),
  },
  feedClip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  reelTrack: { position: 'absolute', top: 0, left: 0, width: SCREEN_W },
  reel: {
    height: REEL_H,
    marginHorizontal: REEL_MARGIN,
    marginBottom: REEL_MARGIN,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(180deg,#070a14 30%,transparent)',
      },
      default: { backgroundColor: hexAlpha('#070a14', 0.5) },
    }),
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    ...Platform.select({
      web: { backgroundImage: 'linear-gradient(0deg,#05070f 15%,transparent)' },
      default: { backgroundColor: hexAlpha('#05070f', 0.5) },
    }),
  },
  msgOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(52% 22% at 50% 50%, rgba(5,8,18,0.72), transparent 76%)',
      },
      default: {},
    }),
  },
  mirrorText: {
    color: '#EDF3FF',
    fontFamily: FONT_STACK,
    fontSize: 30,
    fontWeight: dsFont.weight.bold,
    letterSpacing: -0.4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 30,
  },
  island: {
    position: 'absolute',
    top: 13,
    left: (SCREEN_W - 112) / 2,
    width: 112,
    height: 30,
    borderRadius: 20,
    backgroundColor: '#05060a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    ...Platform.select({
      web: {
        boxShadow:
          '0 0 6px rgba(255,255,255,0.45), inset 0 0 5px rgba(255,255,255,0.12)',
      },
      default: {},
    }),
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
  thumbTextWrap: {
    position: 'absolute',
    top: '14%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: dsSpacing.x3l,
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

  // Card 7 — hold to fade.
  holdGhostClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  holdGhostTrack: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
  },
  holdGhostRow: {
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: '#141a26',
  },
  holdTextWrap: {
    marginTop: dsSpacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdDoneWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdDoneText: {
    color: '#DCEBFF',
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.displaySm,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
    textAlign: 'center',
    maxWidth: 320,
    ...Platform.select({
      web: { textShadow: `0 0 26px ${hexAlpha('#8FCBFF', 0.55)}` },
      default: {},
    }),
  },

  // Cards 6 & 7 — the shared Skip.
  skipHint: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    paddingHorizontal: dsSpacing.lg,
    paddingVertical: dsSpacing.sm,
  },
  skipText: {
    color: hexAlpha('#FFFFFF', 0.45),
    fontFamily: FONT_STACK,
    fontSize: dsFont.size.body,
    letterSpacing: 0.4,
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
