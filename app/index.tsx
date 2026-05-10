import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { isOnboardingCompleted } from '@/lib/onboarding';
import { getUsername } from '@/lib/community';
import { colors } from '@/constants/theme';

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

  if (authLoading || onboardingDone === null) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
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
