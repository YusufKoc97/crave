import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSessions } from '@/context/SessionsContext';
import { useAuth } from '@/context/AuthContext';
import { useAddictions } from '@/context/AddictionsContext';
import { useAddictionScores } from '@/context/AddictionScoresContext';
import { getUsername } from '@/lib/profile';
import { useUserStats } from '@/lib/userStats';
import { overallRankFromTotalPoints } from '@/lib/overallRank';
import { CoreHero } from '@/components/profile/CoreHero';
import { LifetimePanel } from '@/components/profile/LifetimePanel';
import { StreakMapPanel } from '@/components/profile/StreakMapPanel';
import { DevSeedBadge } from '@/components/profile/DevSeedBadge';
import { FeedingRow } from '@/components/profile/FeedingRow';
import {
  DeleteDialog,
  DeleteRow,
  LanguageRow,
  PremiumRow,
  SettingsGroup,
  SignOutDialog,
  SignOutRow,
} from '@/components/profile/CoreSettings';
import { coreText, neon } from '@/components/profile/coreTheme';
import { dsColors, dsSpacing } from '@/constants/designSystem';
import { t } from '@/lib/i18n';
import { useToast } from '@/context/ToastContext';
import { purgeLocalUserState } from '@/lib/localState';
import { resetQueryCache } from '@/lib/queryClient';
import { deleteAccount } from '@/lib/accountDeletion';

/**
 * Profile — "The Core".
 *
 * One object, four readings of it:
 *
 *   1. The Core       — who you are right now. The rank ring, the
 *                       addictions feeding it as filaments, and the
 *                       points that got you here.
 *   2. LIFETIME       — a single instrument panel. One hero number
 *                       with three micro readings hanging off it,
 *                       replacing the old 2×2 grid that gave four
 *                       numbers equal weight and read as a dashboard.
 *   3. FEEDING THE CORE — the per-addiction contributions, as rows in
 *                       a list rather than cards, because they are
 *                       parts of one whole.
 *   4. Settings       — two groups so the destructive action is never
 *                       adjacent to sign-out.
 *
 * Zero points is treated as a *beginning*: the core dims, its loops
 * stand still and the copy invites a first resist. It never renders
 * as a broken or empty state.
 */

export default function ProfileScreen() {
  const { totalPoints } = useSessions();
  const { user, signOut, applySession } = useAuth();
  const { addictions } = useAddictions();
  const { viewFor } = useAddictionScores();
  const stats = useUserStats();
  const toast = useToast();
  const [username, setUsername] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  // Blocks a second sign-out/delete while one is mid-flight — the rows
  // and the confirm dialog have no built-in debounce.
  //
  // Two mechanisms on purpose: the ref is the actual guard (set
  // synchronously, so a double-tap inside one frame cannot get past
  // it), the state exists only to drive the disabled styling. Reading
  // `busy` state alone was a render behind the tap and therefore not a
  // guard at all — delete-account is the most expensive endpoint in
  // the system and has no server-side idempotency to fall back on.
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      // Screen never unmounts on sign-out; clear the stale handle so it
      // doesn't render over the next user's session.
      setUsername(null);
      return;
    }
    let cancelled = false;
    getUsername(user.id).then((u) => {
      if (!cancelled) setUsername(u);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const overall = overallRankFromTotalPoints(totalPoints);
  const handle = username || user?.email?.split('@')[0] || 'you';

  const onSignOut = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setConfirmingSignOut(false);
    try {
      // 1. Server first — this flips the session to null and clears the
      //    local token. If it throws (network down), the user is STILL
      //    signed in, so we must not purge or navigate: that would lie.
      await signOut();
      // 2. Purge local caches so nothing leaks to the next user. Runs
      //    after the auth flip so the contexts' user→null resets have
      //    already fired and won't re-mirror what we clear.
      resetQueryCache();
      await purgeLocalUserState({ includeOnboarding: false });
      // 3. Explicit — there is no active route guard, and '/' redirects
      //    straight back into the tabs.
      router.replace('/(auth)/sign-in');
    } catch {
      toast.error(t('profile.sign_out_failed'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const onDeleteAccount = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setConfirmingDelete(false);
    try {
      // 1. Delete server-side FIRST, while the session is still live —
      //    the function authenticates from the bearer JWT, so signing
      //    out before this would 401. On failure, nothing was changed:
      //    do not sign out, do not purge.
      const result = await deleteAccount();
      if (!result.ok) {
        toast.error(
          result.stage === 'auth_user' || result.stage === 'verify'
            ? t('profile.delete_failed_retry')
            : t('profile.delete_failed')
        );
        return;
      }

      // 2. The account is gone. Clear the now-orphaned session. Its
      //    /logout returns 404, which supabase-js tolerates, so this
      //    normally succeeds; if the network drops, force the local
      //    session to null by hand since there's nothing left to protect.
      try {
        await signOut();
      } catch {
        applySession(null);
      }

      // 3. Purge everything, including the onboarding/KVKK record — this
      //    is the erasing user's PII and must go. Safe to clear here
      //    because step 4 navigates imperatively to sign-in.
      resetQueryCache();
      await purgeLocalUserState({ includeOnboarding: true });
      router.replace('/(auth)/sign-in');
    } catch {
      toast.error(t('profile.delete_failed'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const goToAddictionLanding = (id: string) => {
    router.push(`/info/${id}` as unknown as Parameters<typeof router.push>[0]);
  };

  // Score-descending so the filament fan and the row list agree on
  // order; ties broken lexicographically for a stable render.
  const sortedTracked = useMemo(
    () =>
      [...addictions].sort((a, b) => {
        const diff = viewFor(b.id).score - viewFor(a.id).score;
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      }),
    [addictions, viewFor]
  );

  const maxScore = sortedTracked.length
    ? viewFor(sortedTracked[0].id).score
    : 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <DevSeedBadge />
        <CoreHero
          handle={handle}
          rankName={overall.current.name}
          nextRankName={overall.next?.name ?? null}
          totalPoints={totalPoints}
          pointsToNext={overall.pointsToNext}
          progress={overall.progress}
          rankOrder={overall.current.order}
        />

        {/* The LIFETIME header + hairline now live inside the panel
            itself (Aurora Veil handoff), so no section label here. */}
        <LifetimePanel
          cravingsResisted={stats.cravingsResisted}
          longestStreakDays={stats.longestStreakDays}
          successRate={stats.successRate}
        />

        <StreakMapPanel />

        {sortedTracked.length > 0 ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>
                {t('profile.feeding_section')}
              </Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{sortedTracked.length}</Text>
              </View>
            </View>
            <View style={styles.feedingList}>
              {sortedTracked.map((a, i) => (
                <FeedingRow
                  key={a.id}
                  addiction={a}
                  rankName={viewFor(a.id).currentRank.name}
                  rankOrder={viewFor(a.id).currentRank.order}
                  score={viewFor(a.id).score}
                  maxScore={maxScore}
                  index={i}
                  showDivider={i < sortedTracked.length - 1}
                  onPress={() => goToAddictionLanding(a.id)}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>{t('profile.settings_section')}</Text>
        <SettingsGroup>
          <PremiumRow />
          <LanguageRow />
          <SignOutRow onPress={() => setConfirmingSignOut(true)} />
        </SettingsGroup>

        <View style={styles.groupGap} />
        <SettingsGroup>
          <DeleteRow onPress={() => setConfirmingDelete(true)} />
        </SettingsGroup>
      </ScrollView>

      {confirmingSignOut ? (
        <SignOutDialog
          busy={busy}
          onCancel={() => setConfirmingSignOut(false)}
          onConfirm={() => {
            void onSignOut();
          }}
        />
      ) : null}

      {confirmingDelete ? (
        <DeleteDialog
          busy={busy}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            void onDeleteAccount();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: dsColors.bgBase,
  },
  scrollContent: {
    paddingTop: 44,
    paddingHorizontal: dsSpacing.xl,
    paddingBottom: 120,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionLabel: {
    color: coreText.sectionLabel,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginTop: 30,
    marginBottom: 12,
  },
  countPill: {
    marginTop: 30,
    marginBottom: 12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: neon(0.12),
    borderWidth: 1,
    borderColor: neon(0.28),
  },
  countPillText: {
    color: neon(0.9),
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  feedingList: {
    paddingHorizontal: 2,
  },
  groupGap: {
    height: 12,
  },
});
