import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { Technique } from '@/constants/toolkitCatalog';
import {
  CarouselHeader,
  GlassBackButton,
  GlassSegmentedControl,
  type ToolkitSegment,
} from './CarouselChrome';
import { ToolkitCarousel } from './ToolkitCarousel';

/**
 * Toolkit sub-tab pane — Info-tab context (karar #7A).
 *
 * Layout (top → bottom):
 *   - Glass back button
 *   - Header ("Toolkit" + "Swipe to explore" hint)
 *   - Glass segmented control (All / Quick · under 3m, visual only)
 *   - Focus-scale carousel (peeking cards on both sides —
 *     no dot navigation; the peeks communicate scrollability
 *     on their own per the design brief)
 *
 * `onSelect` bubbles out so the addiction detail screen can
 * mount its TechniqueRunnerModal (karar #3A).
 */

type Props = {
  accentColor: string;
  onSelect: (technique: Technique) => void;
};

export function ToolkitPane({ accentColor, onSelect }: Props) {
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

      <ToolkitCarousel accentColor={accentColor} onSelect={onSelect} />
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
