import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../useReducedMotion';

/**
 * Urge Surfing preview — two overlapping sine waves scrolling
 * horizontally at slightly different speeds. Ambient "ride the
 * wave" visual: two-period sine, drawn once, shifted via
 * translateX rather than redrawn every frame.
 *
 * Waves occupy the bottom third of the card so the glass panel
 * on top of them keeps the title/meta legible.
 */

const WAVE_W = 720; // 2× the card width, so translate can loop cleanly
const WAVE_H = 60;

// Pre-compute a two-period sine path once.
function buildSinePath(): string {
  const steps = 60;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * WAVE_W;
    const y = WAVE_H / 2 + Math.sin((i / steps) * Math.PI * 4) * (WAVE_H / 3);
    d += (i === 0 ? 'M ' : ' L ') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return d;
}

const WAVE_PATH = buildSinePath();

export function WaveSurfPreview() {
  const reduced = useReducedMotion();
  const x1 = useSharedValue(0);
  const x2 = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    // Wave 1: full cycle in 6s, leftward.
    x1.value = 0;
    x1.value = withRepeat(
      withTiming(-WAVE_W / 2, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );
    // Wave 2: slightly slower, opposite start offset.
    x2.value = 0;
    x2.value = withRepeat(
      withTiming(-WAVE_W / 2, { duration: 9000, easing: Easing.linear }),
      -1,
      false
    );
  }, [reduced, x1, x2]);

  const style1 = useAnimatedStyle(() => ({
    transform: [{ translateX: x1.value }],
  }));
  const style2 = useAnimatedStyle(() => ({
    transform: [{ translateX: x2.value }],
  }));

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.waveLayer, style1]}>
        <Svg width={WAVE_W} height={WAVE_H} style={styles.svg}>
          <Path
            d={WAVE_PATH}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={2}
            fill="none"
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.waveLayer, styles.waveLayerBack, style2]}>
        <Svg width={WAVE_W} height={WAVE_H} style={styles.svg}>
          <Path
            d={WAVE_PATH}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={2}
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
  },
  waveLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Position waves in the middle-bottom area, above the glass panel.
    bottom: '30%',
    height: WAVE_H,
    width: WAVE_W,
  },
  waveLayerBack: {
    bottom: '38%',
  },
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
