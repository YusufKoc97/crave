import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  cancelAnimation,
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
import type { Addiction } from '@/constants/addictions';
import { maxMinutesFor } from '@/constants/addictions';
import { dsColors } from '@/constants/designSystem';
import { useAddictions } from '@/context/AddictionsContext';
import { ResistanceOrb, RESISTANCE_ORB_SIZE } from '@/components/ResistanceOrb';
import { lucideIconFor } from '@/components/info/iconMap';
import { t } from '@/lib/i18n';

// The orb's fan-out "selecting" scale — the RESIST core shrinks to half
// size so the tracked-addiction icons have room to bloom around it. Lives
// here (not in ResistanceOrb) because it's an animation trigger the home
// screen owns; ResistanceOrb only renders whatever scale it's handed.
const ORB_SELECTING_SCALE = 0.5;
/** Distance from screen bottom to the persistent "+" button.
 *  Tab bar pill sits at ~26px bottom + ~56px height = ~82px
 *  reserved; we leave a comfortable ~18px gap above it. */
const PLUS_BOTTOM = 104;

const ICON_SIZE = 62;
const ICON_R = 134;

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
  }, [
    orbScale,
    orbTextOpacity,
    ringsOpacity,
    innerGlowOpacity,
    innerGlowPulse,
    progress,
    total,
  ]);

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

  const goToCravingStart = useCallback((a: Addiction) => {
    // Faz 5 reversal: trigger capture moved to POST-resolve. The
    // orb now jumps straight into the timer with only the addiction
    // params — trigger picker fires from active-session after the
    // user taps I Resisted / I Failed.
    router.push({
      pathname: '/active-session',
      params: {
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        color: a.color,
        sensitivity: String(a.sensitivity),
        // Without this the timer falls back to a flat 9-min cycle
        // (active-session default), ignoring the addiction's
        // sensitivity-derived max and mis-timing the cycle bonus.
        maxMinutes: String(maxMinutesFor(a.sensitivity)),
      },
    });
  }, []);

  const onOrbPress = () => {
    if (wiggleMode) {
      setWiggleMode(false);
      return;
    }
    // 0 tracked addictions — dead tap. The empty-state hint below
    // the orb points the user at the "+" in the tab bar; opening
    // the catalog picker directly from the orb hid that affordance
    // and left first-time users unsure of what the "+" was for.
    if (addictions.length === 0) return;
    // The fan-out plays even with a single tracked addiction. It was
    // once skipped there as "friction" — an animation whose only job is
    // to pick one of one. In practice it read as the orb throwing the
    // user into a session they never chose: the tap that starts a
    // craving timer should always pass through a deliberate selection.
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
    setTimeout(() => goToCravingStart(a), 240);
  };

  const onAddictionLongPress = () => {
    setWiggleMode(true);
  };

  const onDeleteAddiction = (id: string) => {
    const target = addictions.find((a) => a.id === id);
    if (!target) return;
    // Native Alert on both platforms — no custom modal needed and the
    // Cancel / Confirm affordance is already familiar to users.
    Alert.alert(
      t('removal.title', { name: target.name }),
      t('removal.message'),
      [
        { text: t('removal.cancel'), style: 'cancel' },
        {
          text: t('removal.confirm'),
          style: 'destructive',
          onPress: () => {
            removeAddiction(id);
            // If the user just deleted the last visible addiction,
            // drop wiggle mode.
            if (addictions.length <= 1) {
              setWiggleMode(false);
            }
          },
        },
      ]
    );
  };

  const centerX = width / 2;
  const centerY = height / 2 - 30;

  return (
    <View style={styles.root}>
      {/* The RESIST core + its ambient atmosphere. The home screen owns
          the shared values and the enter/exit animation triggers; this
          component only renders them. Same component the onboarding flow
          mounts, so the two orbs are pixel-identical. */}
      <ResistanceOrb
        onPress={onOrbPress}
        orbScale={orbScale}
        orbTextOpacity={orbTextOpacity}
        ringsOpacity={ringsOpacity}
        innerGlowOpacity={innerGlowOpacity}
        innerGlowPulse={innerGlowPulse}
        style={{
          position: 'absolute',
          left: centerX - RESISTANCE_ORB_SIZE / 2,
          top: centerY - RESISTANCE_ORB_SIZE / 2,
        }}
      />

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

      {/* Persistent "+" button — sits centered between the orb and
          the floating tab bar, visible in both idle and selecting
          phases so users always have a one-tap route to the catalog
          picker without having to open the fan-out first. */}
      <View
        style={[styles.plusWrap, { left: centerX - 24, bottom: PLUS_BOTTOM }]}
      >
        <Pressable
          style={styles.plusBtn}
          onPress={() => router.push('/add-addiction')}
          hitSlop={8}
          accessibilityLabel={t('home.add_addiction_a11y')}
        >
          <Text style={styles.plusText}>+</Text>
        </Pressable>
      </View>
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
  const Glyph = lucideIconFor(addiction.id);

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
    // Stop the infinite wiggle loop if the tile unmounts mid-rock —
    // otherwise the worklet keeps ticking against a dead node.
    return () => cancelAnimation(wigglePhase);
  }, [wiggleMode, index, wigglePhase]);

  const animStyle = useAnimatedStyle(() => {
    // Each icon gets a longer "personal window" (1.4) so its motion overlaps
    // smoothly with neighbours instead of finishing in lockstep.
    const local = (progress.value - index * 0.85) / 1.4;
    const t = Math.max(0, Math.min(1, local));
    const scale = interpolate(
      t,
      [0, 0.55, 0.85, 1],
      [0.2, 0.92, 1.04, 1.0],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      t,
      [0, 0.35, 0.85, 1],
      [0, 0.55, 0.95, 1],
      Extrapolation.CLAMP
    );
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
          {/* Designed glyph set — the same map the Addictions tab
              draws its cards with. The platform emoji clashed with
              the drawn icons everywhere else in the app. */}
          <Glyph size={24} color={addiction.color} strokeWidth={2} />
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
    // Shared navy base across Home / Info / Profile so the floating tab
    // pill never sits on a seam between two different darks.
    backgroundColor: dsColors.bgBase,
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
