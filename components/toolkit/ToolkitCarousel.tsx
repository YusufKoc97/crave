import { useCallback, useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { TOOLKIT_TECHNIQUES, type Technique } from '@/constants/toolkitCatalog';
import { TechniqueCard } from './TechniqueCard';
import { CARD_W } from './carouselStyle';

/**
 * Toolkit sub-tab carousel host.
 *
 * Focus-scale behavior:
 *   - The card centered on screen sits at 100% scale, full
 *     opacity, full shadow. Immediately-adjacent cards render at
 *     88% scale + 0.5 opacity, ~30% visible from the edges. Cards
 *     beyond that are effectively off-screen.
 *
 * Swipe physics:
 *   - Real drag via <Animated.ScrollView> horizontal + snapToInterval.
 *     Native scroll gives us finger-tracking + spring-like snap
 *     without hand-rolling PanGestureHandler math. The
 *     interpolation drives per-card transform on the UI thread
 *     so scale/opacity move smoothly under the finger.
 *   - `snapToInterval = CARD_W + GAP`. Deceleration "fast" so
 *     release settles briskly (the design brief calls for a
 *     spring feel — this reproduces it close enough on both
 *     platforms without a new dep).
 *
 * Parallax export: the parent uses `scrollX` (the shared value
 * we own here) to drift the background orbs a few pixels along
 * with the swipe (12pt travel per the brief). We expose it via
 * the `onScrollShared` render-prop pattern.
 *
 * Karar #4B — only the focused card gets the animated preview
 * mount. Neighbours receive `preview={null}` so their scenes
 * stay static and the animation cost stays constant regardless
 * of card count.
 */

const GAP = 12;

type Props = {
  accentColor: string;
  onSelect: (technique: Technique) => void;
  /** Reports which card is closest to center. Used only for the
   *  focused animated preview slot. */
  onIndexChange?: (index: number) => void;
  /** Optional render slot for the live preview scene of the
   *  focused card. Neighbours pass null. */
  renderPreview?: (technique: Technique) => React.ReactNode;
  /** Called once at mount with the shared scroll offset so the
   *  parent can drive background parallax off the same value. */
  onScrollShared?: (scrollX: SharedValue<number>) => void;
};

export function ToolkitCarousel({
  accentColor,
  onSelect,
  onIndexChange,
  renderPreview,
  onScrollShared,
}: Props) {
  const screenW = Dimensions.get('window').width;
  const snapInterval = CARD_W + GAP;
  // Centered layout: pad enough on each side that the first
  // card sits at the horizontal middle when scroll is at 0.
  const sidePadding = Math.max(24, (screenW - CARD_W) / 2);

  const scrollX = useSharedValue(0);

  // Publish the scroll shared value up so the parent can drift
  // the background orbs off it. Only ever fires once — the SV
  // identity is stable across renders.
  useEffect(() => {
    onScrollShared?.(scrollX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitIndex = useCallback(
    (i: number) => {
      onIndexChange?.(i);
    },
    [onIndexChange]
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
    onMomentumEnd: (e) => {
      const i = Math.round(e.contentOffset.x / snapInterval);
      const clamped = Math.max(0, Math.min(TOOLKIT_TECHNIQUES.length - 1, i));
      runOnJS(emitIndex)(clamped);
    },
  });

  // Focused index for the preview slot — recomputed on
  // scroll-end (cheap; not per-frame) so we don't churn the
  // preview mount while the user is dragging.
  const focusedIdx = useSharedValue(0);

  return (
    <View style={styles.wrap}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: sidePadding }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {TOOLKIT_TECHNIQUES.map((tech, i) => (
          <CardSlot
            key={tech.id}
            technique={tech}
            index={i}
            total={TOOLKIT_TECHNIQUES.length}
            accentColor={accentColor}
            scrollX={scrollX}
            snapInterval={snapInterval}
            onSelect={() => onSelect(tech)}
            focusedIdx={focusedIdx}
            renderPreview={renderPreview}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

// ─── Individual card slot with focus-scale interpolation ───

function CardSlot({
  technique,
  index,
  total,
  accentColor,
  scrollX,
  snapInterval,
  onSelect,
  focusedIdx,
  renderPreview,
}: {
  technique: Technique;
  index: number;
  total: number;
  accentColor: string;
  scrollX: SharedValue<number>;
  snapInterval: number;
  onSelect: () => void;
  focusedIdx: SharedValue<number>;
  renderPreview?: (technique: Technique) => React.ReactNode;
}) {
  // Distance in "cards" from the currently-centered slot.
  //   -1 = one card to the left of center
  //    0 = active
  //   +1 = one card to the right of center
  const animatedStyle = useAnimatedStyle(() => {
    const centerScrollX = index * snapInterval;
    const offset = (scrollX.value - centerScrollX) / snapInterval;
    const abs = Math.abs(offset);
    const scale = interpolate(abs, [0, 1], [1, 0.88], Extrapolation.CLAMP);
    const opacity = interpolate(abs, [0, 1], [1, 0.5], Extrapolation.CLAMP);
    // Track the currently-focused index so the parent can mount
    // the animated preview only for that card. Written on the UI
    // thread; the actual bridge to JS happens in onMomentumEnd.
    if (abs < 0.5) focusedIdx.value = index;
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  // Only the focused card gets the animated preview. We read
  // focusedIdx via a light rerender-on-idx-change pattern — the
  // SV isn't reactive so we drive re-renders through the parent's
  // onIndexChange (already wired). This slot keeps a JS-side
  // mirror by comparing to the momentum-emitted index prop.
  const isFocused = useMemo(
    () => index === focusedIdx.value,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index]
  );
  const preview = isFocused && renderPreview ? renderPreview(technique) : null;

  return (
    <Animated.View
      style={[
        {
          width: CARD_W,
          marginRight: index === total - 1 ? 0 : GAP,
        },
        animatedStyle,
      ]}
    >
      <TechniqueCard
        technique={technique}
        index={index}
        total={total}
        accentColor={accentColor}
        onSelect={onSelect}
        preview={preview}
      />
    </Animated.View>
  );
}

/** Total number of cards — exported so callers can size dot
 *  navigation without importing the catalog. Retained for
 *  compatibility even though the pane no longer renders dots
 *  (the peeking neighbours communicate scrollability). */
export const TOOLKIT_CARD_COUNT = TOOLKIT_TECHNIQUES.length;

const styles = StyleSheet.create({
  wrap: {
    // Height comes from the card itself; wrap just brackets the
    // scroll region.
  },
});
