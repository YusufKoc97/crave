import { supabase } from './supabase';

/**
 * Read a user's public display handle. Kept alive after the community
 * feed was removed because Modül 4 (Anonim Kıyaslama) and future profile
 * touches still need a "you" signature that isn't the raw email. Null =
 * user hasn't chosen one yet.
 */
export async function getUsername(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();
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
  const { error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', userId);
  if (error) throw error;
}
