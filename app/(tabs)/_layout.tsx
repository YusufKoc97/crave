import { Tabs, Redirect } from 'expo-router';
import { Pressable, StyleSheet, View, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { DEV_SKIP_AUTH } from '@/lib/devBypass';

type IoniconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { idle: IoniconName; active: IoniconName }> = {
  profile: { idle: 'person-outline', active: 'person' },
  index: { idle: 'home-outline', active: 'home' },
  community: { idle: 'chatbubble-outline', active: 'chatbubble' },
};

const TAB_ORDER = ['profile', 'index', 'community'];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const orderedRoutes = TAB_ORDER.map((name) =>
    state.routes.find((r) => r.name === name)
  ).filter(Boolean) as typeof state.routes;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.pill}>
        {orderedRoutes.map((route) => {
          const realIndex = state.routes.findIndex((r) => r.key === route.key);
          const isFocused = state.index === realIndex;
          const icons = TAB_ICONS[route.name] ?? {
            idle: 'ellipse-outline' as IoniconName,
            active: 'ellipse' as IoniconName,
          };

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabBtn}
              hitSlop={8}
            >
              {isFocused ? (
                <View style={styles.activeBubble}>
                  <Ionicons
                    name={icons.active}
                    size={19}
                    color="#E2E8F0"
                  />
                </View>
              ) : (
                <Ionicons
                  name={icons.idle}
                  size={19}
                  color="rgba(148, 163, 184, 0.65)"
                />
              )}
              {isFocused && <View style={styles.dot} />}
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
  if (!DEV_SKIP_AUTH && !loading && !session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="community" />
    </Tabs>
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
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    width: 168,
    borderRadius: 32,
    paddingHorizontal: 14,
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
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textPrimary,
    opacity: 0.8,
  },
});
