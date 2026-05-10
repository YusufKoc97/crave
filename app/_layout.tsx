import { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AddictionsProvider, useAddictions } from '@/context/AddictionsContext';
import { SessionsProvider } from '@/context/SessionsContext';
import { colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import {
  getActiveSessionId,
  getActiveSnapshot,
  clearActiveSessionId,
} from '@/lib/activeSession';
import { maxMinutesFor } from '@/constants/addictions';

/**
 * On startup, look for a persisted active-craving id. If we find one, fetch
 * the row from Supabase and bounce the user straight to the active-session
 * screen with the original started_at so the wall-clock timer resumes from
 * the correct elapsed value (including time the app was closed).
 */
function ActiveSessionRestorer() {
  const { user, loading } = useAuth();
  const { addictions } = useAddictions();
  const ranOnce = useRef(false);

  useEffect(() => {
    if (loading || ranOnce.current) return;
    ranOnce.current = true;
    (async () => {
      // Authenticated path: server is the source of truth.
      if (user) {
        const id = await getActiveSessionId();
        if (!id) return;
        const { data, error } = await supabase
          .from('craving_sessions')
          .select('id, addiction_id, status, started_at, sensitivity')
          .eq('id', id)
          .single();
        if (error || !data || data.status !== 'active') {
          await clearActiveSessionId();
          return;
        }
        const a = addictions.find((x) => x.id === data.addiction_id);
        if (!a) {
          // Addiction was deleted while we were away — abandon the session.
          await supabase
            .from('craving_sessions')
            .update({ status: 'abandoned', ended_at: new Date().toISOString() })
            .eq('id', id);
          await clearActiveSessionId();
          return;
        }
        router.replace({
          pathname: '/active-session',
          params: {
            id: a.id,
            name: a.name,
            emoji: a.emoji,
            color: a.color,
            maxMinutes: String(maxMinutesFor(a.sensitivity)),
            sensitivity: String(a.sensitivity),
            resumeId: data.id,
            resumeStartedAt: data.started_at,
          },
        });
        return;
      }

      // No auth (DEV_MODE): fall back to the local snapshot.
      const snap = await getActiveSnapshot();
      if (!snap) return;
      const a = addictions.find((x) => x.id === snap.addictionId);
      if (!a) {
        await clearActiveSessionId();
        return;
      }
      router.replace({
        pathname: '/active-session',
        params: {
          id: a.id,
          name: a.name,
          emoji: a.emoji,
          color: a.color,
          maxMinutes: String(maxMinutesFor(a.sensitivity)),
          sensitivity: String(a.sensitivity),
          ...(snap.sessionId ? { resumeId: snap.sessionId } : {}),
          resumeStartedAt: new Date(snap.startedAt).toISOString(),
        },
      });
    })();
  }, [loading, user, addictions]);

  return null;
}

function RootStack() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  return (
    <>
      <ActiveSessionRestorer />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="setup-username" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="active-session"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="add-addiction"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="community-compose"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </>
  );
}

/**
 * On web, RN-Web inputs inherit the browser default focus outline, which is a
 * platform-tinted amber/orange on Chromium and clashes with our blue accent.
 * Inject a one-time stylesheet that removes the outline so each component's
 * own border-color (already wired into the design system) is the only focus
 * indicator. No-op on native.
 */
function useWebFocusOutlineFix() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'crave-focus-outline-fix';
    if (document.getElementById(id)) return;
    const styleEl = document.createElement('style');
    styleEl.id = id;
    styleEl.textContent = `
      input:focus, input:focus-visible,
      textarea:focus, textarea:focus-visible {
        outline: 2px solid ${colors.blue} !important;
        outline-offset: 2px;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(styleEl);
  }, []);
}

export default function RootLayout() {
  useWebFocusOutlineFix();
  return (
    <AuthProvider>
      <AddictionsProvider>
        <SessionsProvider>
          <StatusBar style="light" />
          <RootStack />
        </SessionsProvider>
      </AddictionsProvider>
    </AuthProvider>
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
