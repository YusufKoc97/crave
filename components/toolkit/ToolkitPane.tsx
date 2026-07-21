import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Technique } from '@/constants/toolkitCatalog';
import { GlassSegmentedControl, type ToolkitSegment } from './CarouselChrome';
import { ToolkitCarousel } from './ToolkitCarousel';
import { BreathingOrbPreview } from './previews/BreathingOrbPreview';
import { WaveSurfPreview } from './previews/WaveSurfPreview';
import { GroundingDotsPreview } from './previews/GroundingDotsPreview';
import { BodyScanSweepPreview } from './previews/BodyScanSweepPreview';
import { dsSectionHeaderStyle, dsSpacing } from '@/constants/designSystem';
import { t } from '@/lib/i18n';

/**
 * Toolkit sub-tab pane — Info-tab context (karar #7A).
 *
 * Sits inside the addiction detail screen, which already provides:
 *   - Nicotine header + back button (top)
 *   - Glass-pill sub-tab bar (Journey/Toolkit/Triggers/Comparison)
 *   - AmbientGlow atmospheric background layers
 *
 * So this pane does NOT re-render its own back button or "Toolkit"
 * title — those would be redundant. Instead it opens with a
 * Journey-parallel section kicker ("TRY DURING A CRAVING"), the
 * segment control, and the carousel — same information hierarchy
 * the Journey tab uses ("THE PATH" → visualization).
 *
 * Holds `focusedIndex` state so the carousel + preview slot stay
 * in sync. Only the focused card mounts its animated preview
 * (karar #4B).
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

  return (
    <View style={styles.root}>
      {/* Section kicker — matches Journey's "THE PATH" pattern
          so the two tabs read as one visual family. */}
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>{t('toolkit.section_kicker')}</Text>
        <View style={styles.hairline} />
      </View>

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
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: dsSpacing.xl,
    marginBottom: dsSpacing.md,
  },
  kicker: {
    ...dsSectionHeaderStyle,
    marginTop: 0,
    marginBottom: 0,
  },
  hairline: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
