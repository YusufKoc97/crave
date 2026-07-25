import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { isOnboardingCompleted } from '@/lib/onboarding';
import { getUsername } from '@/lib/profile';
import { DEV_SKIP_AUTH } from '@/lib/devBypass';
import { colors } from '@/constants/theme';

// TEMP-AGE-GATE-DISABLED — 2026-07-25
// The 18+ age gate (`app/(onboarding)/index.tsx`) and the KVKK consent
// step (`app/(onboarding)/consent.tsx`) are intentionally unreachable:
// `isOnboardingCompleted()` is false on a fresh install, so every launch
// landed on "Yaş Doğrulama" with no way past it while the rest of the
// app is half-built.
//
// Both screen files are LEFT IN PLACE on purpose — age verification is
// coming back, but deliberately placed inside the real onboarding flow
// once that flow is designed. Nothing there should be deleted.
//
// Restoring is a one-line flip: set this to `false` and the original
// onboarding → auth → username → tabs ladder below runs untouched.
// Grep TEMP-AGE-GATE-DISABLED for every knob involved.
//
// Unlike DEV_SKIP_AUTH this is NOT guarded by __DEV__ or an env var, so
// it short-circuits release / preview builds on a real device too.
const LAUNCH_STRAIGHT_TO_HOME = true;

/**
 * Root entry point. Decides where to send the user based on:
 *   1. Has the user finished onboarding (age gate + consent)?
 *   2. Are they signed in?
 *   3. Have they picked a community handle?
 *
 * Order matters: onboarding always runs first because the consent step is a
 * legal pre-requisite to processing health-category data on the server. The
 * username gate runs AFTER auth because handles are per-user, server-stored.
 */
export default function Index() {
  const { session, user, loading: authLoading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [hasUsername, setHasUsername] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    isOnboardingCompleted().then((done) => {
      if (!cancelled) setOnboardingDone(done);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setHasUsername(null);
      return;
    }
    let cancelled = false;
    getUsername(user.id).then((u) => {
      if (!cancelled) setHasUsername(!!u && u.trim().length > 0);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // TEMP-AGE-GATE-DISABLED — go straight to the home tabs (orb). Placed
  // after every hook (Rules of Hooks) but before the loading gate so
  // there's no splash-spinner flash on the way through.
  if (LAUNCH_STRAIGHT_TO_HOME) {
    return <Redirect href="/(tabs)" />;
  }

  if (authLoading || onboardingDone === null) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  // Dev bypass — skip every gate (onboarding + auth + username) and drop
  // straight on the orb. Lets the screen be inspected when Supabase is
  // paused/unreachable, and avoids re-doing the age gate on every reload.
  // Runs BEFORE the onboarding check on purpose: in DEV we never want the
  // verification screen to block UI iteration.
  if (DEV_SKIP_AUTH) {
    return <Redirect href="/(tabs)" />;
  }

  if (!onboardingDone) {
    return <Redirect href="/(onboarding)" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Wait for the username probe to resolve before deciding (tabs vs setup).
  if (hasUsername === null) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  if (!hasUsername) {
    return <Redirect href="/setup-username" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
