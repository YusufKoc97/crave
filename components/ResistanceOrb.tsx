import { useEffect } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { NeonRing } from '@/components/NeonRing';

/**
 * The resistance orb — the single source of truth for the "RESIST" core
 * that lives at the center of the home screen and reappears in
 * onboarding. Extracted from `app/(tabs)/index.tsx` so the two surfaces
 * render byte-identical pixels and can never drift apart.
 *
 * Division of labour: the OWNER of the orb (HomeScreen) keeps its own
 * shared values and the animation triggers that drive the fan-out
 * "selecting" state, and passes those shared values in here. This
 * component owns only the VIEW — the atmosphere, the dark core, the
 * RESIST text, the inner glow and the two neon rings — plus the
 * animated styles that read the shared values. A consumer that passes
 * no shared values (onboarding) gets the RESTING orb: full-size core,
 * full-opacity text, rings and inner glow invisible — exactly what the
 * home screen shows before the user taps.
 */

const ORB_SIZE = 168;
const ORB_SELECTING_SCALE = 0.5;
const SMALL_ORB = ORB_SIZE * ORB_SELECTING_SCALE; // 84
const RING_INNER = SMALL_ORB + 8; // 92 — hugs the small orb
const RING_OUTER = SMALL_ORB + 24; // 108 — slightly further out
const INNER_GLOW_SIZE = SMALL_ORB - 12; // 72 — inside the orb behind text

/** The orb's layout box, exported so parents can center it precisely. */
export const RESISTANCE_ORB_SIZE = ORB_SIZE;

// Web-only `animation` shorthand — RN's StyleSheet has no equivalent, but
// react-native-web passes unrecognised style props straight through to the
// underlying DOM node. Cast to `any` so TS doesn't choke on the non-RN key.
// On native these objects are still passed but ignored.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BREATH_STYLE_INNER: any = Platform.select({
  web: { animation: 'crave-breath-inner 4400ms ease-in-out infinite' },
  default: {},
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BREATH_STYLE_MID: any = Platform.select({
  web: { animation: 'crave-breath-mid 4400ms ease-in-out infinite' },
  default: {},
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BREATH_STYLE_OUTER: any = Platform.select({
  web: { animation: 'crave-breath-outer 4400ms ease-in-out infinite' },
  default: {},
});
// Main RESIST orb breath — same 4.4s cycle as the discs so the whole
// composition shares one cadence, but a much gentler amplitude
// (1.000 ↔ 1.008) since the orb is the focal element; anything larger
// would distract from RESIST.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BREATH_STYLE_ORB: any = Platform.select({
  web: { animation: 'crave-breath-orb 4400ms ease-in-out infinite' },
  default: {},
});

type Props = {
  /** Makes the core tappable (home). Omit for a static orb (onboarding). */
  onPress?: () => void;
  /** Core scale — the orb shrinks to 0.5 during fan-out. Rest → 1. */
  orbScale?: SharedValue<number>;
  /** RESIST text opacity. Rest → 1. */
  orbTextOpacity?: SharedValue<number>;
  /** Neon rings opacity. Rest → 0 (invisible until the orb is tapped). */
  ringsOpacity?: SharedValue<number>;
  /** Inner-glow opacity. Rest → 0. */
  innerGlowOpacity?: SharedValue<number>;
  /** Inner-glow pulse driver (0..1). Rest → 0. */
  innerGlowPulse?: SharedValue<number>;
  /** Render the ambient atmosphere discs + halo behind the orb. */
  atmosphere?: boolean;
  /** Wrapper positioning — the parent centers this box where it wants. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Injects the shared breath @keyframes once on web. On native this is a
 * no-op and every layer renders static (Reanimated/Animated both failed
 * to drive a mount-time loop in the RN-Web bundle for this layout, so
 * CSS is the pragmatic answer for the platform that matters today).
 */
function useBreathKeyframes() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'crave-ambient-breath-keyframes';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = `
      @keyframes crave-breath-inner {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.030); }
      }
      @keyframes crave-breath-mid {
        0%, 100% { transform: scale(1.012); }
        50%      { transform: scale(1.000); }
      }
      @keyframes crave-breath-outer {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.010); }
      }
      @keyframes crave-breath-orb {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.008); }
      }
    `;
    document.head.appendChild(el);
    // Leave the stylesheet behind on unmount — adding & removing <style>
    // on every nav causes a frame flash. The keyframes are cheap.
  }, []);
}

export function ResistanceOrb({
  onPress,
  orbScale,
  orbTextOpacity,
  ringsOpacity,
  innerGlowOpacity,
  innerGlowPulse,
  atmosphere = true,
  style,
}: Props) {
  useBreathKeyframes();

  // Internal resting defaults so consumers that don't animate (onboarding)
  // still get valid shared values. Declared unconditionally to respect the
  // Rules of Hooks; the passed-in value wins when present.
  const dScale = useSharedValue(1);
  const dText = useSharedValue(1);
  const dRings = useSharedValue(0);
  const dGlow = useSharedValue(0);
  const dPulse = useSharedValue(0);

  const scaleSV = orbScale ?? dScale;
  const textSV = orbTextOpacity ?? dText;
  const ringsSV = ringsOpacity ?? dRings;
  const glowSV = innerGlowOpacity ?? dGlow;
  const pulseSV = innerGlowPulse ?? dPulse;

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleSV.value }],
  }));
  const orbTextStyle = useAnimatedStyle(() => ({
    opacity: textSV.value,
  }));
  const ringsStyle = useAnimatedStyle(() => ({
    opacity: ringsSV.value,
  }));
  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: glowSV.value * (0.55 + pulseSV.value * 0.45),
    transform: [{ scale: 0.92 + pulseSV.value * 0.12 }],
  }));

  return (
    <View style={[styles.box, style]} pointerEvents="box-none">
      {atmosphere && (
        <>
          {/* Foggy radial atmosphere — a 1×1 anchor painted by a stack of
              boxShadow rings (web); native renders the first ring only. */}
          <View pointerEvents="none" style={styles.ambientHalo} />

          {/* Three concentric ambient discs. Web gets the CSS breath
              (innermost most pronounced, outermost barely moves); native
              renders them static. */}
          <View
            pointerEvents="none"
            style={[styles.ambient, styles.ambientOuter, BREATH_STYLE_OUTER]}
          />
          <View
            pointerEvents="none"
            style={[styles.ambient, styles.ambientMid, BREATH_STYLE_MID]}
          />
          <View
            pointerEvents="none"
            style={[styles.ambient, styles.ambientInner, BREATH_STYLE_INNER]}
          />
        </>
      )}

      <View style={styles.centerStack}>
        {/* Inner pulsing glow inside the orb */}
        <Animated.View
          style={[styles.innerGlow, innerGlowStyle]}
          pointerEvents="none"
        />

        <Animated.View style={[styles.orbWrap, orbStyle]}>
          <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={[styles.orb, BREATH_STYLE_ORB]}
          >
            <Animated.Text style={[styles.orbText, orbTextStyle]}>
              RESIST
            </Animated.Text>
          </Pressable>
        </Animated.View>

        {/* Outer neon ring — bigger, slower, CW, hugs the small orb */}
        <Animated.View
          style={[
            styles.ringSlot,
            {
              width: RING_OUTER,
              height: RING_OUTER,
              left: (ORB_SIZE - RING_OUTER) / 2,
              top: (ORB_SIZE - RING_OUTER) / 2,
            },
            ringsStyle,
          ]}
          pointerEvents="none"
        >
          <NeonRing
            size={RING_OUTER}
            strokeWidth={1.4}
            color="#7DC3FF"
            direction="cw"
            duration={4200}
            trackOpacity={0.16}
          />
        </Animated.View>

        {/* Inner neon ring — tighter, faster, CCW, spins the other way */}
        <Animated.View
          style={[
            styles.ringSlot,
            {
              width: RING_INNER,
              height: RING_INNER,
              left: (ORB_SIZE - RING_INNER) / 2,
              top: (ORB_SIZE - RING_INNER) / 2,
            },
            ringsStyle,
          ]}
          pointerEvents="none"
        >
          <NeonRing
            size={RING_INNER}
            strokeWidth={1.2}
            color="#93C5FD"
            direction="ccw"
            duration={3000}
            trackOpacity={0.22}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The orb's layout box. Atmosphere layers are positioned relative to
  // its center and overflow it freely (RN Views don't clip by default),
  // so placing this box's center where the orb should sit reproduces the
  // home-screen composition exactly.
  box: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambient: {
    position: 'absolute',
    borderRadius: 9999,
  },
  ambientOuter: {
    width: 420,
    height: 420,
    left: ORB_SIZE / 2 - 210,
    top: ORB_SIZE / 2 - 210,
    backgroundColor: '#0A1426',
  },
  ambientMid: {
    width: 310,
    height: 310,
    left: ORB_SIZE / 2 - 155,
    top: ORB_SIZE / 2 - 155,
    backgroundColor: '#0B172C',
  },
  ambientInner: {
    width: 220,
    height: 220,
    left: ORB_SIZE / 2 - 110,
    top: ORB_SIZE / 2 - 110,
    backgroundColor: '#0D1C36',
  },
  ambientHalo: {
    position: 'absolute',
    left: ORB_SIZE / 2 - 0.5,
    top: ORB_SIZE / 2 - 0.5,
    width: 1,
    height: 1,
    borderRadius: 0.5,
    backgroundColor: 'transparent',
    shadowColor: '#0D1E35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
    boxShadow: [
      '0 0 50px 70px rgba(15, 36, 66, 0.65)',
      '0 0 90px 110px rgba(12, 30, 56, 0.45)',
      '0 0 140px 150px rgba(10, 26, 50, 0.32)',
      '0 0 200px 190px rgba(14, 30, 56, 0.18)',
      '0 0 280px 220px rgba(59, 130, 246, 0.08)',
      '0 0 380px 260px rgba(96, 165, 250, 0.04)',
    ].join(', '),
  },
  centerStack: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerGlow: {
    position: 'absolute',
    width: INNER_GLOW_SIZE,
    height: INNER_GLOW_SIZE,
    left: (ORB_SIZE - INNER_GLOW_SIZE) / 2,
    top: (ORB_SIZE - INNER_GLOW_SIZE) / 2,
    borderRadius: INNER_GLOW_SIZE / 2,
    backgroundColor: 'rgba(59, 130, 246, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.22)',
  },
  ringSlot: {
    position: 'absolute',
  },
  orbWrap: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: '#08111E',
    borderWidth: 1,
    borderColor: '#3B5070',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbText: {
    color: '#7BA8C8',
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 8,
  },
});
