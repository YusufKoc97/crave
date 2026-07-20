import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { TOOLKIT_TECHNIQUES, type Technique } from '@/constants/toolkitCatalog';
import { TechniqueCard } from './TechniqueCard';
import { CARD_GAP, CARD_W } from './carouselStyle';

/**
 * Toolkit sub-tab carousel host.
 *
 * Renders the 4 techniques in a horizontally-paged ScrollView with
 * a peek on both sides so users see neighbouring cards. Snap is
 * handled by ScrollView's `snapToInterval` — no gesture handler
 * required, works native + web out of the box.
 *
 * The active index (nearest-snapped card) is tracked so the parent
 * (or dot navigation) can highlight it and — in M3 — mount the
 * animated preview only for that card (karar #4B; sleepers freeze).
 *
 * Nav side effects: `onSelect(technique)` on card / play tap.
 */

type Props = {
  accentColor: string;
  onSelect: (technique: Technique) => void;
  /** Reports the index the deck has snapped to. Used by the parent
   *  to sync the dot nav and pick which card gets the live preview. */
  onIndexChange?: (index: number) => void;
  /** Which index gets the live preview mount. Neighbours stay
   *  static per karar #4B. */
  focusedIndex: number;
  /** Optional render slot for the live preview scene. Called with
   *  the technique for the focused card only. */
  renderPreview?: (technique: Technique) => React.ReactNode;
};

export function ToolkitCarousel({
  accentColor,
  onSelect,
  onIndexChange,
  focusedIndex,
  renderPreview,
}: Props) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [screenW, setScreenW] = useState(Dimensions.get('window').width);

  // Side peek = space between screen edge and the leading edge of
  // the first card. Keeps the neighbouring cards visible.
  const side = Math.max(16, (screenW - CARD_W) / 2);
  const snapInterval = CARD_W + CARD_GAP;

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const newIndex = Math.max(
        0,
        Math.min(TOOLKIT_TECHNIQUES.length - 1, Math.round(x / snapInterval))
      );
      if (newIndex !== focusedIndex) onIndexChange?.(newIndex);
    },
    [snapInterval, focusedIndex, onIndexChange]
  );

  // Programmatic snap (used by dot taps in the parent).
  // Exposed via imperative scroll from the parent through
  // scrollRef would need forwardRef — for now the parent snaps by
  // rendering with the new focusedIndex + a small useEffect on it.
  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setScreenW(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: side,
        }}
        onMomentumScrollEnd={handleScroll}
        onScrollEndDrag={handleScroll}
        scrollEventThrottle={32}
      >
        {TOOLKIT_TECHNIQUES.map((tech, i) => (
          <View
            key={tech.id}
            style={{
              width: CARD_W,
              marginRight: i === TOOLKIT_TECHNIQUES.length - 1 ? 0 : CARD_GAP,
            }}
          >
            <TechniqueCard
              technique={tech}
              index={i}
              total={TOOLKIT_TECHNIQUES.length}
              accentColor={accentColor}
              onSelect={() => onSelect(tech)}
              preview={
                focusedIndex === i && renderPreview ? renderPreview(tech) : null
              }
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Total number of cards — exported so the parent's dot nav can
 *  render without importing the catalog directly. */
export const TOOLKIT_CARD_COUNT = TOOLKIT_TECHNIQUES.length;

const styles = StyleSheet.create({
  wrap: {
    // Height comes from the card itself (452 + panel bleed);
    // wrap just brackets the scroll region.
  },
});
