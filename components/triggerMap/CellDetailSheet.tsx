import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { DAY_KEYS } from '@/constants/heatmap';
import { t } from '@/lib/i18n';

/**
 * Faz 8a — bottom-sheet detail for a tapped heatmap cell.
 *
 * The parent (`HeatmapGrid` → `TriggersPane`) passes the (day,
 * hour, count, avgIntensity) via `open()`. The sheet renders a
 * minimal card: title (day + hour), count, and — when we have an
 * average — the closest intensity label.
 *
 * Trigger breakdown per cell is intentionally omitted in Faz 8a
 * (would need a second round-trip or a much bigger payload).
 * Aggregate trigger data lives in Section 4 for that view.
 */

export type CellDetail = {
  day: number;
  hour: number;
  count: number;
  avgIntensity: number | null;
};

const INTENSITY_LABELS = [
  'mild',
  'moderate',
  'strong',
  'very_strong',
  'unbearable',
] as const;

function intensityKeyFor(avg: number | null): string | null {
  if (avg === null) return null;
  const idx = Math.min(4, Math.max(0, Math.round(avg) - 1));
  return INTENSITY_LABELS[idx];
}

export type CellDetailSheetHandle = {
  open: (detail: CellDetail) => void;
  close: () => void;
};

type Props = {
  accentColor: string;
};

export const CellDetailSheet = forwardRef<CellDetailSheetHandle, Props>(
  ({ accentColor }, ref) => {
    const sheetRef = useRef<BottomSheet>(null);
    const detailRef = useRef<CellDetail | null>(null);

    // A simple counter forces a re-render whenever open() gets
    // called with fresh detail. We don't put the detail itself
    // in state because rapid taps would race the sheet-open
    // transition otherwise — the ref is the source of truth,
    // this counter just triggers the render cycle.
    const [, bump] = useState(0);

    useImperativeHandle(ref, () => ({
      open: (detail) => {
        detailRef.current = detail;
        bump((n) => n + 1);
        sheetRef.current?.snapToIndex(0);
      },
      close: () => {
        sheetRef.current?.close();
      },
    }));

    const detail = detailRef.current;
    const dayKey = detail ? (DAY_KEYS[detail.day] ?? 'mon') : 'mon';
    const dayLabel = t(`trigger_map.heatmap.days_long.${dayKey}`);
    const hourLabel = detail ? String(detail.hour).padStart(2, '0') : '00';

    const intensityKey = detail ? intensityKeyFor(detail.avgIntensity) : null;
    const intensityLevel = intensityKey
      ? t(`trigger_map.intensity_levels.${intensityKey}`)
      : null;

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={['30%']}
        enablePanDownToClose
        backgroundStyle={styles.background}
        handleIndicatorStyle={{ backgroundColor: accentColor }}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.content}>
          <Text style={[styles.title, { color: accentColor }]}>
            {t('trigger_map.heatmap.cell_detail_title', {
              day: dayLabel,
              hour: hourLabel,
            })}
          </Text>
          <Text style={styles.count}>
            {t('trigger_map.heatmap.cell_cravings_count', {
              count: detail?.count ?? 0,
            })}
          </Text>
          {intensityLevel ? (
            <Text style={styles.intensity}>
              {t('trigger_map.heatmap.cell_avg_intensity', {
                level: intensityLevel,
              })}
            </Text>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

function renderBackdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.6}
    />
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#0A1628',
    borderTopWidth: 1,
    borderColor: '#1E2D4D',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  count: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 6,
  },
  intensity: {
    color: '#94A3B8',
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
