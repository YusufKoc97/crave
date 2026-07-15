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
          // Faz 3 enum rename: 'completed' → 'resolved'.
          status: 'active' | 'resolved' | 'abandoned';
          // Faz 3 enum rename: 'gave_in' → 'failed'.
          outcome: 'resisted' | 'failed' | null;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
          // Faz 3 rename: `points_earned` → `points_delta`. Signed:
          // positive on resist, negative on failure, 0 for active /
          // abandoned. Written exclusively by the resolve-craving
          // Edge Function — client never authors this column.
          points_delta: number;
          // Snapshot at session start. Kept even after Faz 3 makes
          // sensitivity a server-side lookup, because we don't want
          // catalog recalibrations to retroactively change history.
          sensitivity: number;
          // 1-5 rating captured post-resolve. Populated only when the
          // Faz 5 intensity question ships; nullable until then.
          intensity: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          addiction_id: string;
          status?: 'active' | 'resolved' | 'abandoned';
          outcome?: 'resisted' | 'failed' | null;
          started_at: string;
          ended_at?: string | null;
          duration_seconds?: number | null;
          points_delta?: number;
          sensitivity?: number;
          intensity?: number | null;
        };
        Update: {
          status?: 'active' | 'resolved' | 'abandoned';
          outcome?: 'resisted' | 'failed' | null;
          ended_at?: string | null;
          duration_seconds?: number | null;
          points_delta?: number;
          intensity?: number | null;
        };
        Relationships: [];
      };
      user_addiction_scores: {
        // Per-addiction score storage. Written exclusively by the
        // resolve-craving Edge Function; users have SELECT-only
        // policy so they can render their own scores but cannot
        // author them.
        Row: {
          user_id: string;
          addiction_id: string;
          score: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          addiction_id: string;
          score?: number;
        };
        Update: {
          score?: number;
        };
        Relationships: [];
      };
      user_unlocked_ranks: {
        // Faz 4 rank ladder. Once a threshold is crossed the row
        // stays forever — failure penalties never demote. Read-only
        // for authenticated users; the resolve-craving Edge Function
        // holds the write path via service role.
        Row: {
          user_id: string;
          addiction_id: string;
          rank_id: string;
          unlocked_at: string;
        };
        Insert: {
          user_id: string;
          addiction_id: string;
          rank_id: string;
          unlocked_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      rate_limits: {
        // Faz 3 log-only rate limit substrate: (user_id, endpoint,
        // hour_bucket) => count. Enforcement flag flips on in a later
        // phase; today the Edge Function just increments and warns.
        Row: {
          user_id: string;
          endpoint: string;
          hour_bucket: string;
          count: number;
        };
        Insert: {
          user_id: string;
          endpoint: string;
          hour_bucket: string;
          count?: number;
        };
        Update: {
          count?: number;
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
    Views: {
      user_total_score: {
        // SUM(score) over user_addiction_scores grouped by user.
        // Read-only; profile screen and future rank system both
        // consume this instead of summing sessions client-side.
        Row: {
          user_id: string | null;
          total_score: number | null;
        };
        Relationships: [];
      };
    };
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
