import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  type LayoutChangeEvent,
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
 * Weekly craving heatmap — Modül 3 redesign.
 *
 * Orientation (post design-handoff): **days = rows (Mon-Sun),
 * hours = columns (00-23)**. Wide landscape layout so an evening
 * cluster reads as a solid vertical stripe on the right side of
 * every day row instead of a horizontal band the user has to trace
 * across seven columns.
 *
 * Ramp: `triggersHeatmapFill` (violet scale). Hot cells (≥5) get
 * a soft violet halo to match the brief's "glow" cue. Cells with
 * avg intensity ≥ 4 draw an extra white dot in the top-right.
 *
 * Grid fades in on mount (Reanimated single opacity + translate)
 * — matches the brief's cellPop feeling without 168 shared
 * values. Reduced-motion goes straight to final state.
 *
 * Tap a cell → `onCellPress(day, hour)`. Empty cells are no-ops.
 */

type Props = {
  heatmap: number[][];
  intensityMap: (number | null)[][];
  /** Kept for API compat — module now paints from its own violet. */
  accentColor?: string;
  onCellPress: (day: number, hour: number) => void;
};

const CELL_GAP = 2;
const CELL_SIZE_MIN = 8;
const CELL_SIZE_MAX = 14;
const DAY_LABEL_WIDTH = 28;
const HOUR_LABEL_HEIGHT = 20;
const INTENSITY_MARKER_RADIUS = 1.8;
const INTENSITY_THRESHOLD = 4;
const HOT_CELL_COUNT = 5;
/** Card padding (see styles.wrap below). Used to compute the
 *  amount of horizontal room the SVG grid has to fit inside. */
const CARD_PADDING = 14;

export function HeatmapGrid({
  heatmap,
  intensityMap,
  accentColor,
  onCellPress,
}: Props) {
  void accentColor;
  // Measure the card's inner width once mounted, then derive a
  // cell size that always fits — no more right-edge overflow on
  // narrow phones or when the pane is embedded in a tighter
  // parent (Comparison tab, tablet split, etc.).
  const [containerWidth, setContainerWidth] = useState(0);
  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== containerWidth) setContainerWidth(w);
  };
  const availableForGrid = Math.max(
    0,
    containerWidth - CARD_PADDING * 2 - DAY_LABEL_WIDTH
  );
  const cellSize = clamp(
    Math.floor(
      (availableForGrid - CELL_GAP * (HOURS_IN_DAY - 1)) / HOURS_IN_DAY
    ),
    CELL_SIZE_MIN,
    CELL_SIZE_MAX
  );
  const gridWidth = DAY_LABEL_WIDTH + HOURS_IN_DAY * (cellSize + CELL_GAP);
  const gridHeight = HOUR_LABEL_HEIGHT + DAYS_IN_WEEK * (cellSize + CELL_GAP);

  // Precompute cell geometry. (day, hour) → (x, y, count, avg).
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
        const x = DAY_LABEL_WIDTH + hour * (cellSize + CELL_GAP);
        const y = HOUR_LABEL_HEIGHT + day * (cellSize + CELL_GAP);
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

  // Which hour labels to render across the top. Every 6 hours plus
  // the trailing 23 so the right edge is anchored.
  const hourTicks = useMemo(() => [0, 6, 12, 18, 23] as const, []);

  return (
    <View style={styles.wrap} onLayout={handleLayout}>
      {containerWidth === 0 ? (
        // Reserve height until we know the width so the pane
        // doesn't jump when the grid measures itself.
        <View style={{ height: gridHeight + 24 }} />
      ) : (
        <CellPopWrap>
          <View style={{ width: gridWidth, height: gridHeight }}>
            <Svg width={gridWidth} height={gridHeight} pointerEvents="none">
              {/* Hour labels — top row. */}
              <G>
                {hourTicks.map((h) => {
                  const x =
                    DAY_LABEL_WIDTH + h * (cellSize + CELL_GAP) + cellSize / 2;
                  return (
                    <SvgText
                      key={h}
                      x={x}
                      y={HOUR_LABEL_HEIGHT - 6}
                      fill="#8FA5CC"
                      fontSize={9}
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {String(h).padStart(2, '0')}
                    </SvgText>
                  );
                })}
              </G>

              {/* Day labels — left column. */}
              <G>
                {DAY_KEYS.map((dayKey, d) => {
                  const y =
                    HOUR_LABEL_HEIGHT +
                    d * (cellSize + CELL_GAP) +
                    cellSize / 2 +
                    3;
                  return (
                    <SvgText
                      key={dayKey}
                      x={DAY_LABEL_WIDTH - 10}
                      y={y}
                      fill="#8FA5CC"
                      fontSize={9}
                      fontWeight="600"
                      textAnchor="end"
                    >
                      {t(`trigger_map.heatmap.days.${dayKey}`)}
                    </SvgText>
                  );
                })}
              </G>

              {/* Cells + intensity markers + hot-cell halo. */}
              <G>
                {cells.map((cell) => {
                  const fill = triggersHeatmapFill(cell.count);
                  const isHot = cell.count >= HOT_CELL_COUNT;
                  return (
                    <G key={`${cell.day}-${cell.hour}`}>
                      {isHot ? (
                        <Rect
                          x={cell.x - 1.4}
                          y={cell.y - 1.4}
                          width={cellSize + 2.8}
                          height={cellSize + 2.8}
                          rx={2.5}
                          ry={2.5}
                          fill={triggersAccentAlpha(0.22)}
                        />
                      ) : null}
                      <Rect
                        x={cell.x}
                        y={cell.y}
                        width={cellSize}
                        height={cellSize}
                        rx={2}
                        ry={2}
                        fill={fill}
                      />
                      {cell.avgIntensity !== null &&
                      cell.avgIntensity >= INTENSITY_THRESHOLD ? (
                        <Circle
                          cx={cell.x + cellSize - 2}
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

            {/* Invisible tap layer above the SVG. */}
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
                    width: cellSize,
                    height: cellSize,
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
      )}

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
    </View>
  );
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * Single-shot fade + rise-in wrapper. Cheaper than 168 per-cell
 * shared values while reading like the same "settling in" gesture
 * the design brief calls for.
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

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: triggersSurface.bg,
    borderWidth: 1,
    borderColor: triggersSurface.border,
    borderRadius: triggersSurface.radius,
    padding: 14,
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
  legendRow: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  legendLabel: {
    color: '#6B7FA1',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  legendSwatchRow: {
    flexDirection: 'row',
    gap: 3,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
});
