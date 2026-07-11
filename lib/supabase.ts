import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  'https://scdedlhpbcddoqphauxo.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder';

/**
 * Hand-written DB schema. The shape that postgrest-js v2 wants for full
 * inference is:
 *
 *   Database.public.Tables.<name> = { Row, Insert, Update, Relationships }
 *   Database.public                = { Tables, Views, Functions }
 *
 * Missing any of those slots collapses the inferred row types to `never`,
 * which is why the codebase used to be peppered with TS2769 / TS2339 noise.
 *
 * Insert-only tables (momentum_log) keep an empty `Update` object —
 * postgrest-js requires the slot, but the table is RLS-locked against
 * UPDATE on the server.
 *
 * Relationships are empty for all tables here — we don't do any embed
 * queries after the Faz 1 cleanup removed the community feed.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          onboarding_completed: boolean;
          momentum: number;
          streak: number;
          // Default addiction ids the user has removed from their orb
          // (e.g. ['nicotine']). Stored as text[] so RLS / writes are
          // straightforward; client always replaces the whole array.
          hidden_defaults: string[];
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          onboarding_completed?: boolean;
          momentum?: number;
          streak?: number;
          hidden_defaults?: string[];
        };
        Update: {
          username?: string | null;
          onboarding_completed?: boolean;
          momentum?: number;
          streak?: number;
          hidden_defaults?: string[];
        };
        Relationships: [];
      };
      addictions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          emoji: string;
          // LEGACY: kept for the original SQL migration that NOT-NULL'd
          // this column. New code reads `sensitivity` and derives the
          // ceiling via maxMinutesFor() — pass any number when inserting.
          max_duration_minutes: number;
          color: string;
          sensitivity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          emoji: string;
          max_duration_minutes?: number;
          color: string;
          sensitivity: number;
        };
        Update: {
          name?: string;
          emoji?: string;
          max_duration_minutes?: number;
          color?: string;
          sensitivity?: number;
        };
        Relationships: [];
      };
      craving_sessions: {
        Row: {
          id: string;
          user_id: string;
          addiction_id: string;
          status: 'active' | 'completed' | 'abandoned';
          outcome: 'resisted' | 'gave_in' | null;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
          points_earned: number;
          sensitivity: number;
          completed_cycles: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          addiction_id: string;
          status?: 'active' | 'completed' | 'abandoned';
          outcome?: 'resisted' | 'gave_in' | null;
          started_at: string;
          ended_at?: string | null;
          duration_seconds?: number | null;
          points_earned?: number;
          sensitivity?: number;
          completed_cycles?: number;
        };
        Update: {
          status?: 'active' | 'completed' | 'abandoned';
          outcome?: 'resisted' | 'gave_in' | null;
          ended_at?: string | null;
          duration_seconds?: number | null;
          points_earned?: number;
          completed_cycles?: number;
        };
        Relationships: [];
      };
      momentum_log: {
        Row: {
          id: string;
          user_id: string;
          value: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          value: number;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
