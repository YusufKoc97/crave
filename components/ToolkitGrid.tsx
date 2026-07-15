import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  TOOLKIT_TECHNIQUES,
  techniqueDurationLabel,
  techniqueName,
  techniqueShortDescription,
  type Technique,
} from '@/constants/toolkitCatalog';
import { t } from '@/lib/i18n';

/**
 * Faz 6 — 2-column grid of the four MVP toolkit techniques.
 *
 * Used in two places: the Info Toolkit sub-tab (inline) and the
 * active-session "Try a technique" picker (mounted inside a
 * `<Modal>`). The card layout is the same in both contexts so the
 * user recognises the surface immediately.
 *
 * `accentColor` mirrors the enclosing addiction's brand colour so
 * cards feel color-locked when the grid is embedded on an
 * addiction landing page. The active-session picker passes the
 * craving's addiction colour for the same reason.
 */

type Props = {
  accentColor: string;
  onSelect: (technique: Technique) => void;
};

export function ToolkitGrid({ accentColor, onSelect }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.header}>{t('toolkit.grid_header')}</Text>
      <View style={styles.grid}>
        {TOOLKIT_TECHNIQUES.map((tech) => (
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
  return (
    <Pressable
      style={[styles.card, { borderColor: '#1E2D4D' }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={techniqueName(technique)}
    >
      <View
        style={[
          styles.emojiTile,
          {
            backgroundColor: hexAlpha(accentColor, 0.12),
            borderColor: hexAlpha(accentColor, 0.35),
          },
        ]}
      >
        <Text style={styles.emoji}>{technique.emoji}</Text>
      </View>
      <Text style={styles.name}>{techniqueName(technique)}</Text>
      <Text style={styles.shortDesc} numberOfLines={2}>
        {techniqueShortDescription(technique)}
      </Text>
      <Text style={[styles.duration, { color: accentColor }]}>
        {techniqueDurationLabel(technique)}
      </Text>
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
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#0A1628',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  emojiTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emoji: {
    fontSize: 22,
    lineHeight: 24,
  },
  name: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
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
  duration: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
