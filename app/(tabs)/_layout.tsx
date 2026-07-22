import { useEffect, useState } from 'react';
import { Redirect, withLayoutContext } from 'expo-router';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabBarProps,
} from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { DEV_SKIP_AUTH } from '@/lib/devBypass';

type IoniconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { idle: IoniconName; active: IoniconName }> = {
  profile: { idle: 'person-outline', active: 'person' },
  index: { idle: 'home-outline', active: 'home' },
  info: { idle: 'compass-outline', active: 'compass' },
};

const TAB_ORDER = ['profile', 'index', 'info'];

// Pill width scales with tab count so a future 4th tab doesn't crop.
// Number is tuned to leave ~14px padding + ~56px per tab; tighter
// than the RN default hit target on purpose because the active
// affordance is the 36px bubble, not the whole cell.
const PER_TAB_WIDTH = 56;
const PILL_HORIZONTAL_PADDING = 14;
const PILL_WIDTH =
  TAB_ORDER.length * PER_TAB_WIDTH + PILL_HORIZONTAL_PADDING * 2;

// ────────────────── Material-top-tabs bridge ──────────────────
//
// expo-router doesn't ship a first-party material-top-tabs binding, so we
// use `withLayoutContext` to hoist react-navigation's Navigator into the
// expo-router file-based tree. Same pattern as expo's own docs. This gives
// us pager-view semantics (native UIPageViewController / ViewPager2) with
// finger-tracking swipe + snap + spring — none of which the plain
// expo-router <Tabs> (bottom-tabs) provides — while keeping deep-link
// routing intact (`/(tabs)/profile`, `/info/nicotine`, etc.).
const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

/**
 * Custom bottom pill. Receives `position: Animated.AnimatedInterpolation`
 * from material-top-tabs — a live value in [0, tabCount-1] that reflects
 * pager scroll position, not just the settled index. Interpolating against
 * that value makes the active bubble + indicator dot move CONTINUOUSLY as
 * the user drags, instead of jumping when the swipe threshold flips.
 *
 * Kept the classic RN `Animated` API (not Reanimated) here on purpose —
 * `position` is already a native AnimatedValue on the JS side and using
 * `.interpolate(...)` composes cleanly without a bridge shared value.
 */
function CustomTabBar({ state, navigation, position }: MaterialTopTabBarProps) {
  const orderedRoutes = TAB_ORDER.map((name) =>
    state.routes.find((r) => r.name === name)
  ).filter(Boolean) as typeof state.routes;

  const inputRange = state.routes.map((_, i) => i);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.pill}>
        {orderedRoutes.map((route) => {
          const realIndex = state.routes.findIndex((r) => r.key === route.key);
          const icons = TAB_ICONS[route.name] ?? {
            idle: 'ellipse-outline' as IoniconName,
            active: 'ellipse' as IoniconName,
          };

          // Bubble is fully visible when position === realIndex, fades to 0
          // at every other tab. Same interpolation for the dot underneath
          // and the inverse for the idle icon so the crossfade is smooth.
          const bubbleOpacity = position.interpolate({
            inputRange,
            outputRange: inputRange.map((i) => (i === realIndex ? 1 : 0)),
          });
          const idleOpacity = position.interpolate({
            inputRange,
            outputRange: inputRange.map((i) => (i === realIndex ? 0 : 0.65)),
          });
          const dotOpacity = position.interpolate({
            inputRange,
            outputRange: inputRange.map((i) => (i === realIndex ? 0.8 : 0)),
          });

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            const isFocused = state.index === realIndex;
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: state.index === realIndex }}
            >
              {/* Active bubble — fades in as the pager settles on this tab. */}
              <Animated.View
                style={[styles.activeBubble, { opacity: bubbleOpacity }]}
                pointerEvents="none"
              >
                <Ionicons name={icons.active} size={19} color="#E2E8F0" />
              </Animated.View>
              {/* Idle outline icon underneath — visible when this tab isn't
                  the active one; opacity interpolation makes the crossfade
                  read as one smooth motion. */}
              <Animated.View
                style={[styles.idleIconLayer, { opacity: idleOpacity }]}
                pointerEvents="none"
              >
                <Ionicons
                  name={icons.idle}
                  size={19}
                  color="rgba(148, 163, 184, 0.65)"
                />
              </Animated.View>
              <Animated.View
                style={[styles.dot, { opacity: dotOpacity }]}
                pointerEvents="none"
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  // Bounce out of the tabs the moment the session disappears (e.g. user tapped
  // "Çıkış yap" on the profile screen). The root index would also redirect on
  // a fresh launch, but we want sign-out to feel instant without a reload.
  const { session, loading } = useAuth();

  // Reduced-motion consumers get an instant swap instead of the slide —
  // disable both the swipe gesture and the settle animation so the pager
  // behaves like a plain page-swap.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      if (!cancelled) setReducedMotion(r);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (r) => {
        if (!cancelled) setReducedMotion(r);
      }
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  if (!DEV_SKIP_AUTH && !loading && !session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      tabBar={(props) => <CustomTabBar {...props} />}
      initialRouteName="index"
      screenOptions={{
        // Full finger-tracking pager gesture — native UI thread, 60fps.
        swipeEnabled: !reducedMotion,
        animationEnabled: !reducedMotion,
        // Keep all three screens mounted so a mid-drag never shows blank
        // content and per-screen state (scroll offsets, timers) survives.
        lazy: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <MaterialTopTabs.Screen name="profile" />
      <MaterialTopTabs.Screen name="index" />
      <MaterialTopTabs.Screen name="info" />
    </MaterialTopTabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: 'center',
    justifyContent: 'center',
    // Ensure the pill sits ABOVE the material-top-tabs pager scene, even
    // though tabBarPosition="bottom" already renders it in the correct
    // stacking order — belt and braces for web z-index quirks.
    zIndex: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    // Derived from TAB_ORDER.length so a new tab doesn't crop the
    // pill. See PER_TAB_WIDTH + PILL_HORIZONTAL_PADDING constants.
    width: PILL_WIDTH,
    borderRadius: 32,
    paddingHorizontal: PILL_HORIZONTAL_PADDING,
    backgroundColor: '#0D1E35DD',
    borderWidth: 1,
    borderColor: '#1E3050',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
      },
      default: {},
    }),
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  activeBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  idleIconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textPrimary,
  },
});
