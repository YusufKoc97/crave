import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { isOnboardingCompleted } from '@/lib/onboarding';
import { getUsername } from '@/lib/profile';
import { DEV_SKIP_AUTH } from '@/lib/devBypass';
import { colors } from '@/constants/theme';

/**
 * How long to wait for the automatic anonymous sign-in before letting the
 * user in anyway. Offline on first launch, that sign-in can't complete —
 * the app still works locally, and cravings resolved in the meantime are
 * kept in the pending-finish blob and sent once the session exists
 * (AuthContext retries on every foreground).
 */
const ANON_SESSION_GRACE_MS = 4000;

/**
 * Root entry point. Decides where to send the user:
 *   1. Onboarding (age gate + consent) — always first: consent is the
 *      legal prerequisite to processing health-category data.
 *   2. A session. Anonymous-first: AuthContext signs in anonymously on its
 *      own, so a new user never meets a sign-up wall. Only someone who
 *      deliberately signed OUT is sent to the sign-in screen.
 *   3. A community handle — for real (email) accounts only; an anonymous
 *      account has nothing to name yet.
 */
export default function Index() {
  const {
    session,
    user,
    loading: authLoading,
    isAnonymous,
    anonOptOut,
  } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [hasUsername, setHasUsername] = useState<boolean | null>(null);
  const [graceOver, setGraceOver] = useState(false);

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

  // Start the offline grace clock only once we are actually waiting on
  // the anonymous session (onboarding done, no session, not opted out).
  const waitingForAnon =
    !authLoading && onboardingDone === true && !session && anonOptOut === false;
  useEffect(() => {
    if (!waitingForAnon) return;
    const id = setTimeout(() => setGraceOver(true), ANON_SESSION_GRACE_MS);
    return () => clearTimeout(id);
  }, [waitingForAnon]);

  useEffect(() => {
    if (!user || isAnonymous) {
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
  }, [user, isAnonymous]);

  if (authLoading || onboardingDone === null || anonOptOut === null) {
    return <Loader />;
  }

  if (!onboardingDone) {
    return <Redirect href="/(onboarding)" />;
  }

  // Dev bypass — skip the auth rungs and drop straight on the orb, so the
  // screens can be inspected while Supabase is paused/unreachable.
  // Onboarding still runs (it is only shown once anyway).
  if (DEV_SKIP_AUTH) {
    return <Redirect href="/(tabs)" />;
  }

  if (!session) {
    if (anonOptOut) return <Redirect href="/(auth)/sign-in" />;
    // The anonymous session is on its way; don't block an offline user.
    return graceOver ? <Redirect href="/(tabs)" /> : <Loader />;
  }

  if (isAnonymous) {
    return <Redirect href="/(tabs)" />;
  }

  // Wait for the username probe to resolve before deciding (tabs vs setup).
  if (hasUsername === null) {
    return <Loader />;
  }

  if (!hasUsername) {
    return <Redirect href="/setup-username" />;
  }

  return <Redirect href="/(tabs)" />;
}

function Loader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.blue} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
