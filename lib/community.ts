import { supabase } from './supabase';

/**
 * Order in which preset addictions appear in the community filter row.
 * Custom user addictions are intentionally excluded.
 */
export const COMMUNITY_FILTER_ORDER = [
  'nicotine',
  'alcohol',
  'caffeine',
  'feed',
  'substance',
  'binge',
  'urge',
  'bet',
  'impulse',
] as const;

export type ForumPost = {
  id: string;
  user_id: string;
  username: string | null;
  addiction_id: string;
  content: string;
  like_count: number;
  liked_by_me: boolean;
  created_at: string;
};

type FetchOptions = {
  addictionId?: string;
  search?: string;
  /** ISO timestamp — return rows older than this (cursor pagination). */
  before?: string;
  limit?: number;
  /** Current viewer; if set we hydrate `liked_by_me` for each row. */
  userId?: string;
};

export async function fetchPosts(opts: FetchOptions = {}): Promise<ForumPost[]> {
  // Pin the FK explicitly — `profiles` has multiple relationship paths to
  // forum_posts (auth.users hop + direct user_id FK) and Supabase refuses to
  // auto-pick. The constraint name is what the migration created.
  let query = supabase
    .from('forum_posts')
    .select(
      'id, user_id, addiction_id, content, like_count, created_at, profiles!forum_posts_user_id_fkey(username)'
    )
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 30);

  if (opts.addictionId) query = query.eq('addiction_id', opts.addictionId);
  if (opts.search && opts.search.trim().length > 0) {
    // Escape Postgres ILIKE wildcards entered by the user.
    const safe = opts.search.replace(/[%_]/g, (c) => `\\${c}`);
    query = query.ilike('content', `%${safe}%`);
  }
  if (opts.before) query = query.lt('created_at', opts.before);

  const { data, error } = await query;
  if (error) throw error;

  // Resolve which posts the current user has liked.
  let likedSet = new Set<string>();
  if (opts.userId && data && data.length > 0) {
    const ids = data.map((d) => d.id);
    const { data: likes } = await supabase
      .from('forum_likes')
      .select('post_id')
      .eq('user_id', opts.userId)
      .in('post_id', ids);
    likedSet = new Set((likes ?? []).map((l) => l.post_id));
  }

  return (data ?? []).map((row) => {
    const profileObj = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      user_id: row.user_id,
      username: (profileObj as { username?: string | null } | null)?.username ?? null,
      addiction_id: row.addiction_id,
      content: row.content,
      like_count: row.like_count,
      liked_by_me: likedSet.has(row.id),
      created_at: row.created_at,
    };
  });
}

export async function createPost(input: {
  userId: string;
  addictionId: string;
  content: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('forum_posts')
    .insert({
      user_id: input.userId,
      addiction_id: input.addictionId,
      content: input.content,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPost(
  postId: string,
  userId?: string
): Promise<ForumPost | null> {
  const { data, error } = await supabase
    .from('forum_posts')
    .select(
      'id, user_id, addiction_id, content, like_count, created_at, profiles!forum_posts_user_id_fkey(username)'
    )
    .eq('id', postId)
    .single();
  if (error || !data) return null;

  let likedByMe = false;
  if (userId) {
    const { data: like } = await supabase
      .from('forum_likes')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();
    likedByMe = !!like;
  }

  const profileObj = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
  return {
    id: data.id,
    user_id: data.user_id,
    username: (profileObj as { username?: string | null } | null)?.username ?? null,
    addiction_id: data.addiction_id,
    content: data.content,
    like_count: data.like_count,
    liked_by_me: likedByMe,
    created_at: data.created_at,
  };
}

export async function updatePost(input: {
  postId: string;
  userId: string;
  content: string;
}): Promise<void> {
  const { error } = await supabase
    .from('forum_posts')
    .update({ content: input.content })
    .eq('id', input.postId)
    .eq('user_id', input.userId);
  if (error) throw error;
}

export async function deletePost(input: {
  postId: string;
  userId: string;
}): Promise<void> {
  // NOTE: assumes the forum_likes(post_id) FK has ON DELETE CASCADE so
  // dependent like rows go with the post. CLAUDE.md doesn't pin that
  // down — if a delete starts failing with FK violations, the migration
  // is:
  //   ALTER TABLE forum_likes
  //     DROP CONSTRAINT forum_likes_post_id_fkey,
  //     ADD CONSTRAINT forum_likes_post_id_fkey
  //       FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE;
  const { error } = await supabase
    .from('forum_posts')
    .delete()
    .eq('id', input.postId)
    .eq('user_id', input.userId);
  if (error) throw error;
}

export async function toggleLike(
  postId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<void> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('forum_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('forum_likes')
      .insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export async function getUsername(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();
  return data?.username ?? null;
}

export async function setUsername(userId: string, username: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * Subscribe to forum_posts INSERT events. The callback receives only the
 * post id; the caller is expected to hydrate the full row (with username
 * and `liked_by_me`) via fetchPost. Returns the unsubscribe function.
 *
 * We deliberately don't filter the channel server-side by addiction_id —
 * the call sites care about a moving filter (the feed pills) and
 * Supabase channel filters can't be re-bound. Filtering happens in JS.
 */
export function subscribeToNewPosts(onInsert: (postId: string) => void): () => void {
  const channel = supabase
    .channel('forum_posts:inserts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'forum_posts' },
      (payload) => {
        const row = payload.new as { id?: string };
        if (row?.id) onInsert(row.id);
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Format an ISO timestamp as a Turkish relative-time string. */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return 'şimdi';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}sa önce`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'dün';
  if (day < 7) return `${day}g önce`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}h önce`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}ay önce`;
  return `${Math.floor(day / 365)}y önce`;
}
