import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://scdedlhpbcddoqphauxo.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder';

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
      };
      addictions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          emoji: string;
          max_duration_minutes: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          emoji: string;
          max_duration_minutes: number;
        };
        Update: {
          name?: string;
          emoji?: string;
          max_duration_minutes?: number;
        };
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
        Update: never;
      };
    };
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
