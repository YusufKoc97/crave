import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Crown, Pointer, type LucideIcon } from 'lucide-react-native';
import { GlowDisc } from '@/components/ui/GlowDisc';
import { LinearFill, RadialFill } from './fills';
import { EmptySocket, FilledSocket } from './Socket';
import {
  GOLD,
  goldA,
  pickerColors,
  pickerLayout,
  pickerRadius,
  pickerTiming,
  socketSizeFor,
} from './pickerTheme';

/**
 * The LOADOUT panel — the hero of the sheet.
 *
 * The old picker expressed the free-tier ceiling as a blue text
 * banner. Here the ceiling *is* the layout: one physical socket per
 * slot the user is entitled to, so "you have room for one more" and
 * "you're out of room" are the same glance.
 *
 * Slot count comes from `useAddictions().limit` (1 free / 5 premium),
 * not the handoff's hardcoded four.
 */

const SHEEN_W = 70;
const HINT_ICON = 13;

export type SlotItem = {
  id: string;
  name: string;
  hue: string;
  Icon?: LucideIcon;
};

type Props = {
  /** Outer width of the panel in pt. */
  width: number;
  limit: number;
  slots: SlotItem[];
  /** Id equipped by the most recent tap — the only one that pops. */
  freshId: string | null;
  /** Bumped by the parent to replay the "no room" rejection. */
  rejectSignal: number;
  reduced: boolean;
  labels: {
    loadout: string;
    free: string;
    next: string;
    empty: string;
    hint: string;
    unequipA11y: (name: string) => string;
  };
  /** Non-null while an add/remove failed — replaces the hint line. */
  error: string | null;
  onUnequip: (id: string) => void;
};

export function LoadoutPanel({
  width,
  limit,
  slots,
  freshId,
  rejectSignal,
  reduced,
  labels,
  error,
  onUnequip,
}: Props) {
  const full = slots.length >= limit;
  // A user can hold more than the current limit — they were premium, or
  // the tier ceiling moved under them. Those extra addictions are still
  // tracked, so they get sockets; otherwise this screen would be the
  // one place they're invisible and impossible to unequip.
  const socketCount = Math.max(limit, slots.length);
  const innerWidth = width - pickerLayout.panelPadding * 2;
  const socketSize = socketSizeFor(innerWidth, socketCount);

  const shake = useSharedValue(0);
  const glow = useSharedValue(0);
  const sheen = useSharedValue(-SHEEN_W * 1.3);

  // Rejection feedback: the panel itself refuses, rather than a
  // sentence appearing somewhere else on the screen.
  useEffect(() => {
    if (rejectSignal === 0 || reduced) return;
    shake.value = withSequence(
      withTiming(-7, { duration: 100 }),
      withTiming(6, { duration: 100 }),
      withTiming(-4, { duration: 100 }),
      withTiming(3, { duration: 100 }),
      withTiming(0, { duration: 100 })
    );
    glow.value = withSequence(
      withTiming(1, { duration: pickerTiming.glowPulse / 2 }),
      withTiming(0, { duration: pickerTiming.glowPulse / 2 })
    );
  }, [rejectSignal, reduced, shake, glow]);

  useEffect(() => {
    if (reduced) return;
    const travel = pickerTiming.sheen * 0.55;
    sheen.value = withDelay(
      pickerTiming.sheenDelay,
      withRepeat(
        withSequence(
          withTiming(SHEEN_W * 2.6, {
            duration: travel,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(SHEEN_W * 2.6, {
            duration: pickerTiming.sheen - travel,
          }),
          withTiming(-SHEEN_W * 1.3, { duration: 0 })
        ),
        -1,
        false
      )
    );
  }, [reduced, sheen]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheen.value }, { skewX: '-18deg' }],
  }));

  const cells = [];
  for (let i = 0; i < socketCount; i += 1) {
    const item = slots[i];
    if (item) {
      cells.push(
        <FilledSocket
          key={item.id}
          size={socketSize}
          name={item.name}
          hue={item.hue}
          Icon={item.Icon}
          index={i}
          fresh={freshId === item.id}
          reduced={reduced}
          onPress={() => onUnequip(item.id)}
          a11yLabel={labels.unequipA11y(item.name)}
        />
      );
    } else {
      cells.push(
        <EmptySocket
          key={`empty-${i}`}
          size={socketSize}
          isNext={i === slots.length}
          label={i === slots.length ? labels.next : labels.empty}
          reduced={reduced}
        />
      );
    }
  }

  const HintIcon = full ? Crown : Pointer;
  const hintColor = error
    ? pickerColors.danger
    : full
      ? goldA(0.95)
      : pickerColors.subtitle;

  return (
    <Animated.View style={[styles.shadowHost, shakeStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.rejectHalo, glowStyle]}
      />

      <View
        style={[
          styles.panel,
          {
            borderColor: full ? goldA(0.34) : 'rgba(255, 255, 255, 0.1)',
          },
        ]}
      >
        {/* Gold bloom under the panel — a GlowDisc rather than a
            `filter: blur()` div, which paints nothing on native. */}
        <GlowDisc
          leftPct={50}
          topPct={44}
          size={width * 1.2}
          color={goldA(0.1)}
        />
        <LinearFill
          x1={18}
          y1={0}
          x2={82}
          y2={100}
          stops={[
            { offset: 0, color: '#1a223a', opacity: 0.78 },
            { offset: 100, color: '#0c1222', opacity: 0.78 },
          ]}
        />
        <RadialFill
          cx={100}
          cy={0}
          rx={130}
          ry={130}
          stops={[
            { offset: 0, color: GOLD, opacity: 0.13 },
            { offset: 62, color: GOLD, opacity: 0 },
          ]}
        />
        <View style={styles.topHighlight} />

        <Animated.View style={[styles.sheen, sheenStyle]}>
          <LinearFill
            x1={0}
            y1={50}
            x2={100}
            y2={50}
            stops={[
              { offset: 0, color: GOLD, opacity: 0 },
              { offset: 50, color: GOLD, opacity: 0.12 },
              { offset: 100, color: GOLD, opacity: 0 },
            ]}
          />
        </Animated.View>

        {/* Content sits in its own positioned layer so the gradient
            fills behind it can't paint over it on web. See the
            `centerGlyph` note in Socket.tsx. */}
        <View style={styles.content}>
          <View style={styles.headRow}>
            <Text style={styles.loadoutLabel}>{labels.loadout}</Text>
            <Text
              style={[
                styles.counter,
                { color: full ? GOLD : pickerColors.counter },
              ]}
            >
              {slots.length}
              <Text style={styles.counterDim}>{labels.free}</Text>
            </Text>
          </View>

          <View style={styles.socketRow}>{cells}</View>

          <View style={styles.hintRow}>
            {!error && (
              <HintIcon size={HINT_ICON} strokeWidth={2.6} color={hintColor} />
            )}
            <Text style={[styles.hintText, { color: hintColor }]}>
              {error ?? labels.hint}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowHost: {
    borderRadius: pickerRadius.panel,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 17,
    elevation: 10,
  },
  rejectHalo: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: pickerRadius.panel + 6,
    borderWidth: 6,
    borderColor: goldA(0.18),
  },
  panel: {
    borderRadius: pickerRadius.panel,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: 16,
    paddingHorizontal: pickerLayout.panelPadding,
    paddingBottom: 15,
    backgroundColor: '#0c1222',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SHEEN_W,
  },
  content: {
    position: 'relative',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loadoutLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.2,
    color: pickerColors.sectionLabel,
  },
  counter: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  counterDim: {
    color: '#5a6d8c',
    fontWeight: '800',
  },
  socketRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: pickerLayout.socketGap,
    marginTop: 15,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 15,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  hintText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
});
