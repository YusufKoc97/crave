import { Stack } from 'expo-router';
import { dsColors } from '@/constants/designSystem';

/**
 * The 5-screen first-launch onboarding flow (plus a soft-block screen).
 * Order: welcome → how-it-works → choose-focus → age-check → ready.
 * Swipe-back is disabled so the age gate can't be skipped by gesture;
 * each screen drives navigation explicitly.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: dsColors.bgBase },
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="how-it-works" />
      <Stack.Screen name="choose-focus" />
      <Stack.Screen name="age-check" />
      <Stack.Screen name="ready" />
      <Stack.Screen name="blocked" />
    </Stack>
  );
}
