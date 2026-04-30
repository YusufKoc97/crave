import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { type Addiction, maxMinutesFor } from '@/constants/addictions';
import { useAddictions } from '@/context/AddictionsContext';
import { NeonRing } from '@/components/NeonRing';

const ORB_SIZE = 168;
const ORB_SELECTING_SCALE = 0.5;

const ICON_SIZE = 62;
const ICON_R = 134;

const SMALL_ORB = ORB_SIZE * ORB_SELECTING_SCALE; // 84
const RING_INNER = SMALL_ORB + 8;  // 92 — hugs the small orb
const RING_OUTER = SMALL_ORB + 24; // 108 — slightly further out
const INNER_GLOW_SIZE = SMALL_ORB - 12; // 72 — inside the orb behind text

type Phase = 'idle' | 'selecting';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const { addictions, removeAddiction } = useAddictions();
  const [phase, setPhase] = useState<Phase>('idle');
  const [wiggleMode, setWiggleMode] = useState(false);

  const orbScale = useSharedValue(1);
  const orbTextOpacity = useSharedValue(1);
  const ringsOpacity = useSharedValue(0);
  const innerGlowOpacity = useSharedValue(0);
  const innerGlowPulse = useSharedValue(0);
  const progress = useSharedValue(0);

  const total = addictions.length;

  const enterSelecting = useCallback(() => {
    setPhase('selecting');
    orbScale.value = withTiming(ORB_SELECTING_SCALE, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
    orbTextOpacity.value = withTiming(0.45, { duration: 400 });
    ringsOpacity.value = withDelay(
      80,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) })
    );
    innerGlowOpacity.value = withDelay(
      120,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) })
    );
    innerGlowPulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    // Smoother, longer cascade with ease-out-expo curve so each icon settles
    // gently at its destination instead of arriving at the same speed.
    progress.value = withTiming(total, {
      duration: 800 + total * 110,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [orbScale, orbTextOpacity, ringsOpacity, innerGlowOpacity, innerGlowPulse, progress, total]);

  const exitSelecting = useCallback(() => {
    // All exit animations start in lock-step with the orb growing back so the
    // user perceives a single unified "snap closed" gesture, not delayed parts.
    const D = 420;
    const ease = Easing.bezier(0.32, 0, 0.4, 1);
    progress.value = withTiming(0, { duration: D, easing: ease });
    innerGlowOpacity.value = withTiming(0, { duration: 220 });
    ringsOpacity.value = withTiming(0, { duration: D - 80, easing: ease });
    orbScale.value = withTiming(1, { duration: D, easing: ease });
    orbTextOpacity.value = withDelay(160, withTiming(1, { duration: 320 }));
    setTimeout(() => setPhase('idle'), D + 20);
  }, [orbScale, orbTextOpacity, ringsOpacity, innerGlowOpacity, progress]);

  const onOrbPress = () => {
    if (wiggleMode) {
      setWiggleMode(false);
      return;
    }
    if (phase === 'idle') enterSelecting();
    else exitSelecting();
  };

  const onAddictionPress = (a: Addiction) => {
    if (wiggleMode) {
      // While in wiggle mode taps don't open the session, they only target the
      // delete affordance. Tapping a tile body simply exits wiggle mode.
      setWiggleMode(false);
      return;
    }
    exitSelecting();
    setTimeout(() => {
      router.push({
        pathname: '/active-session',
        params: {
          id: a.id,
          name: a.name,
          emoji: a.emoji,
          color: a.color,
          maxMinutes: String(maxMinutesFor(a.sensitivity)),
          sensitivity: String(a.sensitivity),
        },
      });
    }, 240);
  };

  const onAddictionLongPress = () => {
    setWiggleMode(true);
  };

  const onDeleteAddiction = (id: string) => {
    removeAddiction(id);
    // If the user just deleted the last visible addiction, drop wiggle mode.
    if (addictions.length <= 1) {
      setWiggleMode(false);
    }
  };

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const orbTextStyle = useAnimatedStyle(() => ({
    opacity: orbTextOpacity.value,
  }));

  const ringsStyle = useAnimatedStyle(() => ({
    opacity: ringsOpacity.value,
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: innerGlowOpacity.value * (0.55 + innerGlowPulse.value * 0.45),
    transform: [{ scale: 0.92 + innerGlowPulse.value * 0.12 }],
  }));

  const centerX = width / 2;
  const centerY = height / 2 - 30;

  return (
    <View style={styles.root}>
      <View
        pointerEvents="none"
        style={[
          styles.ambient,
          styles.ambientOuter,
          { left: centerX - 210, top: centerY - 210 },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.ambient,
          styles.ambientMid,
          { left: centerX - 155, top: centerY - 155 },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.ambient,
          styles.ambientInner,
          { left: centerX - 110, top: centerY - 110 },
        ]}
      />

      <View
        style={[
          styles.centerStack,
          { top: centerY - ORB_SIZE / 2, left: centerX - ORB_SIZE / 2 },
        ]}
      >
        {/* Inner pulsing glow inside the small orb */}
        <Animated.View
          style={[
            styles.innerGlow,
            {
              left: (ORB_SIZE - INNER_GLOW_SIZE) / 2,
              top: (ORB_SIZE - INNER_GLOW_SIZE) / 2,
            },
            innerGlowStyle,
          ]}
          pointerEvents="none"
        />

        <Animated.View style={[styles.orbWrap, orbStyle]}>
          <Pressable onPress={onOrbPress} style={styles.orb}>
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

        {/* Inner neon ring — tighter, faster, CCW, also hugs the orb (so the
            two layers spin in opposite directions just outside RESIST) */}
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

      {phase === 'selecting' && (
        <View
          pointerEvents="box-none"
          style={[styles.iconLayer, { left: centerX, top: centerY }]}
        >
          {addictions.map((a, i) => (
            <AddictionIcon
              key={a.id}
              addiction={a}
              index={i}
              total={total}
              progress={progress}
              wiggleMode={wiggleMode}
              onPress={() => onAddictionPress(a)}
              onLongPress={onAddictionLongPress}
              onDelete={() => onDeleteAddiction(a.id)}
            />
          ))}
        </View>
      )}

      {phase === 'selecting' && (
        <Animated.View
          style={[
            styles.plusWrap,
            ringsStyle,
            { left: centerX - 24, top: centerY + ICON_R + ICON_SIZE / 2 + 26 },
          ]}
        >
          <Pressable
            style={styles.plusBtn}
            onPress={() => router.push('/add-addiction')}
            hitSlop={8}
          >
            <Text style={styles.plusText}>+</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

function AddictionIcon({
  addiction,
  index,
  total,
  progress,
  wiggleMode,
  onPress,
  onLongPress,
  onDelete,
}: {
  addiction: Addiction;
  index: number;
  total: number;
  progress: SharedValue<number>;
  wiggleMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
}) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const x = Math.cos(angle) * ICON_R;
  const y = Math.sin(angle) * ICON_R;

  // RN Web fires onPress on release even after a long-press, which would
  // immediately exit wiggle mode again. We use a ref to suppress the next
  // onPress when a long-press has just fired.
  const consumeNextPress = useRef(false);

  // Each icon gets its own slight phase offset on the wiggle so the row looks
  // organic instead of every tile rotating in lockstep.
  const wigglePhase = useSharedValue(0);

  useEffect(() => {
    if (wiggleMode) {
      // Stagger the start by a few ms per index for that iOS feel.
      wigglePhase.value = withDelay(
        index * 35,
        withRepeat(
          withTiming(1, {
            duration: 160 + (index % 3) * 18,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true
        )
      );
    } else {
      wigglePhase.value = withTiming(0, { duration: 140 });
    }
  }, [wiggleMode, index, wigglePhase]);

  const animStyle = useAnimatedStyle(() => {
    // Each icon gets a longer "personal window" (1.4) so its motion overlaps
    // smoothly with neighbours instead of finishing in lockstep.
    const local = (progress.value - index * 0.85) / 1.4;
    const t = Math.max(0, Math.min(1, local));
    const scale = interpolate(t, [0, 0.55, 0.85, 1], [0.2, 0.92, 1.04, 1.0], Extrapolation.CLAMP);
    const opacity = interpolate(t, [0, 0.35, 0.85, 1], [0, 0.55, 0.95, 1], Extrapolation.CLAMP);
    const eased = 1 - Math.pow(1 - t, 3);
    const tx = x * eased;
    const ty = y * eased;

    // Wiggle: a small ±2° rocking motion around the resting orientation.
    const wiggleDeg = (wigglePhase.value * 2 - 1) * 2.2;

    return {
      opacity,
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${wiggleDeg}deg` },
        { scale },
      ],
    };
  });

  // Plain inline style, not useAnimatedStyle — Reanimated worklets only track
  // shared values, so React state (wiggleMode) wouldn't trigger updates there.
  const deleteVisualStyle = {
    opacity: wiggleMode ? 1 : 0,
    transform: [{ scale: wiggleMode ? 1 : 0.6 }] as const,
  };

  return (
    <Animated.View
      style={[
        styles.iconWrap,
        animStyle,
        { left: -ICON_SIZE / 2, top: -ICON_SIZE / 2 },
      ]}
    >
      <Pressable
        onPress={() => {
          if (consumeNextPress.current) {
            consumeNextPress.current = false;
            return;
          }
          onPress();
        }}
        onLongPress={() => {
          consumeNextPress.current = true;
          onLongPress();
        }}
        delayLongPress={350}
        style={styles.iconBtnOuter}
      >
        <View style={styles.iconBtn}>
          <Text style={styles.iconEmoji}>{addiction.emoji}</Text>
          <Text
            style={[
              styles.iconLabel,
              { color: hexWithAlpha(addiction.color, 0.92) },
            ]}
            numberOfLines={1}
          >
            {addiction.name}
          </Text>
        </View>
      </Pressable>

      {/* Delete affordance — only interactive in wiggle mode */}
      <View
        pointerEvents={wiggleMode ? 'auto' : 'none'}
        style={[styles.deleteBadge, deleteVisualStyle]}
      >
        <Pressable onPress={onDelete} hitSlop={6} style={styles.deleteBtn}>
          <Text style={styles.deleteX}>×</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function hexWithAlpha(hex: string, alpha: number) {
  // Accept #RRGGBB; return rgba()
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020810',
  },
  ambient: {
    position: 'absolute',
    borderRadius: 9999,
  },
  ambientOuter: {
    width: 420,
    height: 420,
    backgroundColor: '#060F1E',
  },
  ambientMid: {
    width: 310,
    height: 310,
    backgroundColor: '#091525',
  },
  ambientInner: {
    width: 220,
    height: 220,
    backgroundColor: '#0D1E35',
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
  iconLayer: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  iconWrap: {
    position: 'absolute',
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  iconBtnOuter: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 13,
  },
  iconBtn: {
    flex: 1,
    borderRadius: 13,
    borderWidth: 1,
    backgroundColor: '#0A1628',
    borderColor: '#1A2A45',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  iconEmoji: {
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
  },
  iconLabel: {
    marginTop: 4,
    fontSize: 8.5,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  deleteBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1A2A45',
    borderWidth: 1,
    borderColor: '#3D5470',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteX: {
    color: '#F1F5F9',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: -1,
  },
  plusWrap: {
    position: 'absolute',
  },
  plusBtn: {
    width: 48,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E3050',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    color: '#7BA8C8',
    fontSize: 18,
    fontWeight: '300',
    lineHeight: 20,
  },
});
