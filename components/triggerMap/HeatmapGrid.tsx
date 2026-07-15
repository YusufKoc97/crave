import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import {
  DAY_KEYS,
  DAYS_IN_WEEK,
  HOURS_IN_DAY,
  heatmapColor,
} from '@/constants/heatmap';
import { t } from '@/lib/i18n';

/**
 * Faz 8a — 7-day × 24-hour heatmap.
 *
 * Grid orientation (karar #2): days as top-row columns (Mon…Sun),
 * hours as left-column labels (0–23 stacked vertically). Reads
 * like iOS Screen Time — natural on mobile.
 *
 * Cell colour bucket → heatmapColor(count).
 * Cells whose average intensity is ≥ 4 (strong+) get an extra
 * top-right dot marker in the accent colour so the "how hard" cue
 * layers on top of the "how often" cue.
 *
 * Tap a cell → onCellPress(day, hour). The parent renders the
 * bottom-sheet detail (M7). Tapping an empty cell is a no-op.
 */

type Props = {
  heatmap: number[][];
  intensityMap: (number | null)[][];
  accentColor: string;
  onCellPress: (day: number, hour: number) => void;
};

const CELL_SIZE = 12;
const CELL_GAP = 3;
const HOUR_LABEL_WIDTH = 28;
const DAY_LABEL_HEIGHT = 22;
const INTENSITY_MARKER_RADIUS = 2;
const INTENSITY_THRESHOLD = 4; // avg intensity ≥ 4 draws the dot

export function HeatmapGrid({
  heatmap,
  intensityMap,
  accentColor,
  onCellPress,
}: Props) {
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
      <Text style={styles.subtitle}>{t('trigger_map.heatmap.subtitle')}</Text>

      {/* Two overlaid layers: an SVG that draws every cell + label,
          and a same-sized invisible Pressable grid for touches.
          Splitting the two means we can hit-test cells with the
          RN gesture system (better than SVG onPress in
          react-native-svg on web). */}
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
                  fill="#6B8BA4"
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
                    fill="#6B8BA4"
                    fontSize={8.5}
                    textAnchor="end"
                    fontWeight="500"
                  >
                    {String(h).padStart(2, '0')}
                  </SvgText>
                );
              })}
          </G>

          {/* Cells + intensity markers. */}
          <G>
            {cells.map((cell) => (
              <G key={`${cell.day}-${cell.hour}`}>
                <Rect
                  x={cell.x}
                  y={cell.y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2}
                  ry={2}
                  fill={heatmapColor(cell.count)}
                />
                {cell.avgIntensity !== null &&
                cell.avgIntensity >= INTENSITY_THRESHOLD ? (
                  <Circle
                    cx={cell.x + CELL_SIZE - 2}
                    cy={cell.y + 2}
                    r={INTENSITY_MARKER_RADIUS}
                    fill={accentColor}
                  />
                ) : null}
              </G>
            ))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  subtitle: {
    color: '#6B8BA4',
    fontSize: 11,
    letterSpacing: 0.4,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
});
