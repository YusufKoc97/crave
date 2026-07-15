import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { hapticTap } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import type { TechniqueScreenProps } from './types';

/**
 * Body Scan — 8 regions × 45s auto-advance. User can tap anywhere
 * on the screen to skip to the next region; auto-advance is reset
 * on skip so the new region always gets its full 45s if left
 * alone.
 *
 * Progress rendered as a segmented bar at the bottom (Faz 6 karar
 * #3 — dots would be unreadable on narrow screens; 8 filled/
 * outlined segments read at a glance). Faz 6 karar #5 — tap
 * forward = skip.
 */

const REGION_MS = 45_000;

const REGIONS = [
  'head',
  'neck',
  'chest',
  'arms',
  'belly',
  'back',
  'hips',
  'legs',
] as const;

export function BodyScanScreen({
  accentColor,
  onComplete,
}: TechniqueScreenProps) {
  const [regionIdx, setRegionIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the flow has ended so a lingering timer that
  // resolves after unmount can't call onComplete twice.
  const finishedRef = useRef(false);

  const scheduleAdvance = useCallback(
    (fromIdx: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Light haptic each time a region rolls over — a
        // low-frequency pulse the user can feel through their
        // pocket while eyes are closed.
        hapticTap();
        if (fromIdx >= REGIONS.length - 1) {
          if (!finishedRef.current) {
            finishedRef.current = true;
            onComplete();
          }
          return;
        }
        setRegionIdx((i) => i + 1);
      }, REGION_MS);
    },
    [onComplete]
  );

  // Kick off the initial timer + re-schedule whenever the region
  // changes (either from the timer itself or from a user tap).
  useEffect(() => {
    scheduleAdvance(regionIdx);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [regionIdx, scheduleAdvance]);

  const skip = useCallback(() => {
    // Tap-anywhere-forward. Ignore if we're already on the last
    // region and about to finish — the natural timer will close
    // the flow.
    if (regionIdx >= REGIONS.length - 1) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        onComplete();
      }
      return;
    }
    hapticTap();
    setRegionIdx((i) => i + 1);
  }, [regionIdx, onComplete]);

  const regionKey = REGIONS[regionIdx];

  return (
    <Pressable
      onPress={skip}
      style={styles.root}
      accessibilityRole="button"
      accessibilityLabel={t('body_scan.tap_hint')}
    >
      <Text style={styles.intro}>{t('body_scan.intro')}</Text>

      <View style={styles.centerBlock}>
        <Text style={[styles.regionName, { color: accentColor }]}>
          {t(`body_scan.regions.${regionKey}`)}
        </Text>
        <Text style={styles.instruction}>{t('body_scan.instruction')}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.tapHint}>{t('body_scan.tap_hint')}</Text>
        <View style={styles.segmentBar} pointerEvents="none">
          {REGIONS.map((_, i) => {
            const isActive = i === regionIdx;
            const isPast = i < regionIdx;
            return (
              <View
                key={i}
                style={[
                  styles.segment,
                  isActive
                    ? { backgroundColor: accentColor }
                    : isPast
                      ? {
                          backgroundColor: hexAlpha(accentColor, 0.4),
                        }
                      : styles.segmentFuture,
                ]}
              />
            );
          })}
        </View>
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
  root: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  intro: {
    color: '#94A3B8',
    fontSize: 14,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 4,
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  regionName: {
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  instruction: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    alignItems: 'stretch',
  },
  tapHint: {
    color: '#6B8BA4',
    fontSize: 11.5,
    letterSpacing: 0.6,
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  segmentBar: {
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  segmentFuture: {
    backgroundColor: '#1E2D4D',
  },
});
