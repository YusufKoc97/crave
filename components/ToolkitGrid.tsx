import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';
import {
  Activity,
  Clock,
  Hand,
  PersonStanding,
  Smartphone,
  Waves,
  Wind,
} from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import {
  techniquesForAddiction,
  techniqueDurationLabel,
  techniqueName,
  techniqueShortDescription,
  type Technique,
} from '@/constants/toolkitCatalog';
import { t } from '@/lib/i18n';

/**
 * 2-column grid of the offered toolkit techniques.
 *
 * Mounted in the active-session "Try a technique" picker
 * (ToolkitPickerModal) during a live craving. Styled to match the
 * Toolkit carousel's visual language — the same per-type line icons
 * (Wind / Waves / Hand / …) in an accent-lit glass tile, a soft
 * accent glow, and a Clock + duration meta — so the two surfaces read
 * as one family instead of the old flat emoji cards.
 *
 * `accentColor` mirrors the craving's addiction brand colour so the
 * icons, glow, borders and duration are all colour-locked to it.
 */

type Props = {
  accentColor: string;
  /** Whose toolkit this is — decides which techniques are offered. */
  addictionId?: string | null;
  onSelect: (technique: Technique) => void;
};

// Same per-type iconography as the Toolkit carousel's type pill, so the
// craving-time picker and the browsable deck share one language.
const TYPE_ICONS: Record<Technique['type'], ComponentType<LucideProps>> = {
  breathing: Wind,
  mindfulness: Waves,
  grounding: Hand,
  body_scan: PersonStanding,
  ride_the_wave: Activity,
  fake_feed: Smartphone,
};

export function ToolkitGrid({ accentColor, addictionId, onSelect }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.header}>{t('toolkit.grid_header')}</Text>
      <View style={styles.grid}>
        {techniquesForAddiction(addictionId).map((tech) => (
          <ToolkitCard
            key={tech.id}
            technique={tech}
            accentColor={accentColor}
            onPress={() => onSelect(tech)}
          />
        ))}
      </View>
    </View>
  );
}

function ToolkitCard({
  technique,
  accentColor,
  onPress,
}: {
  technique: Technique;
  accentColor: string;
  onPress: () => void;
}) {
  const Icon = TYPE_ICONS[technique.type];
  return (
    <Pressable
      style={[
        styles.card,
        {
          borderColor: hexAlpha(accentColor, 0.18),
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 22px ${hexAlpha(
            accentColor,
            0.08
          )}`,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={techniqueName(technique)}
    >
      <View
        style={[
          styles.iconTile,
          {
            backgroundColor: hexAlpha(accentColor, 0.14),
            borderColor: hexAlpha(accentColor, 0.32),
            boxShadow: `0 0 16px ${hexAlpha(accentColor, 0.35)}`,
          },
        ]}
      >
        <Icon color={accentColor} size={22} strokeWidth={2} />
      </View>
      <Text style={styles.name}>{techniqueName(technique)}</Text>
      <Text style={styles.shortDesc} numberOfLines={2}>
        {techniqueShortDescription(technique)}
      </Text>
      <View style={styles.durationRow}>
        <Clock color={accentColor} size={12} strokeWidth={2.2} />
        <Text style={[styles.duration, { color: accentColor }]}>
          {techniqueDurationLabel(technique)}
        </Text>
      </View>
    </Pressable>
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  wrap: {
    // Padding lives on the parent; the grid is edge-to-edge inside
    // whatever screen embeds it.
  },
  header: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    // 2-column layout — subtract half of the row gap so both cards
    // exactly fit the parent inner width without overflowing.
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    // Smoked glass, matching the carousel card's bottom panel.
    backgroundColor: 'rgba(13,18,30,0.6)',
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  shortDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
    minHeight: 34, // reserve 2 lines so cards align even with 1-line copy
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  duration: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
