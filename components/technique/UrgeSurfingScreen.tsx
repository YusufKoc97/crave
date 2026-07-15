import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { t } from '@/lib/i18n';
import type { TechniqueScreenProps } from './types';

/**
 * Urge Surfing — 5-minute mindful observation.
 *
 * Layout:
 *   [Intro line]           top
 *   [Wave SVG]              middle — amplitude scaleY follows the
 *                                    narrative (low → high → low)
 *   [Narrative label]       under the wave
 *   [Static instruction]    bottom — "Don't fight it. Just observe."
 *
 * Timeline (values in seconds; total 300s / 5min):
 *
 *   0–30    intro       amplitude 0.25
 *   30–120  rising      amplitude 0.55
 *   120–180 peaking     amplitude 1.00
 *   180–270 falling     amplitude 0.55
 *   270–300 gone        amplitude 0.20
 *
 * Wave path is a two-period sine drawn once as a static SVG; the
 * amplitude is animated via Reanimated `scaleY` on the enclosing
 * <Animated.View>. This gives us cross-platform (native + web)
 * smooth rescaling without redrawing the path every frame.
 *
 * The narrative label is React state driven by a JS-thread setInterval
 * that checks elapsed seconds against the phase table above. Fires
 * onComplete() at 300s.
 */

const TOTAL_MS = 300_000;

type Phase = 'intro' | 'rising' | 'peaking' | 'falling' | 'gone';

const PHASE_TABLE: { untilSec: number; phase: Phase; amplitude: number }[] = [
  { untilSec: 30, phase: 'intro', amplitude: 0.25 },
  { untilSec: 120, phase: 'rising', amplitude: 0.55 },
  { untilSec: 180, phase: 'peaking', amplitude: 1.0 },
  { untilSec: 270, phase: 'falling', amplitude: 0.55 },
  { untilSec: 300, phase: 'gone', amplitude: 0.2 },
];

// SVG viewport for the wave. Width chosen wide enough that two full
// periods fit and clip gracefully on narrow phones without the wave
// looking cropped.
const WAVE_W = 340;
const WAVE_H = 120;
const WAVE_MID = WAVE_H / 2;

// Pre-compute the sine path once — two periods across WAVE_W.
const WAVE_PATH = (() => {
  const steps = 60;
  const twoPi = Math.PI * 2;
  const periods = 2;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * WAVE_W;
    const theta = (i / steps) * twoPi * periods;
    const y = WAVE_MID - Math.sin(theta) * (WAVE_H / 2 - 4);
    d += (i === 0 ? 'M ' : ' L ') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d;
})();

export function UrgeSurfingScreen({
  accentColor,
  onComplete,
}: TechniqueScreenProps) {
  // Elapsed seconds — advances via JS interval. Refs would be
  // cheaper but we need the value in render to compute the phase.
  const [elapsed, setElapsed] = useState(0);
  const amplitude = useSharedValue(PHASE_TABLE[0].amplitude);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      const e = Math.min(TOTAL_MS, Date.now() - started);
      setElapsed(Math.floor(e / 1000));
      if (e >= TOTAL_MS) {
        clearInterval(id);
        onComplete();
      }
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which phase are we in right now?
  const currentPhase: Phase = useMemo(() => {
    for (const row of PHASE_TABLE) {
      if (elapsed < row.untilSec) return row.phase;
    }
    return 'gone';
  }, [elapsed]);

  // Retune the amplitude on phase change — long easing so the
  // wave breathes over ~4s rather than snapping.
  useEffect(() => {
    const row = PHASE_TABLE.find((r) => r.phase === currentPhase);
    if (!row) return;
    amplitude.value = withTiming(row.amplitude, {
      duration: 4000,
      easing: Easing.inOut(Easing.quad),
    });
  }, [currentPhase, amplitude]);

  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: amplitude.value }],
  }));

  const phaseLabel = useMemo(() => {
    switch (currentPhase) {
      case 'intro':
        return null; // The intro text lives above the wave; no
      // narrative label yet.
      case 'rising':
        return t('urge_surfing.rising');
      case 'peaking':
        return t('urge_surfing.peaking');
      case 'falling':
        return t('urge_surfing.falling');
      case 'gone':
        return t('urge_surfing.gone');
    }
  }, [currentPhase]);

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>{t('urge_surfing.intro')}</Text>

      <View style={styles.waveWrap}>
        <Animated.View style={[styles.waveScaler, waveStyle]}>
          <Svg width={WAVE_W} height={WAVE_H}>
            <Path
              d={WAVE_PATH}
              stroke={accentColor}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      </View>

      <View style={styles.phaseWrap}>
        {phaseLabel && (
          <Text style={[styles.phaseLabel, { color: accentColor }]}>
            {phaseLabel}
          </Text>
        )}
      </View>

      <Text style={styles.instruction}>{t('urge_surfing.instruction')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  intro: {
    color: '#F1F5F9',
    fontSize: 20,
    fontWeight: '400',
    letterSpacing: 0.4,
    textAlign: 'center',
    lineHeight: 28,
    marginTop: 8,
  },
  waveWrap: {
    width: WAVE_W,
    height: WAVE_H,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  waveScaler: {
    width: WAVE_W,
    height: WAVE_H,
  },
  phaseWrap: {
    // Fixed height so the wave doesn't jump when the label appears
    // / disappears between phases.
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  instruction: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
});
