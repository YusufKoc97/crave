import { supabase } from './supabase';

/**
 * `user_addictions` CRUD wrappers. AddictionsContext talks to the
 * database only through this module so the storage shape lives in one
 * place. The addiction catalog itself is hardcoded in
 * `constants/addictions.ts`; this file only tracks which catalog rows
 * a given user is currently following.
 *
 * NOTE — additive migration required before this hits production:
 *
 *   CREATE TABLE user_addictions (
 *     user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 *     addiction_id text NOT NULL
 *       CHECK (addiction_id IN (
 *         'nicotine','alcohol','caffeine','vape','gambling',
 *         'junk_food','shopping','pmo','doomscroll','gaming'
 *       )),
 *     added_at timestamptz NOT NULL DEFAULT now(),
 *     is_active boolean NOT NULL DEFAULT true,
 *     PRIMARY KEY (user_id, addiction_id)
 *   );
 *   ALTER TABLE user_addictions ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "owner_all" ON user_addictions FOR ALL TO authenticated
 *     USING (user_id = auth.uid())
 *     WITH CHECK (user_id = auth.uid());
 */

export type UserAddictionRow = {
  addictionId: string;
  isActive: boolean;
  addedAt: string;
};

export async function fetchUserAddictions(
  userId: string
): Promise<UserAddictionRow[]> {
  const { data, error } = await supabase
    .from('user_addictions')
    .select('addiction_id, is_active, added_at')
    .eq('user_id', userId)
    .order('added_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    addictionId: row.addiction_id,
    isActive: row.is_active,
    addedAt: row.added_at,
  }));
}

/**
 * Add a catalog addiction to the user's list. If the row already
 * exists (soft-deleted previously), flip it back to `is_active=true`
 * so the addiction's craving history seamlessly resumes.
 */
export async function activateUserAddiction(
  userId: string,
  addictionId: string
): Promise<void> {
  // upsert with onConflict — insert if new, update is_active if
  // returning after a soft-delete. `added_at` is left alone on update
  // so the first-added timestamp is preserved for lifetime stats.
  const { error } = await supabase.from('user_addictions').upsert(
    {
      user_id: userId,
      addiction_id: addictionId,
      is_active: true,
    },
    { onConflict: 'user_id,addiction_id' }
  );
  if (error) throw error;
}

/** Soft-delete: flip `is_active=false`. Data is preserved. */
export async function deactivateUserAddiction(
  userId: string,
  addictionId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_addictions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('addiction_id', addictionId);
  if (error) throw error;
}
