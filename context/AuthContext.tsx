import {
  createContext,
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
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
