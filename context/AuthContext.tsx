import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
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

  const signOut = async () => {
    // Surface the failure. supabase.auth.signOut() returns `{ error }`
    // and never throws — a network-dropped sign-out returns early
    // BEFORE clearing the local token, so silently swallowing it means
    // the UI navigates away while the user is still signed in and gets
    // rehydrated into the same account on next launch. Callers must
    // catch this and NOT navigate on failure.
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut,
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
