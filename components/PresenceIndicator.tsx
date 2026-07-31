import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  PRESENCE_MIN_THRESHOLD,
  PRESENCE_POLL_INTERVAL_MS,
} from '@/constants/presence';
import { t } from '@/lib/i18n';

/**
 * Faz 7 — live "you're not alone" indicator.
 *
 * Behaviour:
 *   1. On mount + on every AppState 'active' transition: fire an
 *      immediate `active-presence` fetch AND (re)start a polling
 *      interval every PRESENCE_POLL_INTERVAL_MS.
 *   2. On AppState 'background' (or 'inactive'): stop the interval.
 *      No fetch until the app is foregrounded again.
 *   3. On unmount: clear everything.
 *
 * Failure modes (Faz 7 karar #6, taken as-is from the brief):
 *   - First fetch fails    → render nothing at all
 *   - Later fetch fails    → keep the last known count
 *   - Unexpected shape     → render nothing
 *
 * Copy threshold:
 *   count >= PRESENCE_MIN_THRESHOLD → "You and {{count}} others are
 *                                     resisting right now"
 *   0 < count < threshold          → "You're among those resisting"
 *   count === 0 (nobody else)      → render nothing (would read as
 *                                     "you're alone", the exact
 *                                     opposite of the copy's goal)
 *
 * The Edge Function already excludes the caller from the count, so
 * this component just does display math.
 */

type Fetched = { kind: 'ok'; count: number } | { kind: 'error' };

/** Stop polling after this many consecutive failures. Without it, a
 *  signed-out or offline device retried every 10s forever. */
const MAX_CONSECUTIVE_FAILURES = 5;

export function PresenceIndicator() {
  const { user } = useAuth();
  const [state, setState] = useState<Fetched | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards against a fetch resolving after the component unmounted.
  const mountedRef = useRef(true);
  // Backoff bookkeeping. `active-presence` requires a JWT, and the auth
  // gate is currently disabled app-wide, so a signed-out user reaching
  // the craving screen used to generate a 401 every 10 seconds with no
  // end condition. Read through refs — the interval closes over its
  // handler once.
  const failuresRef = useRef(0);
  const lastFetchAtRef = useRef(0);

  const onFailure = () => {
    failuresRef.current += 1;
    setState((prev) => (prev?.kind === 'ok' ? prev : { kind: 'error' }));
    if (failuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
      // Give up rather than hammer a permanently failing endpoint.
      stopPolling();
      return;
    }
    // Exponential backoff: 10s → 20s → 40s …, capped at 5 minutes.
    restartPolling(
      Math.min(PRESENCE_POLL_INTERVAL_MS * 2 ** failuresRef.current, 5 * 60_000)
    );
  };

  const doFetch = async () => {
    // Throttle: the AppState listener fires an immediate refresh on
    // every foreground, so app-switcher flapping used to mean one
    // invoke per flap on top of the interval.
    const now = Date.now();
    if (now - lastFetchAtRef.current < PRESENCE_POLL_INTERVAL_MS) return;
    lastFetchAtRef.current = now;
    try {
      const { data, error } = await supabase.functions.invoke(
        'active-presence',
        { body: {} }
      );
      if (!mountedRef.current) return;
      if (
        error ||
        !data ||
        typeof (data as { count?: unknown }).count !== 'number'
      ) {
        // Preserve the last known count if we already had one —
        // only degrade to hidden on a fresh error.
        onFailure();
        return;
      }
      failuresRef.current = 0;
      setState({ kind: 'ok', count: (data as { count: number }).count });
    } catch {
      if (!mountedRef.current) return;
      onFailure();
    }
  };

  const startPolling = (intervalMs = PRESENCE_POLL_INTERVAL_MS) => {
    if (intervalRef.current) return; // already running
    intervalRef.current = setInterval(doFetch, intervalMs);
  };
  const restartPolling = (intervalMs: number) => {
    stopPolling();
    intervalRef.current = setInterval(doFetch, intervalMs);
  };
  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    // `active-presence` is JWT-only. The app-wide auth gate is
    // currently disabled (app/(tabs)/_layout.tsx AUTH_GATE_DISABLED),
    // so without this check a signed-out user on the craving screen
    // polls for 401s indefinitely. Never start the timer at all.
    if (!user) return;

    mountedRef.current = true;
    failuresRef.current = 0;
    lastFetchAtRef.current = 0;
    // First fetch happens immediately so the indicator can appear
    // as soon as the network responds — no 10-second cold wait.
    doFetch();
    startPolling();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Foreground → immediate refresh + restart the interval so
        // the next tick lines up from now, not from an old anchor.
        // doFetch() self-throttles, so flapping can't amplify this.
        doFetch();
        startPolling();
      } else {
        // 'background' / 'inactive' — stop hitting the network.
        // Battery-friendly and closes any pending fetches
        // implicitly (they'll resolve into the mounted-ref guard
        // and no-op).
        stopPolling();
      }
    });

    return () => {
      mountedRef.current = false;
      stopPolling();
      sub.remove();
    };
    // Keyed on the user ID, not the user object: supabase-js hands us a
    // fresh session object on every token refresh, and depending on the
    // object would tear down and restart the poller every hour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Render decision tree.
  if (!state || state.kind === 'error') return null;
  if (state.count <= 0) return null;

  const label =
    state.count >= PRESENCE_MIN_THRESHOLD
      ? t('presence.you_and_others', { count: state.count })
      : t('presence.among_resisting');

  return <Text style={styles.text}>{label}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: '#7BA8C8',
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
    opacity: 0.85,
  },
});
