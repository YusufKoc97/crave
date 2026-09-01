import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { isOnboardingCompleted } from '@/lib/onboarding';
import { getUsername } from '@/lib/profile';
import { DEV_SKIP_AUTH } from '@/lib/devBypass';
import { DEV_SEED_DATA } from '@/lib/devSeed';
import { colors } from '@/constants/theme';

// Onboarding ENABLED — 2026-08-12
// First launch now runs the 5-screen onboarding flow in
// `app/(onboarding)` (welcome → how-it-works → choose-focus → age-check
// → ready). The 18+ age check lives INSIDE that flow (screen 4, with the
// KVKK health-data consent folded in), so the old standalone
// TEMP-AGE-GATE-DISABLED short-circuit is gone.
//
// Auth + username are still intentionally bypassed: the sibling
// TEMP-AUTH-GATE-DISABLED flag in `app/(tabs)/_layout.tsx` stops /(tabs)
// from bouncing out to sign-in, and this gate skips the auth + username
// rungs of the ladder below. Those phases return with real auth.
//
// Flipping this to `false` restores the full onboarding → auth →
// username → tabs ladder below untouched.
const RUN_ONBOARDING_ONLY = true;

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
    isOnboardingCompleted()
      .then((done) => {
        if (!cancelled) setOnboardingDone(done);
      })
      .catch((e) => {
        // Never leave this null on a read error — that would pin the app
        // on the splash spinner. Fall back to "not done" so the (legally
        // required) onboarding/consent flow is shown rather than skipped.
        console.warn('isOnboardingCompleted failed', e);
        if (!cancelled) setOnboardingDone(false);
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
    getUsername(user.id)
      .then((u) => {
        if (!cancelled) setHasUsername(!!u && u.trim().length > 0);
      })
      .catch((e) => {
        // Don't strand on the spinner if the handle probe fails; treat as
        // "no username" → the setup screen (which is skippable anyway).
        console.warn('getUsername failed', e);
        if (!cancelled) setHasUsername(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Onboarding-only gate: run the first-launch onboarding flow, then land
  // on the home tabs (orb). Auth + username are skipped (see header note).
  // Placed after every hook (Rules of Hooks). We wait for the onboarding
  // read to resolve so there's no flash of the wrong destination.
  if (RUN_ONBOARDING_ONLY) {
    if (onboardingDone === null) {
      return (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.blue} size="large" />
        </View>
      );
    }
    if (!onboardingDone) {
      return <Redirect href="/(onboarding)" />;
    }
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
  if (DEV_SKIP_AUTH || DEV_SEED_DATA) {
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
