import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';

/**
 * Nested stack under the Info tab. Faz 4 decision: the addiction
 * landing page ([addictionId]) lives inside the tab so the bottom
 * pill stays visible while the user reads Journey / Toolkit /
 * Triggers / Comparison — matches the "stay in context" flow.
 */
export default function InfoStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[addictionId]" />
    </Stack>
  );
}
