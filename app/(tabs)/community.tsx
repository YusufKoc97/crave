import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_ADDICTIONS } from '@/constants/addictions';
import {
  COMMUNITY_FILTER_ORDER,
  deletePost,
  fetchPosts,
  relativeTime,
  toggleLike,
  type ForumPost,
} from '@/lib/community';

const PRESETS_BY_ID = Object.fromEntries(
  DEFAULT_ADDICTIONS.map((a) => [a.id, a])
);

const PAGE_SIZE = 30;

export default function CommunityScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 300ms debounce on the search input.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await fetchPosts({
        addictionId: activeFilter ?? undefined,
        search: debouncedSearch || undefined,
        userId: user.id,
        limit: PAGE_SIZE,
      });
      setPosts(rows);
      // If the first page came back partial, there's no second page.
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      /* swallow — show empty state */
      setPosts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, debouncedSearch, user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadMore = useCallback(async () => {
    if (!user) return;
    if (loading || loadingMore || refreshing || !hasMore) return;
    if (posts.length === 0) return;
    const cursor = posts[posts.length - 1].created_at;
    setLoadingMore(true);
    try {
      const rows = await fetchPosts({
        addictionId: activeFilter ?? undefined,
        search: debouncedSearch || undefined,
        userId: user.id,
        before: cursor,
        limit: PAGE_SIZE,
      });
      // Defensive dedupe — a new top-of-feed post shouldn't slip into a
      // later page, but RLS + clock skew make it possible.
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const fresh = rows.filter((r) => !seen.has(r.id));
        return [...prev, ...fresh];
      });
      if (rows.length < PAGE_SIZE) setHasMore(false);
    } catch {
      // On error, stop trying further pages this session — the user can
      // pull-to-refresh to retry.
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [
    user,
    loading,
    loadingMore,
    refreshing,
    hasMore,
    posts,
    activeFilter,
    debouncedSearch,
  ]);

  const onLike = async (post: ForumPost) => {
    if (!user) return;
    // Optimistic update.
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              like_count: p.like_count + (p.liked_by_me ? -1 : 1),
            }
          : p
      )
    );
    try {
      await toggleLike(post.id, user.id, post.liked_by_me);
    } catch {
      // Revert.
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                liked_by_me: post.liked_by_me,
                like_count: post.like_count,
              }
            : p
        )
      );
    }
  };

  const filterPills = useMemo(
    () => [
      { id: null as string | null, label: 'Hepsi', emoji: '✨', color: '#7DC3FF' },
      ...COMMUNITY_FILTER_ORDER.map((id) => {
        const a = PRESETS_BY_ID[id];
        return { id, label: a?.name ?? id, emoji: a?.emoji ?? '•', color: a?.color ?? '#7DC3FF' };
      }),
    ],
    []
  );

  if (!user) {
    return (
      <View style={styles.gateRoot}>
        <View style={styles.gateIcon}>
          <Ionicons name="people-outline" size={32} color="#7DC3FF" />
        </View>
        <Text style={styles.gateTitle}>Topluluğa katıl</Text>
        <Text style={styles.gateBody}>
          Diğerlerinin hikayelerini gör, kendi zaferlerini paylaş. Önce hesap oluşturman gerekiyor.
        </Text>
        <Pressable
          style={styles.gateBtn}
          onPress={() => {
            // TODO: hook up real auth flow when sign-in screen exists.
          }}
        >
          <Text style={styles.gateBtnText}>Kayıt Ol</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={15} color="#6B8BA4" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Topluluğu ara..."
          placeholderTextColor="#3D5470"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#3D5470" />
          </Pressable>
        )}
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {filterPills.map((pill) => {
          const active = activeFilter === pill.id;
          return (
            <Pressable
              key={String(pill.id)}
              onPress={() => setActiveFilter(pill.id)}
              style={[
                styles.filterPill,
                {
                  borderColor: active ? hexToRgba(pill.color, 0.65) : '#1A2A45',
                  backgroundColor: active ? hexToRgba(pill.color, 0.14) : '#0A1628',
                },
              ]}
            >
              <Text style={styles.pillEmoji}>{pill.emoji}</Text>
              <Text
                style={[
                  styles.pillLabel,
                  { color: active ? hexToRgba(pill.color, 0.95) : '#94A3B8' },
                ]}
              >
                {pill.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Feed */}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            isOwn={item.user_id === user.id}
            onLike={() => onLike(item)}
            onEdit={() =>
              router.push({
                pathname: '/community-compose',
                params: { editId: item.id },
              })
            }
            onDelete={async () => {
              // Optimistic remove.
              const snapshot = posts;
              setPosts((prev) => prev.filter((p) => p.id !== item.id));
              try {
                await deletePost({ postId: item.id, userId: user.id });
              } catch {
                // Restore on failure.
                setPosts(snapshot);
              }
            }}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7DC3FF"
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {debouncedSearch || activeFilter
                  ? 'Bu filtreyle eşleşen gönderi yok.'
                  : 'Henüz gönderi yok. İlk paylaşan sen ol.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#7DC3FF" />
            </View>
          ) : !hasMore && posts.length > 0 ? (
            <View style={styles.footerEnd}>
              <Text style={styles.footerEndText}>· · ·</Text>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/community-compose')}
        hitSlop={8}
      >
        <Ionicons name="add" size={26} color="#020810" />
      </Pressable>
    </View>
  );
}

function PostCard({
  post,
  isOwn,
  onLike,
  onEdit,
  onDelete,
}: {
  post: ForumPost;
  isOwn: boolean;
  onLike: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const a = PRESETS_BY_ID[post.addiction_id];
  const accent = a?.color ?? '#7DC3FF';
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.addictionBadge,
            {
              backgroundColor: hexToRgba(accent, 0.14),
              borderColor: hexToRgba(accent, 0.4),
            },
          ]}
        >
          <Text style={styles.badgeEmoji}>{a?.emoji ?? '•'}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.username} numberOfLines={1}>
            {post.username || 'anonim'}
          </Text>
          <Text style={styles.metaLine}>
            <Text style={{ color: hexToRgba(accent, 0.85) }}>
              {a?.name ?? post.addiction_id}
            </Text>
            <Text style={{ color: '#3D5470' }}>{'  ·  '}</Text>
            <Text style={{ color: '#94A3B8' }}>{relativeTime(post.created_at)}</Text>
          </Text>
        </View>
        {isOwn && (
          <View style={styles.ownActions}>
            <Pressable onPress={onEdit} hitSlop={6} style={styles.ownIconBtn}>
              <Ionicons name="pencil" size={12} color="#6B8BA4" />
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={6} style={styles.ownIconBtn}>
              <Ionicons name="trash-outline" size={12} color="#6B8BA4" />
            </Pressable>
          </View>
        )}
      </View>

      <Text style={styles.content}>{post.content}</Text>

      <View style={styles.cardFooter}>
        <Pressable onPress={onLike} hitSlop={6} style={styles.likeBtn}>
          <Ionicons
            name={post.liked_by_me ? 'heart' : 'heart-outline'}
            size={16}
            color={post.liked_by_me ? '#EC4899' : '#6B8BA4'}
          />
          <Text
            style={[
              styles.likeCount,
              { color: post.liked_by_me ? '#EC4899' : '#6B8BA4' },
            ]}
          >
            {post.like_count}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020810',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginTop: 56,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1A2A45',
    borderRadius: 11,
  },
  searchInput: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 13,
    padding: 0,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillEmoji: {
    fontSize: 12,
  },
  pillLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1A2A45',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  addictionBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    fontSize: 18,
  },
  headerText: {
    flex: 1,
  },
  username: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  metaLine: {
    marginTop: 2,
    fontSize: 10.5,
    letterSpacing: 0.3,
  },
  content: {
    color: '#E2E8F0',
    fontSize: 13.5,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  ownActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ownIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A2A45',
    backgroundColor: '#0D1E35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  likeCount: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
  },
  emptyText: {
    color: '#6B8BA4',
    fontSize: 13,
    fontWeight: '300',
  },
  footerLoader: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  footerEnd: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  footerEndText: {
    color: '#3D5470',
    fontSize: 12,
    letterSpacing: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 96,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7DC3FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7DC3FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 12,
  },
  gateRoot: {
    flex: 1,
    backgroundColor: '#020810',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  gateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0D1E35',
    borderWidth: 1,
    borderColor: '#1E3050',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  gateTitle: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
  gateBody: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
  },
  gateBtn: {
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  gateBtnText: {
    color: '#7DC3FF',
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
});
