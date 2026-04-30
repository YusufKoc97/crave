import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { isOnboardingCompleted } from '@/lib/onboarding';
import { colors } from '@/constants/theme';

const DEV_MODE = true;

export default function Index() {
  const { session } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    isOnboardingCompleted().then((done) => {
      if (!cancelled) setOnboardingDone(done);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (DEV_MODE) {
    return <Redirect href="/(tabs)" />;
  }

  if (!session) {
    return <Redirect href="/(tabs)" />;
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
