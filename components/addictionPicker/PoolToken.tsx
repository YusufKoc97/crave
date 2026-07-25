import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Lock, type LucideIcon } from 'lucide-react-native';
import { hexAlpha } from '@/constants/designSystem';
import { RadialFill } from './fills';
import { pickerColors, pickerLayout, pickerTiming } from './pickerTheme';

/**
 * A circular addiction token in the pool below the loadout panel.
 *
 * Locked state (all slots taken) dims the token but keeps its icon and
 * its colour — the handoff is explicit that a token never turns into a
 * padlock. The lock is a 17pt corner badge only, so the user can still
 * read the shelf at a glance while they decide what to swap out.
 */

const SIZE = pickerLayout.tokenSize;
const ICON = 20;
const LOCK_BADGE = 17;
const RIPPLE = 120;

type Props = {
  name: string;
  hue: string;
  Icon?: LucideIcon;
  /** All slots full — the token stays visible but can't be equipped. */
  locked: boolean;
  /** Position in the grid — drives the entry stagger. */
  index: number;
  reduced: boolean;
  width: number;
  a11yLabel: string;
  onPress: () => void;
};

export function PoolToken({
  name,
  hue,
  Icon,
  locked,
  index,
  reduced,
  width,
  a11yLabel,
  onPress,
}: Props) {
  const enter = useSharedValue(reduced ? 1 : 0.7);
  const fade = useSharedValue(reduced ? 1 : 0);
  const press = useSharedValue(1);
  const shake = useSharedValue(0);
  const [ripple, setRipple] = useState<{
    key: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (reduced) {
      enter.value = 1;
      fade.value = 1;
      return;
    }
    const delay = index * pickerTiming.chipInStagger;
    enter.value = withDelay(
      delay,
      withSequence(
        withTiming(1.09, { duration: pickerTiming.chipIn * 0.65 }),
        withSpring(1, { stiffness: 260, damping: 18 })
      )
    );
    fade.value = withDelay(delay, withTiming(1, { duration: 220 }));
    // Entry runs once per mount. Tokens unmount when equipped and
    // remount when unequipped, which is exactly when a fresh entry
    // animation is wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: enter.value }],
  }));
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }, { translateX: shake.value }],
  }));

  const handlePress = (e: GestureResponderEvent) => {
    if (locked) {
      if (!reduced) {
        shake.value = withSequence(
          withTiming(-7, { duration: 90 }),
          withTiming(6, { duration: 90 }),
          withTiming(-4, { duration: 90 }),
          withTiming(3, { duration: 90 }),
          withTiming(0, { duration: 90 })
        );
      }
      onPress();
      return;
    }
    if (!reduced) {
      const { locationX, locationY } = e.nativeEvent;
      setRipple({ key: Date.now(), x: locationX, y: locationY });
    }
    onPress();
  };

  const iconColor = locked ? hexAlpha(hue, 0.55) : hue;

  return (
    <Pressable
      style={[styles.press, { width }]}
      onPress={handlePress}
      onPressIn={() => {
        press.value = withTiming(0.96, { duration: pickerTiming.press });
      }}
      onPressOut={() => {
        press.value = withTiming(1, { duration: pickerTiming.press });
      }}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <Animated.View style={pressStyle}>
        <Animated.View style={[styles.column, enterStyle]}>
          <View style={styles.circleWrap}>
            <View
              style={[
                styles.circleClip,
                { borderColor: hexAlpha(hue, locked ? 0.22 : 0.34) },
              ]}
            >
              <RadialFill
                cx={30}
                cy={26}
                rx={70}
                ry={70}
                stops={[
                  { offset: 0, color: hue, opacity: locked ? 0.1 : 0.2 },
                  { offset: 70, color: pickerColors.tokenDepth, opacity: 0.92 },
                  {
                    offset: 100,
                    color: pickerColors.tokenDepth,
                    opacity: 0.92,
                  },
                ]}
              />
              {!locked && <View style={styles.topHighlight} />}
              {/* Own layer — see the note on `centerGlyph` in Socket. */}
              <View style={styles.centerGlyph}>
                {Icon && <Icon size={ICON} color={iconColor} strokeWidth={2} />}
              </View>
            </View>
            {locked && (
              <View style={styles.lockBadge}>
                <Lock
                  size={13}
                  strokeWidth={2.6}
                  color={pickerColors.lockGlyph}
                />
              </View>
            )}
          </View>
          <Text
            numberOfLines={2}
            style={[
              styles.name,
              {
                color: locked
                  ? pickerColors.tokenNameLocked
                  : pickerColors.tokenName,
              },
            ]}
          >
            {name}
          </Text>
        </Animated.View>
      </Animated.View>

      {ripple && (
        <Ripple
          key={ripple.key}
          x={ripple.x}
          y={ripple.y}
          hue={hue}
          onDone={() => setRipple(null)}
        />
      )}
    </Pressable>
  );
}

/** The `ringOut` wave that blooms from the exact point of contact. */
function Ripple({
  x,
  y,
  hue,
  onDone,
}: {
  x: number;
  y: number;
  hue: string;
  onDone: () => void;
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(1, { duration: pickerTiming.ringOut });
    const id = setTimeout(onDone, pickerTiming.ringOut);
    return () => clearTimeout(id);
  }, [p, onDone]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - p.value),
    transform: [{ scale: 0.4 + p.value * 2.2 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        { left: x - RIPPLE / 2, top: y - RIPPLE / 2 },
        style,
      ]}
    >
      <RadialFill
        cx={50}
        cy={50}
        rx={50}
        ry={50}
        stops={[
          { offset: 0, color: hue, opacity: 0.5 },
          { offset: 70, color: hue, opacity: 0 },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  press: {
    alignItems: 'center',
  },
  column: {
    alignItems: 'center',
    gap: 7,
  },
  circleWrap: {
    width: SIZE,
    height: SIZE,
  },
  circleClip: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  centerGlyph: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: LOCK_BADGE,
    height: LOCK_BADGE,
    borderRadius: LOCK_BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: pickerColors.lockBadgeBg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  name: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12.5,
    maxWidth: 74,
  },
  ripple: {
    position: 'absolute',
    width: RIPPLE,
    height: RIPPLE,
  },
});
