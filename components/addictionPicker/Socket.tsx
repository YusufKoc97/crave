import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Plus, X, type LucideIcon } from 'lucide-react-native';
import { hexAlpha } from '@/constants/designSystem';
import { DashedBox, RadialFill } from './fills';
import { goldA, pickerColors, pickerRadius, pickerTiming } from './pickerTheme';

/**
 * One slot in the LOADOUT panel. Three states, per the handoff:
 *
 * - **filled**  — the addiction is tracked; tap to unequip
 * - **next**    — the slot the next equip will land in; gold, pulsing
 * - **empty**   — a slot beyond `next`; inert
 *
 * `size` is computed by the parent from the live tier limit rather
 * than being the handoff's fixed four-across, so a 1-slot free tier
 * and a 5-slot premium tier both lay out correctly.
 */

const ICON = 20;
const BADGE_ICON = 13;
const BADGE = 19;

type FilledProps = {
  size: number;
  name: string;
  hue: string;
  Icon?: LucideIcon;
  /** Index in the row — drives the entry stagger. */
  index: number;
  /** True for the socket that was just equipped: pop instead of fade. */
  fresh: boolean;
  reduced: boolean;
  onPress: () => void;
  a11yLabel: string;
};

export function FilledSocket({
  size,
  name,
  hue,
  Icon,
  index,
  fresh,
  reduced,
  onPress,
  a11yLabel,
}: FilledProps) {
  const enter = useSharedValue(reduced ? 1 : fresh ? 0.55 : 0.7);
  const fade = useSharedValue(reduced || fresh ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      enter.value = 1;
      fade.value = 1;
      return;
    }
    if (fresh) {
      // socketPop — the one moment the sheet is allowed to be loud.
      enter.value = withSpring(1, { stiffness: 300, damping: 14 });
      fade.value = 1;
      return;
    }
    const delay = index * pickerTiming.socketStagger;
    enter.value = withDelay(
      delay,
      withSequence(
        withTiming(1.09, { duration: pickerTiming.chipIn * 0.65 }),
        withSpring(1, { stiffness: 260, damping: 18 })
      )
    );
    fade.value = withDelay(delay, withTiming(1, { duration: 220 }));
    // Entry choreography runs once per mount; re-firing it on every
    // prop change would re-animate untouched sockets on each equip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: enter.value }],
  }));
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(0.96, { duration: pickerTiming.press });
      }}
      onPressOut={() => {
        press.value = withTiming(1, { duration: pickerTiming.press });
      }}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={{ width: size }}
    >
      <Animated.View style={pressStyle}>
        <Animated.View style={[styles.column, enterStyle]}>
          <View
            style={[
              styles.shadowWrap,
              {
                width: size,
                height: size,
                shadowColor: hue,
              },
            ]}
          >
            <View
              style={[
                styles.clip,
                {
                  width: size,
                  height: size,
                  borderColor: hexAlpha(hue, 0.62),
                },
              ]}
            >
              <RadialFill
                cx={30}
                cy={20}
                rx={120}
                ry={120}
                stops={[
                  { offset: 0, color: hue, opacity: 0.42 },
                  {
                    offset: 72,
                    color: pickerColors.socketDepth,
                    opacity: 0.95,
                  },
                  { offset: 100, color: pickerColors.socketDepth, opacity: 1 },
                ]}
              />
              {/* Colour bouncing back up off the bottom edge. */}
              <RadialFill
                cx={50}
                cy={120}
                rx={90}
                ry={70}
                stops={[
                  { offset: 0, color: hue, opacity: 0.3 },
                  { offset: 70, color: hue, opacity: 0 },
                ]}
              />
              <View style={styles.topHighlight} />
              <View style={styles.centerGlyph}>
                {Icon && <Icon size={ICON} color={hue} strokeWidth={2} />}
              </View>
            </View>
          </View>

          {/* Sits outside the clipped box, so it can overhang. */}
          <View
            style={[styles.xBadge, { backgroundColor: hue, shadowColor: hue }]}
          >
            <X
              size={BADGE_ICON}
              strokeWidth={2.6}
              color={pickerColors.badgeGlyph}
            />
          </View>

          <Text numberOfLines={2} style={[styles.slotLabel, { color: hue }]}>
            {name}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

type EmptyProps = {
  size: number;
  /** The slot the next equip lands in — gold, pulsing, labelled "Next". */
  isNext: boolean;
  label: string;
  reduced: boolean;
};

export function EmptySocket({ size, isNext, label, reduced }: EmptyProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!isNext || reduced) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: pickerTiming.hintPulse / 2 }),
        withTiming(0, { duration: pickerTiming.hintPulse / 2 })
      ),
      -1,
      false
    );
  }, [isNext, reduced, pulse]);

  const brightStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const glyph = isNext ? goldA(0.85) : pickerColors.emptyGlyph;

  return (
    <View style={[styles.column, { width: size }]}>
      <View style={{ width: size, height: size }}>
        {isNext && (
          <Animated.View
            style={[
              styles.halo,
              { borderRadius: pickerRadius.socket + 5 },
              haloStyle,
            ]}
          />
        )}
        <DashedBox
          size={size}
          radius={pickerRadius.socket}
          stroke={isNext ? goldA(0.28) : 'rgba(255, 255, 255, 0.13)'}
          fill={isNext ? goldA(0.05) : 'rgba(255, 255, 255, 0.02)'}
        />
        {/* Bright dashes cross-fade over the dim ones — cheaper and
            steadier than interpolating a stroke colour on the UI
            thread every frame. */}
        {isNext && (
          <Animated.View style={[StyleSheet.absoluteFill, brightStyle]}>
            <DashedBox
              size={size}
              radius={pickerRadius.socket}
              stroke={goldA(0.6)}
              fill="transparent"
            />
          </Animated.View>
        )}
        <View style={styles.centerGlyph}>
          <Plus size={BADGE_ICON} strokeWidth={2.6} color={glyph} />
        </View>
      </View>
      <Text
        style={[
          styles.slotLabel,
          {
            color: isNext ? goldA(0.9) : pickerColors.emptyLabel,
            fontWeight: isNext ? '700' : '600',
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
    gap: 7,
  },
  shadowWrap: {
    borderRadius: pickerRadius.socket,
    // Native drop shadow. `boxShadow` is web-only and this card is the
    // one place the addiction colour is meant to bleed onto the panel.
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 11,
    elevation: 6,
  },
  clip: {
    borderRadius: pickerRadius.socket,
    borderWidth: 1.5,
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  xBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4.5,
    elevation: 8,
  },
  slotLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 11.4,
    maxWidth: 72,
  },
  halo: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    backgroundColor: goldA(0.1),
  },
  /**
   * Icons sit in their own absolutely-positioned layer rather than as
   * an in-flow child.
   *
   * The gradient fills behind them are absolutely positioned too, and
   * on web CSS paints *every* positioned element above every in-flow
   * one regardless of DOM order — so an in-flow icon rendered after
   * the gradients still ends up underneath them. Native paints in
   * child order and doesn't care. Positioning the icon puts it in the
   * same layer as the fills, where source order wins on both.
   */
  centerGlyph: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
