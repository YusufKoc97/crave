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
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          onboarding_completed?: boolean;
          momentum?: number;
          streak?: number;
        };
        Update: {
          username?: string | null;
          onboarding_completed?: boolean;
          momentum?: number;
          streak?: number;
        };
        Relationships: [];
      };
      user_addictions: {
        // Faz 2 tracking table. Users pick from the fixed catalog and
        // toggle rows here on/off via `is_active`. Soft-delete only —
        // a removed addiction just goes `is_active=false`, its
        // craving_sessions history stays intact so re-adding resumes
        // exactly where it left off.
        Row: {
          user_id: string;
          addiction_id: string;
          added_at: string;
          is_active: boolean;
        };
        Insert: {
          user_id: string;
          addiction_id: string;
          added_at?: string;
          is_active?: boolean;
        };
        Update: {
          is_active?: boolean;
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
