import { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AddictionsProvider, useAddictions } from '@/context/AddictionsContext';
import { SessionsProvider } from '@/context/SessionsContext';
import { AddictionScoresProvider } from '@/context/AddictionScoresContext';
import { ToastProvider } from '@/context/ToastContext';
import { queryClient } from '@/lib/queryClient';
import { colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import {
  getActiveSnapshot,
  clearActiveSessionId,
  getPendingFinish,
  clearPendingFinish,
} from '@/lib/activeSession';
import { maxMinutesFor } from '@/constants/addictions';

/**
 * On startup, look for local pending state and bounce the user
 * straight to the active-session screen with the original startedAt
 * so the wall-clock timer resumes from the correct elapsed value
 * (including time the app was closed).
 *
 * Faz 5 REVERSAL: there is no `active` DB row to check anymore —
 * the AsyncStorage snapshot is the sole source of truth for
 * "you have an in-flight craving". A pending-finish blob (an
 * outcome that was staged for resolve but didn't complete) gets
 * replayed BEFORE the snapshot check so a stuck resolve doesn't
 * loop the user back into the timer forever.
 */
function ActiveSessionRestorer() {
  const { user, loading } = useAuth();
  const { addictions } = useAddictions();
  const ranOnce = useRef(false);

  useEffect(() => {
    if (loading || ranOnce.current) return;
    ranOnce.current = true;
    (async () => {
      // Replay pending finish first — the Edge Function keys idempotency
      // off the client-generated session_id (PK conflict returns the
      // previously-computed response), so a double-invoke is safe.
      if (user) {
        const pending = await getPendingFinish();
        if (pending) {
          const { error } = await supabase.functions.invoke('resolve-craving', {
            body: {
              session_id: pending.sessionId,
              addiction_id: pending.payload.addictionId,
              started_at: pending.payload.startedAt,
              ended_at: pending.payload.endedAt,
              sensitivity: pending.payload.sensitivity,
              outcome: pending.payload.outcome,
              intensity: pending.payload.intensity,
              trigger_ids: pending.payload.triggerIds,
            },
          });
          if (!error) {
            await clearPendingFinish();
            await clearActiveSessionId();
          }
          // Still failing (offline) — leave both blobs on disk for
          // the next launch. Don't try to also restore the timer
          // for the same session; the resolve is what the user
          // intended.
        }
      }

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
          maxMinutes: String(maxMinutesFor(snap.sensitivity)),
          sensitivity: String(snap.sensitivity),
          resumeSessionId: snap.sessionId,
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
    <GestureHandlerRootView style={styles.rootFlex}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AddictionsProvider>
            <SessionsProvider>
              <AddictionScoresProvider>
                <ToastProvider>
                  <StatusBar style="light" />
                  <RootStack />
                </ToastProvider>
              </AddictionScoresProvider>
            </SessionsProvider>
          </AddictionsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rootFlex: {
    flex: 1,
  },
});
