import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Anonymous-first auth. Nobody has to sign up to start: with no session,
 * the app signs in anonymously so every resisted craving is saved to a
 * real (anonymous) account from the first tap. The user can later attach
 * an email to keep it (Profile → Save your progress).
 *
 * The one exception is a user who deliberately SIGNED OUT of an account:
 * silently spinning up a fresh anonymous account would hide the sign-in
 * screen they expect. That choice is remembered under this key until they
 * sign in again or pick "Continue without an account".
 */
const ANON_OPT_OUT_KEY = 'crave.auth.anon_opt_out';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True for the auto-created account that has no email attached yet. */
  isAnonymous: boolean;
  /** The user signed out of an account; don't auto-create an anonymous
   *  one — show sign-in. Null until the stored choice has been read. */
  anonOptOut: boolean | null;
  /**
   * `optOut` (default true) records that the user chose to sign out, so no
   * anonymous account is created behind their back. Account deletion
   * passes false: the next person on the device starts fresh.
   */
  signOut: (opts?: { optOut?: boolean }) => Promise<void>;
  /** Drop the sign-out choice and start (or resume) anonymously. */
  continueAnonymously: () => Promise<void>;
  /** Hold anonymous sign-in while a sign-out + local purge runs, so the
   *  purge can't sweep a brand-new session's keys. */
  pauseAnonymous: (paused: boolean) => void;
  /**
   * Push a freshly-acquired session straight into React state without
   * waiting for the next `onAuthStateChange` tick. Auth screens call this
   * right after a successful signIn/signUp so the router can navigate to
   * a session-gated route on the same render — otherwise the gate sees
   * `session: null` and bounces back, requiring a manual reload.
   */
  applySession: (session: Session | null) => void;
  /**
   * Server-truth premium entitlement (`profiles.is_premium`). The
   * client UI gate `useIsPremium()` (lib/premium.ts) reads this. It is
   * fetched here — the topmost provider — so every consumer, including
   * AddictionsProvider (which sits ABOVE SessionsProvider and so can't
   * read entitlement from there), sees the same value.
   *
   * Defaults false; flips true once the profile row is read. Until the
   * RevenueCat webhook is wired, the column is set out-of-band (manually
   * for testing, later by the webhook) — the client just reflects it.
   */
  isPremium: boolean;
  /** Re-read `is_premium` — call after a purchase/restore completes. */
  refreshPremium: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [anonOptOut, setAnonOptOut] = useState<boolean | null>(null);
  // Bumped on app foreground so a failed (offline) anonymous sign-in is
  // retried when the user comes back, rather than never.
  const [retryTick, setRetryTick] = useState(0);
  const anonInFlight = useRef(false);
  const anonPaused = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(ANON_OPT_OUT_KEY)
      .then((v) => setAnonOptOut(v === '1'))
      .catch(() => setAnonOptOut(false));
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRetryTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  // No session, not opted out → sign in anonymously. Offline failures
  // just log; the foreground retry above tries again later, and any
  // craving resolved meanwhile waits in the pending-finish blob.
  useEffect(() => {
    if (loading || anonOptOut !== false || session) return;
    if (anonInFlight.current || anonPaused.current) return;
    anonInFlight.current = true;
    supabase.auth
      .signInAnonymously()
      .then(({ data, error }) => {
        if (error) {
          console.warn('anonymous sign-in failed', error.message);
          return;
        }
        if (data.session) setSession(data.session);
      })
      .catch((e) => console.warn('anonymous sign-in rejected', e))
      .finally(() => {
        anonInFlight.current = false;
      });
  }, [loading, anonOptOut, session, retryTick]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      })
      .catch((e) => {
        // Without this, a rejected getSession (e.g. cold launch with no
        // network) would leave `loading` true forever → app stuck on the
        // splash spinner. Fall through to the unauthenticated flow.
        console.warn('getSession failed', e);
        setSession(null);
        setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        // Identity guard. supabase-js emits INITIAL_SESSION, SIGNED_IN
        // and an hourly TOKEN_REFRESHED, each carrying a BRAND-NEW
        // session object even when nothing meaningful changed. Handing
        // that object to React re-ran every `user`-keyed effect in the
        // app — eight REST calls per event, forever, plus a duplicate
        // technique_uses row if a refresh landed mid-technique.
        // Keep the previous reference when the value is equivalent.
        setSession((prev) =>
          prev?.access_token === newSession?.access_token &&
          prev?.user?.id === newSession?.user?.id
            ? prev
            : newSession
        );
        // Signing in to a real account ends an earlier sign-out choice.
        if (newSession?.user && !newSession.user.is_anonymous) {
          setAnonOptOut(false);
          AsyncStorage.removeItem(ANON_OPT_OUT_KEY).catch(() => undefined);
        }
      }
    );

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Entitlement follows the signed-in user. Re-reads whenever the
  // session identity changes; clears to false on sign-out.
  const refreshPremium = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) {
      setIsPremium(false);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', uid)
      .single();
    if (error) {
      // A transient read failure must NOT strip premium the user paid
      // for — keep the last known value and log. Server-side gates read
      // the column directly, so they stay correct regardless.
      console.warn('is_premium fetch failed', error);
      return;
    }
    setIsPremium(!!data?.is_premium);
  }, [session]);

  useEffect(() => {
    void refreshPremium();
  }, [refreshPremium]);

  const signOut = async (opts?: { optOut?: boolean }) => {
    const optOut = opts?.optOut ?? true;
    // Record the choice BEFORE the session flips to null, so the
    // anonymous sign-in effect never sees "no session, not opted out".
    if (optOut) {
      setAnonOptOut(true);
      await AsyncStorage.setItem(ANON_OPT_OUT_KEY, '1').catch(() => undefined);
    }
    // Surface the failure. supabase.auth.signOut() returns `{ error }`
    // and never throws — a network-dropped sign-out returns early
    // BEFORE clearing the local token, so silently swallowing it means
    // the UI navigates away while the user is still signed in and gets
    // rehydrated into the same account on next launch. Callers must
    // catch this and NOT navigate on failure.
    const { error } = await supabase.auth.signOut();
    if (error) {
      if (optOut) {
        setAnonOptOut(false);
        await AsyncStorage.removeItem(ANON_OPT_OUT_KEY).catch(() => undefined);
      }
      throw error;
    }
  };

  const continueAnonymously = useCallback(async () => {
    await AsyncStorage.removeItem(ANON_OPT_OUT_KEY).catch(() => undefined);
    setAnonOptOut(false);
  }, []);

  const pauseAnonymous = useCallback((paused: boolean) => {
    anonPaused.current = paused;
    // Re-run the sign-in effect once released.
    if (!paused) setRetryTick((n) => n + 1);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        isAnonymous: session?.user?.is_anonymous === true,
        anonOptOut,
        signOut,
        continueAnonymously,
        pauseAnonymous,
        applySession: setSession,
        isPremium,
        refreshPremium,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
