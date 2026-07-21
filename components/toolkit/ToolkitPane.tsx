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
import { BreathingOrbPreview } from './previews/BreathingOrbPreview';
import { WaveSurfPreview } from './previews/WaveSurfPreview';
import { GroundingDotsPreview } from './previews/GroundingDotsPreview';
import { BodyScanSweepPreview } from './previews/BodyScanSweepPreview';

/**
 * Toolkit sub-tab pane — Info-tab context (karar #7A).
 *
 * Holds `focusedIndex` state so the carousel + preview slot
 * stay in sync. `renderPreview` picks the right animated scene
 * per technique id — the carousel only mounts it on the focused
 * card (karar #4B) so animation cost stays constant regardless
 * of card count.
 */

type Props = {
  accentColor: string;
  onSelect: (technique: Technique) => void;
};

function pickPreview(techniqueId: string): React.ReactNode {
  switch (techniqueId) {
    case 'breathing_478':
      return <BreathingOrbPreview />;
    case 'urge_surfing':
      return <WaveSurfPreview />;
    case 'grounding_54321':
      return <GroundingDotsPreview />;
    case 'body_scan':
      return <BodyScanSweepPreview />;
    default:
      return null;
  }
}

export function ToolkitPane({ accentColor, onSelect }: Props) {
  const [segment, setSegment] = useState<ToolkitSegment>('all');
  const [focusedIndex, setFocusedIndex] = useState(0);

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
        renderPreview={(tech) => pickPreview(tech.id)}
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
