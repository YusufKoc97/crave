import { supabase } from './supabase';
import type { Addiction } from '@/constants/addictions';

/**
 * DB <-> client mappers + CRUD wrappers for the `addictions` and
 * `profiles.hidden_defaults` tables. AddictionsContext drives all of its
 * persistence through here so the storage shape lives in one place.
 *
 * NOTE — additive migration required before this hits production:
 *
 *   ALTER TABLE addictions
 *     ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#10B981',
 *     ADD COLUMN IF NOT EXISTS sensitivity int NOT NULL DEFAULT 5;
 *   ALTER TABLE addictions
 *     ALTER COLUMN max_duration_minutes DROP NOT NULL,
 *     ALTER COLUMN max_duration_minutes SET DEFAULT 9;
 *   ALTER TABLE profiles
 *     ADD COLUMN IF NOT EXISTS hidden_defaults text[] NOT NULL DEFAULT '{}';
 */

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rowToAddiction(row: {
  id: string;
  name: string;
  emoji: string;
  color: string;
  sensitivity: number;
}): Addiction {
  return {
    // Custom rows on the server use the bare uuid; prefix client-side so
    // the existing isCustom check (id.startsWith('custom-')) keeps
    // working without changes downstream.
    id: `custom-${row.id}`,
    name: row.name,
    emoji: row.emoji,
    iconLib: 'mci',
    iconName: 'star-circle',
    color: row.color,
    bgGlow: hexToRgba(row.color, 0.16),
    sensitivity: Math.max(1, Math.min(10, Math.round(row.sensitivity))),
  };
}

/** Strip the 'custom-' prefix to recover the row's uuid. */
function rawId(prefixedId: string): string {
  return prefixedId.replace(/^custom-/, '');
}

export async function fetchCustomAddictions(userId: string): Promise<Addiction[]> {
  const { data, error } = await supabase
    .from('addictions')
    .select('id, name, emoji, color, sensitivity')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToAddiction);
}

export async function fetchHiddenDefaults(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('hidden_defaults')
    .eq('id', userId)
    .single();
  if (error) throw error;
  const arr = (data?.hidden_defaults ?? []) as string[];
  return new Set(arr);
}

export async function createAddiction(input: {
  userId: string;
  name: string;
  emoji: string;
  color: string;
  sensitivity: number;
}): Promise<Addiction> {
  const { data, error } = await supabase
    .from('addictions')
    .insert({
      user_id: input.userId,
      name: input.name,
      emoji: input.emoji,
      color: input.color,
      sensitivity: input.sensitivity,
      // Legacy column — derive a reasonable value but don't expose it.
      max_duration_minutes: Math.max(5, input.sensitivity * 1.5),
    })
    .select('id, name, emoji, color, sensitivity')
    .single();
  if (error) throw error;
  return rowToAddiction(data);
}

export async function updateAddictionRow(
  prefixedId: string,
  patch: { name?: string; emoji?: string; color?: string; sensitivity?: number }
): Promise<void> {
  const { error } = await supabase
    .from('addictions')
    .update(patch)
    .eq('id', rawId(prefixedId));
  if (error) throw error;
}

export async function deleteAddictionRow(prefixedId: string): Promise<void> {
  const { error } = await supabase
    .from('addictions')
    .delete()
    .eq('id', rawId(prefixedId));
  if (error) throw error;
}

export async function persistHiddenDefaults(
  userId: string,
  hidden: Set<string>
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ hidden_defaults: Array.from(hidden) })
    .eq('id', userId);
  if (error) throw error;
}
