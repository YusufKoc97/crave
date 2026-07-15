import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text } from 'react-native';
import { supabase } from '@/lib/supabase';
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

export function PresenceIndicator() {
  const [state, setState] = useState<Fetched | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards against a fetch resolving after the component unmounted.
  const mountedRef = useRef(true);

  const doFetch = async () => {
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
        setState((prev) => (prev?.kind === 'ok' ? prev : { kind: 'error' }));
        return;
      }
      setState({ kind: 'ok', count: (data as { count: number }).count });
    } catch {
      if (!mountedRef.current) return;
      setState((prev) => (prev?.kind === 'ok' ? prev : { kind: 'error' }));
    }
  };

  const startPolling = () => {
    if (intervalRef.current) return; // already running
    intervalRef.current = setInterval(doFetch, PRESENCE_POLL_INTERVAL_MS);
  };
  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    // First fetch happens immediately so the indicator can appear
    // as soon as the network responds — no 10-second cold wait.
    doFetch();
    startPolling();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Foreground → immediate refresh + restart the interval so
        // the next tick lines up from now, not from an old anchor.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
