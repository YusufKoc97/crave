import { supabase } from './supabase';

/**
 * Read a user's public display handle. Kept alive after the community
 * feed was removed because Modül 4 (Anonim Kıyaslama) and future profile
 * touches still need a "you" signature that isn't the raw email. Null =
 * user hasn't chosen one yet.
 */
export async function getUsername(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();
  // A genuine fetch failure is otherwise indistinguishable from "no
  // handle yet" — log it so a broken probe isn't read as a fresh user.
  if (error) console.warn('getUsername failed', error);
  return data?.username ?? null;
}

/**
 * Save the user's chosen handle. DB UNIQUE constraint on profiles.username
 * is the source of truth for collision detection — callers should catch
 * PostgREST code 23505 (unique_violation) and translate to a friendly
 * message.
 */
export async function setUsername(
  userId: string,
  username: string
): Promise<void> {
  // Trim before the write: migration 009 puts a format CHECK on this
  // column (3-24 chars, [a-zA-Z0-9_-] only), so an untrimmed handle with
  // a stray leading/trailing space would 400 at the DB instead of
  // quietly storing a handle nobody can type. The picker already strips
  // illegal characters (app/setup-username.tsx:83) — whitespace is the
  // one thing it lets through.
  const { error } = await supabase
    .from('profiles')
    .update({ username: username.trim() })
    .eq('id', userId);
  if (error) throw error;
}
