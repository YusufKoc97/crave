import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useToast } from '@/context/ToastContext';
import { Card } from '@/components/Card';
import { DEFAULT_ADDICTIONS } from '@/constants/addictions';
import {
  COMMUNITY_FILTER_ORDER,
  REPORT_REASONS,
  deletePost,
  fetchPost,
  fetchPosts,
  relativeTime,
  reportPost,
  subscribeToNewPosts,
  toggleLike,
  type ForumPost,
  type ReportReasonId,
} from '@/lib/community';

const PRESETS_BY_ID = Object.fromEntries(
  DEFAULT_ADDICTIONS.map((a) => [a.id, a])
);

const PAGE_SIZE = 30;

export default function CommunityScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pendingPosts, setPendingPosts] = useState<ForumPost[]>([]);
  const [reportTarget, setReportTarget] = useState<ForumPost | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  // Track posts whose like is currently in-flight so a fast double-tap
  // can't fire two opposing toggleLike calls and leave the DB in a
  // visually-correct-but-actually-flipped state.
  const likeInFlight = useRef<Set<string>>(new Set());

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

  // Realtime: forum_posts INSERT → buffer the new post into pendingPosts
  // unless it should be filtered out by the active addiction pill or the
  // search box. We don't auto-prepend because that would yank the user's
  // scroll position; instead the "X yeni gönderi" pill below appears when
  // pendingPosts.length > 0 and prepends on tap.
  // Reload (filter / search change) clears the pending buffer — those
  // staged posts may no longer match the new filter set anyway.
  useEffect(() => {
    setPendingPosts([]);
  }, [activeFilter, debouncedSearch]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToNewPosts(async (postId) => {
      const fresh = await fetchPost(postId, user.id);
      if (!fresh) return;
      // Filter against the active feed scope.
      if (activeFilter && fresh.addiction_id !== activeFilter) return;
      if (
        debouncedSearch &&
        !fresh.content.toLowerCase().includes(debouncedSearch.toLowerCase())
      ) {
        return;
      }
      // Skip rows already at the top (we created them locally) or already
      // staged.
      setPendingPosts((prev) => {
        if (prev.some((p) => p.id === fresh.id)) return prev;
        // The next effect deduplicates against the visible feed, so we
        // don't need to filter against `posts` here.
        return [fresh, ...prev];
      });
    });
    return unsub;
  }, [user, activeFilter, debouncedSearch]);

  // Drop any pending posts that the local feed already shows. This covers
  // the race where the realtime event arrives just after our own
  // createPost INSERT has refreshed the feed via load().
  useEffect(() => {
    if (pendingPosts.length === 0) return;
    const seen = new Set(posts.map((p) => p.id));
    const filtered = pendingPosts.filter((p) => !seen.has(p.id));
    if (filtered.length !== pendingPosts.length) setPendingPosts(filtered);
  }, [posts, pendingPosts]);

  const flushPending = () => {
    if (pendingPosts.length === 0) return;
    setPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...pendingPosts.filter((p) => !seen.has(p.id)), ...prev];
    });
    setPendingPosts([]);
  };

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
    // Drop the tap if the previous one for this post hasn't resolved.
    if (likeInFlight.current.has(post.id)) return;
    likeInFlight.current.add(post.id);
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
      toast.error('Beğeni kaydedilemedi. Tekrar dene.');
    } finally {
      likeInFlight.current.delete(post.id);
    }
  };

  const filterPills = useMemo(
    () => [
      {
        id: null as string | null,
        label: 'Hepsi',
        emoji: '✨',
        color: '#7DC3FF',
      },
      ...COMMUNITY_FILTER_ORDER.map((id) => {
        const a = PRESETS_BY_ID[id];
        return {
          id,
          label: a?.name ?? id,
          emoji: a?.emoji ?? '•',
          color: a?.color ?? '#7DC3FF',
        };
      }),
    ],
    []
  );

  if (!user) {
    return (
      <View style={styles.gateRoot}>
        <Card variant="elevated" style={styles.gateIcon} borderRadius={32}>
          <View style={styles.gateIconInner}>
            <Ionicons name="people-outline" size={32} color="#7DC3FF" />
          </View>
        </Card>
        <Text style={styles.gateTitle}>Topluluğa katıl</Text>
        <Text style={styles.gateBody}>
          Diğerlerinin hikayelerini gör, kendi zaferlerini paylaş. Önce hesap
          oluşturman gerekiyor.
        </Text>
        <Pressable
          style={styles.gateBtn}
          onPress={() => router.push('/(auth)/sign-up')}
          accessibilityRole="button"
          accessibilityLabel="Kayıt ol"
        >
          <View pointerEvents="none" style={styles.gateBtnHighlight} />
          <Text style={styles.gateBtnText}>Kayıt Ol</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(auth)/sign-in')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Giriş yap"
          style={styles.gateSubLink}
        >
          <Text style={styles.gateSubLinkText}>
            Zaten hesabın var?{' '}
            <Text style={styles.gateSubLinkAccent}>Giriş yap</Text>
          </Text>
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
          <Pressable
            onPress={() => setSearch('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Aramayı temizle"
          >
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
                  backgroundColor: active
                    ? hexToRgba(pill.color, 0.14)
                    : '#0A1628',
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

      {/* Pending realtime posts — surfaces only when the feed has new
          rows the user hasn't pulled in yet */}
      {pendingPosts.length > 0 && (
        <Pressable onPress={flushPending} style={styles.pendingPill}>
          <Ionicons name="arrow-up" size={13} color="#7DC3FF" />
          <Text style={styles.pendingPillText}>
            {pendingPosts.length} yeni gönderi
          </Text>
        </Pressable>
      )}

      {/* Feed */}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            isOwn={item.user_id === user.id}
            isReported={reportedIds.has(item.id)}
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
                toast.success('Gönderi silindi');
              } catch {
                // Restore on failure.
                setPosts(snapshot);
                toast.error('Silinemedi. Tekrar dene.');
              }
            }}
            onReport={() => setReportTarget(item)}
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
        accessibilityRole="button"
        accessibilityLabel="Yeni gönderi"
      >
        <Ionicons name="add" size={26} color="#020810" />
      </Pressable>

      {reportTarget && (
        <ReportSheet
          post={reportTarget}
          onCancel={() => setReportTarget(null)}
          onConfirm={async (reason) => {
            const target = reportTarget;
            setReportTarget(null);
            // Optimistic mark as reported regardless of server outcome —
            // a duplicate is also a "your report is on file" signal.
            setReportedIds((prev) => {
              const next = new Set(prev);
              next.add(target.id);
              return next;
            });
            try {
              await reportPost({
                postId: target.id,
                userId: user.id,
                reason,
              });
              toast.success('Bildirimin kayıt edildi');
            } catch {
              // Roll back the local mark; user can try again.
              setReportedIds((prev) => {
                const next = new Set(prev);
                next.delete(target.id);
                return next;
              });
              toast.error('Bildirim gönderilemedi. Tekrar dene.');
            }
          }}
        />
      )}
    </View>
  );
}

function ReportSheet({
  post,
  onCancel,
  onConfirm,
}: {
  post: ForumPost;
  onCancel: () => void;
  onConfirm: (reason: ReportReasonId) => void | Promise<void>;
}) {
  return (
    <View style={styles.sheetBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View style={styles.sheet}>
        <Text style={styles.sheetKicker}>BU GÖNDERİYİ BİLDİR</Text>
        <Text style={styles.sheetTitle} numberOfLines={2}>
          {post.content.slice(0, 80)}
          {post.content.length > 80 ? '…' : ''}
        </Text>
        <Text style={styles.sheetSubtitle}>
          Bildirimin moderasyon ekibine gider. Diğer kullanıcılar bunu göremez.
        </Text>
        <View style={styles.sheetReasons}>
          {REPORT_REASONS.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => onConfirm(r.id)}
              style={styles.sheetReason}
            >
              <Text style={styles.sheetReasonText}>{r.label}</Text>
              <Ionicons name="chevron-forward" size={14} color="#6B8BA4" />
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onCancel} style={styles.sheetCancel} hitSlop={6}>
          <Text style={styles.sheetCancelText}>Vazgeç</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PostCard({
  post,
  isOwn,
  isReported,
  onLike,
  onEdit,
  onDelete,
  onReport,
}: {
  post: ForumPost;
  isOwn: boolean;
  isReported: boolean;
  onLike: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const a = PRESETS_BY_ID[post.addiction_id];
  const accent = a?.color ?? '#7DC3FF';
  return (
    <Card style={styles.card} borderRadius={14}>
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
            <Text style={{ color: '#94A3B8' }}>
              {relativeTime(post.created_at)}
            </Text>
          </Text>
        </View>
        {isOwn && (
          <View style={styles.ownActions}>
            <Pressable
              onPress={onEdit}
              hitSlop={6}
              style={styles.ownIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Gönderiyi düzenle"
            >
              <Ionicons name="pencil" size={12} color="#6B8BA4" />
            </Pressable>
            <Pressable
              onPress={onDelete}
              hitSlop={6}
              style={styles.ownIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Gönderiyi sil"
            >
              <Ionicons name="trash-outline" size={12} color="#6B8BA4" />
            </Pressable>
          </View>
        )}
      </View>

      <Text style={styles.content}>{post.content}</Text>

      <View style={styles.cardFooter}>
        {!isOwn && (
          <Pressable
            onPress={onReport}
            disabled={isReported}
            hitSlop={6}
            style={styles.reportBtn}
            accessibilityRole="button"
            accessibilityLabel={
              isReported ? 'Bu gönderi bildirildi' : 'Gönderiyi bildir'
            }
            accessibilityState={{ disabled: isReported }}
          >
            <Ionicons
              name={isReported ? 'flag' : 'flag-outline'}
              size={13}
              color={isReported ? '#94A3B8' : '#3D5470'}
            />
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onLike}
          hitSlop={6}
          style={styles.likeBtn}
          accessibilityRole="button"
          accessibilityLabel={
            post.liked_by_me
              ? `Beğeniyi kaldır, ${post.like_count} beğeni`
              : `Beğen, ${post.like_count} beğeni`
          }
        >
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
    </Card>
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
    paddingVertical: 10,
    // Slightly warmer surface than the page bg + a touch of inset
    // depth: the top edge picks up the alpha-white highlight via the
    // inner border-glow trick (inset shadow on web; a thin 1px child
    // View would work on native but inset is cleaner here).
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    borderRadius: 12,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
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
    // 1px alpha-white inset cap on the top edge so active pills feel
    // dimensional instead of flat-color washes. Falls off cleanly on
    // native (boxShadow is a no-op outside RN-Web).
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
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
  reportBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 8, 16, 0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0A1628',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#1E3050',
    paddingTop: 18,
    paddingBottom: 32,
    paddingHorizontal: 20,
    // Lift the bottom sheet off the backdrop with a soft top shadow
    // + the standard 1px alpha-white cap so the rounded lip reads
    // as a real surface rather than a printed band.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
    boxShadow:
      '0 -8px 18px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  sheetKicker: {
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
  },
  sheetTitle: {
    marginTop: 10,
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  sheetSubtitle: {
    marginTop: 8,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  sheetReasons: {
    marginTop: 18,
  },
  sheetReason: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    backgroundColor: '#0D1E35',
    marginBottom: 8,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  sheetReasonText: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  sheetCancel: {
    marginTop: 6,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  sheetCancelText: {
    color: '#7BA8C8',
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: -2,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(125, 195, 255, 0.5)',
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    // Subtle accent halo — the pill is announcing live news so a touch
    // of glow earns its keep.
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
    boxShadow: '0 0 12px rgba(59, 130, 246, 0.28)',
  },
  pendingPillText: {
    color: '#7DC3FF',
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
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
    boxShadow: '0 0 14px rgba(125, 195, 255, 0.55)',
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
    marginBottom: 22,
  },
  gateIconInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateTitle: {
    color: '#F1F5F9',
    fontSize: 19,
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
    marginTop: 26,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    overflow: 'hidden',
    // Soft accent glow — visible on web via boxShadow, on native via
    // shadow* tokens. Subtle enough not to feel like a button on a
    // late-2000s website.
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 4,
    boxShadow: '0 0 14px rgba(59, 130, 246, 0.35)',
  },
  gateBtnHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  gateBtnText: {
    color: '#BFE0FF',
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  gateSubLink: {
    marginTop: 14,
    paddingVertical: 4,
  },
  gateSubLinkText: {
    color: '#94A3B8',
    fontSize: 12.5,
    fontWeight: '400',
  },
  gateSubLinkAccent: {
    color: '#7DC3FF',
    fontWeight: '600',
  },
});
