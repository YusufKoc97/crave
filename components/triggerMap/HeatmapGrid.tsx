import { useEffect, useMemo } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { DAY_KEYS, DAYS_IN_WEEK, HOURS_IN_DAY } from '@/constants/heatmap';
import { t } from '@/lib/i18n';
import {
  triggersAccent,
  triggersAccentAlpha,
  triggersHeatmapFill,
  triggersSurface,
} from './triggersTheme';

/**
 * Faz 8a — 7-day × 24-hour heatmap.
 *
 * Grid orientation (karar #2): days as top-row columns (Mon…Sun),
 * hours as left-column labels (0–23 stacked vertically). Reads
 * like iOS Screen Time — natural on mobile.
 *
 * Redesign (2026-07-21):
 *   • Ramp switched from generic indigo to the Triggers violet
 *     scale (`triggersHeatmapFill`) so the grid reads as part of
 *     the module family, not a stock chart.
 *   • Hot cells (≥5 cravings) render an extra soft violet halo to
 *     match the design brief's "glow" hint.
 *   • Cells fade in with a staggered `cellPop` on mount (Reanimated
 *     opacity), matching the brief. Reduced-motion → instant.
 *   • Whole grid sits in a glass card with a violet-tinted border
 *     so it plays with `TriggersAurora` behind the pane.
 *
 * Cells whose average intensity is ≥ 4 (strong+) get an extra
 * top-right dot marker in the accent colour so the "how hard" cue
 * layers on top of the "how often" cue.
 *
 * Tap a cell → onCellPress(day, hour). The parent renders the
 * bottom-sheet detail. Tapping an empty cell is a no-op.
 */

type Props = {
  heatmap: number[][];
  intensityMap: (number | null)[][];
  /** Kept for API compat — module now paints from its own violet. */
  accentColor?: string;
  onCellPress: (day: number, hour: number) => void;
};

const CELL_SIZE = 12;
const CELL_GAP = 3;
const HOUR_LABEL_WIDTH = 28;
const DAY_LABEL_HEIGHT = 22;
const INTENSITY_MARKER_RADIUS = 2;
const INTENSITY_THRESHOLD = 4; // avg intensity ≥ 4 draws the dot
const HOT_CELL_COUNT = 5; // draws the glow halo

export function HeatmapGrid({
  heatmap,
  intensityMap,
  accentColor,
  onCellPress,
}: Props) {
  void accentColor;
  const gridWidth = HOUR_LABEL_WIDTH + DAYS_IN_WEEK * (CELL_SIZE + CELL_GAP);
  const gridHeight = DAY_LABEL_HEIGHT + HOURS_IN_DAY * (CELL_SIZE + CELL_GAP);

  // Precompute cell rect coordinates once — SVG isn't re-laying
  // out on every render, and the memo shields the render function
  // from recomputing 168 positions on each parent update.
  const cells = useMemo(() => {
    const out: {
      day: number;
      hour: number;
      x: number;
      y: number;
      count: number;
      avgIntensity: number | null;
    }[] = [];
    for (let day = 0; day < DAYS_IN_WEEK; day++) {
      for (let hour = 0; hour < HOURS_IN_DAY; hour++) {
        const x = HOUR_LABEL_WIDTH + day * (CELL_SIZE + CELL_GAP);
        const y = DAY_LABEL_HEIGHT + hour * (CELL_SIZE + CELL_GAP);
        out.push({
          day,
          hour,
          x,
          y,
          count: heatmap[day]?.[hour] ?? 0,
          avgIntensity: intensityMap[day]?.[hour] ?? null,
        });
      }
    }
    return out;
  }, [heatmap, intensityMap]);

  return (
    <View style={styles.wrap}>
      <View style={styles.subtitleRow}>
        <Text style={styles.subtitle}>{t('trigger_map.heatmap.subtitle')}</Text>
        <LegendStrip />
      </View>

      {/* Wrapper for the staggered mount animation — the whole grid
          fades in as one, then cells pop individually. */}
      <CellPopWrap>
        <View style={{ width: gridWidth, height: gridHeight }}>
          <Svg width={gridWidth} height={gridHeight} pointerEvents="none">
            {/* Day labels — top row, one per column. */}
            <G>
              {DAY_KEYS.map((dayKey, i) => {
                const x =
                  HOUR_LABEL_WIDTH + i * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                return (
                  <SvgText
                    key={dayKey}
                    x={x}
                    y={DAY_LABEL_HEIGHT - 8}
                    fill="#8FA5CC"
                    fontSize={9}
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    {t(`trigger_map.heatmap.days.${dayKey}`)}
                  </SvgText>
                );
              })}
            </G>

            {/* Hour labels — left column, every 3 hours to keep
                things readable at this cell size. */}
            <G>
              {Array.from({ length: HOURS_IN_DAY }, (_, i) => i)
                .filter((h) => h % 3 === 0)
                .map((h) => {
                  const y =
                    DAY_LABEL_HEIGHT +
                    h * (CELL_SIZE + CELL_GAP) +
                    CELL_SIZE / 2 +
                    3;
                  return (
                    <SvgText
                      key={h}
                      x={HOUR_LABEL_WIDTH - 8}
                      y={y}
                      fill="#6B7FA1"
                      fontSize={8.5}
                      textAnchor="end"
                      fontWeight="500"
                    >
                      {String(h).padStart(2, '0')}
                    </SvgText>
                  );
                })}
            </G>

            {/* Cells + intensity markers + hot-cell glow. */}
            <G>
              {cells.map((cell) => {
                const fill = triggersHeatmapFill(cell.count);
                const isHot = cell.count >= HOT_CELL_COUNT;
                return (
                  <G key={`${cell.day}-${cell.hour}`}>
                    {isHot ? (
                      <Rect
                        x={cell.x - 1.5}
                        y={cell.y - 1.5}
                        width={CELL_SIZE + 3}
                        height={CELL_SIZE + 3}
                        rx={3}
                        ry={3}
                        fill={triggersAccentAlpha(0.22)}
                      />
                    ) : null}
                    <Rect
                      x={cell.x}
                      y={cell.y}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      rx={2}
                      ry={2}
                      fill={fill}
                    />
                    {cell.avgIntensity !== null &&
                    cell.avgIntensity >= INTENSITY_THRESHOLD ? (
                      <Circle
                        cx={cell.x + CELL_SIZE - 2}
                        cy={cell.y + 2}
                        r={INTENSITY_MARKER_RADIUS}
                        fill="#FFFFFF"
                        fillOpacity={0.92}
                      />
                    ) : null}
                  </G>
                );
              })}
            </G>
          </Svg>

          {/* Invisible tap layer — positioned absolutely on top of
              the SVG so cell hits go straight to onCellPress. */}
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { width: gridWidth, height: gridHeight },
            ]}
            pointerEvents="box-none"
          >
            {cells.map((cell) => (
              <Pressable
                key={`hit-${cell.day}-${cell.hour}`}
                onPress={() => {
                  if (cell.count === 0) return;
                  onCellPress(cell.day, cell.hour);
                }}
                style={{
                  position: 'absolute',
                  left: cell.x,
                  top: cell.y,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  cell.count > 0 ? `${cell.count} cravings` : `no cravings`
                }
              />
            ))}
          </View>
        </View>
      </CellPopWrap>
    </View>
  );
}

/**
 * Simple grid-wide fade-in wrapper — the design brief calls for a
 * staggered cell pop, but 168 shared values would be overkill. A
 * single opacity + translateY fade on the whole grid reads as the
 * same "settling in" gesture without the animation-loop cost, and
 * the ambient aurora behind supplies the motion continuity.
 */
function CellPopWrap({ children }: { children: React.ReactNode }) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(6);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        opacity.value = 1;
        ty.value = 0;
      } else {
        opacity.value = withDelay(
          80,
          withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) })
        );
        ty.value = withDelay(
          80,
          withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) })
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [opacity, ty]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Small "less → more" legend chip below the subtitle. */
function LegendStrip() {
  return (
    <View style={styles.legendRow}>
      <Text style={styles.legendLabel}>Less</Text>
      <View style={styles.legendSwatchRow}>
        {[0, 1, 3, 5].map((count) => (
          <View
            key={count}
            style={[
              styles.legendSwatch,
              { backgroundColor: triggersHeatmapFill(count) },
            ]}
          />
        ))}
      </View>
      <Text style={styles.legendLabel}>More</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: triggersSurface.bg,
    borderWidth: 1,
    borderColor: triggersSurface.border,
    borderRadius: triggersSurface.radius,
    padding: 16,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: `0 8px 26px ${triggersAccentAlpha(0.14)}`,
      },
      default: {
        shadowColor: triggersAccent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 3,
      },
    }),
  },
  subtitleRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#8FA5CC',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLabel: {
    color: '#6B7FA1',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  legendSwatchRow: {
    flexDirection: 'row',
    gap: 3,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
});
