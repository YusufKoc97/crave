import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { Technique } from '@/constants/toolkitCatalog';
import {
  CarouselHeader,
  DotNavigation,
  GlassBackButton,
  GlassSegmentedControl,
  type ToolkitSegment,
} from './CarouselChrome';
import { TOOLKIT_CARD_COUNT, ToolkitCarousel } from './ToolkitCarousel';

/**
 * Toolkit sub-tab pane — replaces the old ToolkitGrid in the
 * addiction detail screen (Info tab). Info-tab context only per
 * karar #7 — the active-session picker keeps the compact list.
 *
 * Composition:
 *   - Back button + header + segment control (chrome)
 *   - Swipe carousel of 4 techniques
 *   - Dot navigation showing focused index
 *
 * State kept LOCAL:
 *   - `focusedIndex` — nearest-snapped card index (0..3)
 *   - `segment`     — visual only (karar #1B), doesn't filter cards
 *
 * `onSelect` bubbles out to the parent so the addiction detail
 * screen can mount its `TechniqueRunnerModal` (karar #3A —
 * play button = onSelect, no in-card playing state).
 */

type Props = {
  accentColor: string;
  onSelect: (technique: Technique) => void;
};

export function ToolkitPane({ accentColor, onSelect }: Props) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [segment, setSegment] = useState<ToolkitSegment>('all');

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/info');
  };

  return (
    <View style={styles.root}>
      <View style={styles.backSlot}>
        <GlassBackButton onPress={onBack} />
      </View>

      <CarouselHeader />

      <GlassSegmentedControl active={segment} onChange={setSegment} />

      <ToolkitCarousel
        accentColor={accentColor}
        onSelect={onSelect}
        focusedIndex={focusedIndex}
        onIndexChange={setFocusedIndex}
        // renderPreview slot — M3 fills this with the animated
        // per-technique scene component.
        renderPreview={undefined}
      />

      <DotNavigation
        count={TOOLKIT_CARD_COUNT}
        activeIndex={focusedIndex}
        accentColor={accentColor}
        onDotPress={setFocusedIndex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  backSlot: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
});
