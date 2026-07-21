import { useCallback, useEffect } from 'react';
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
 *   - Centered card at 100% scale + full opacity; adjacent cards
 *     fall to 88% + 0.5 opacity; peek from screen edges.
 *
 * Swipe physics:
 *   - Real drag via Animated.ScrollView + snapToInterval. Native
 *     scroll gives finger-tracking + spring-like snap without
 *     hand-rolling PanGestureHandler math. Interpolation runs on
 *     the UI thread so scale/opacity move smoothly under the finger.
 *
 * Focused index (which card to mount the animated preview on) is
 * PARENT-OWNED state — reported via `onIndexChange` after each
 * momentum-end. Cards remain static during drag; the preview
 * mounts only when the swipe settles, keeping animation cost
 * constant regardless of how much the user scrubs.
 *
 * Parallax hook: `onScrollShared` publishes the shared scroll
 * offset up to the parent so background orbs can drift in step
 * with the swipe (12pt travel per the brief).
 */

const GAP = 12;

type Props = {
  accentColor: string;
  onSelect: (technique: Technique) => void;
  /** Currently-focused card index (parent state). */
  focusedIndex: number;
  /** Reports the newly-snapped index after a swipe settles. */
  onIndexChange?: (index: number) => void;
  /** Optional render slot — mounts under the focused card only. */
  renderPreview?: (technique: Technique) => React.ReactNode;
  /** Called once at mount with the shared scroll offset so parents
   *  can drive background parallax off the same value. */
  onScrollShared?: (scrollX: SharedValue<number>) => void;
};

export function ToolkitCarousel({
  accentColor,
  onSelect,
  focusedIndex,
  onIndexChange,
  renderPreview,
  onScrollShared,
}: Props) {
  const screenW = Dimensions.get('window').width;
  const snapInterval = CARD_W + GAP;
  const sidePadding = Math.max(24, (screenW - CARD_W) / 2);

  const scrollX = useSharedValue(0);

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
            isFocused={i === focusedIndex}
            renderPreview={renderPreview}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

function CardSlot({
  technique,
  index,
  total,
  accentColor,
  scrollX,
  snapInterval,
  onSelect,
  isFocused,
  renderPreview,
}: {
  technique: Technique;
  index: number;
  total: number;
  accentColor: string;
  scrollX: SharedValue<number>;
  snapInterval: number;
  onSelect: () => void;
  isFocused: boolean;
  renderPreview?: (technique: Technique) => React.ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const centerScrollX = index * snapInterval;
    const offset = (scrollX.value - centerScrollX) / snapInterval;
    const abs = Math.abs(offset);
    const scale = interpolate(abs, [0, 1], [1, 0.88], Extrapolation.CLAMP);
    const opacity = interpolate(abs, [0, 1], [1, 0.5], Extrapolation.CLAMP);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  // Only the focused card gets the animated preview mount
  // (karar #4B — neighbours stay static, animation cost constant).
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

/** Retained for backwards-compat with any caller sizing dot nav
 *  or otherwise counting cards. */
export const TOOLKIT_CARD_COUNT = TOOLKIT_TECHNIQUES.length;

const styles = StyleSheet.create({
  wrap: {},
});
