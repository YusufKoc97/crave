import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  dsColors,
  dsFont,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';
import type { Addiction } from '@/constants/addictions';
import { sparklinePath } from './profileTheme';

/**
 * Tracked-addiction row — gives each addiction a presence, per the
 * Profile redesign brief:
 *
 *   • A thin vertical accent bar on the left edge, coloured per the
 *     addiction's own accent (`addiction.color`).
 *   • A faint mini sparkline of that addiction's recent resist trend
 *     behind the row's right side (10% opacity, non-interactive).
 *   • The rank label carries a subtle glow matching its accent.
 *
 * Row height, typography and tap target are unchanged from the plain
 * list row — only the per-addiction visual treatment is added.
 */
export function TrackingRow({
  addiction,
  rankName,
  score,
  weekly,
  showDivider,
  onPress,
}: {
  addiction: Addiction;
  rankName: string;
  score: number;
  weekly: readonly number[];
  showDivider: boolean;
  onPress: () => void;
}) {
  const accent = addiction.color;
  const d = sparklinePath(weekly, 100, 32, 2);

  return (
    <>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${addiction.name} — ${rankName}`}
      >
        {/* Left accent bar — the addiction's own colour. */}
        <View style={[styles.accentBar, { backgroundColor: accent }]} />

        {/* Recent-trend sparkline behind the right side. */}
        <View style={styles.sparkLayer} pointerEvents="none">
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 100 32"
            preserveAspectRatio="none"
          >
            <Path
              d={d}
              fill="none"
              stroke={accent}
              strokeWidth={2}
              strokeOpacity={0.1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        <Text style={styles.emoji}>{addiction.emoji}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {addiction.name}
        </Text>
        <Text style={styles.meta}>
          <Text
            style={[
              styles.rankLabel,
              {
                color: accent,
                textShadowColor: hexAlpha(accent, 0.55),
              },
            ]}
          >
            {rankName}
          </Text>
          <Text style={styles.metaSep}> · </Text>
          <Text>{score}</Text>
        </Text>
      </Pressable>
      {showDivider && <View style={styles.divider} />}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dsSpacing.md,
    height: 56,
    paddingHorizontal: dsSpacing.lg,
    overflow: 'hidden',
  },
  rowPressed: {
    backgroundColor: dsColors.cardSurfaceElevated,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  sparkLayer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '42%',
  },
  emoji: {
    fontSize: 22,
    width: 26,
    textAlign: 'center',
  },
  name: {
    flex: 1,
    color: dsColors.textPrimary,
    fontSize: dsFont.size.body,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
  },
  meta: {
    color: dsColors.textSecondary,
    fontSize: dsFont.size.label,
    fontWeight: dsFont.weight.semibold,
    fontVariant: ['tabular-nums'],
  },
  rankLabel: {
    fontWeight: dsFont.weight.semibold,
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  metaSep: {
    color: dsColors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: dsColors.borderSubtle,
    marginHorizontal: dsSpacing.lg,
  },
});
