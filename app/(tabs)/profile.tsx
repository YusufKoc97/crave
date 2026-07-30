import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSessions } from '@/context/SessionsContext';
import { useAuth } from '@/context/AuthContext';
import { useAddictions } from '@/context/AddictionsContext';
import { useAddictionScores } from '@/context/AddictionScoresContext';
import { getUsername } from '@/lib/profile';
import { useUserStats } from '@/lib/userStats';
import { overallRankFromTotalPoints } from '@/lib/overallRank';
import { weeklyResistCounts } from '@/lib/scoring';
import { TOOLKIT_TECHNIQUES } from '@/constants/toolkitCatalog';
import { CoreHero } from '@/components/profile/CoreHero';
import { LifetimePanel } from '@/components/profile/LifetimePanel';
import { FeedingRow } from '@/components/profile/FeedingRow';
import {
  DeleteDialog,
  DeleteRow,
  LanguageRow,
  PremiumRow,
  SettingsGroup,
  SignOutRow,
} from '@/components/profile/CoreSettings';
import { coreText, neon } from '@/components/profile/coreTheme';
import { dsColors, dsSpacing } from '@/constants/designSystem';
import { t } from '@/lib/i18n';

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
  const { totalPoints, sessions } = useSessions();
  const { user, signOut } = useAuth();
  const { addictions } = useAddictions();
  const { viewFor } = useAddictionScores();
  const stats = useUserStats();
  const [username, setUsername] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!user) return;
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
    await signOut();
    router.replace('/');
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

  const overallWeekly = useMemo(
    () => weeklyResistCounts({ sessions, nowMs: Date.now() }),
    [sessions]
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <CoreHero
          handle={handle}
          rankName={overall.current.name}
          nextRankName={overall.next?.name ?? null}
          totalPoints={totalPoints}
          pointsToNext={overall.pointsToNext}
          progress={overall.progress}
          rankOrder={overall.current.order}
        />

        <Text style={styles.sectionLabel}>{t('profile.lifetime_section')}</Text>
        <LifetimePanel
          cravingsResisted={stats.cravingsResisted}
          weekly={overallWeekly}
          longestStreakDays={stats.longestStreakDays}
          successRate={stats.successRate}
          techniquesUsed={stats.techniquesUsed}
          techniquesTotal={TOOLKIT_TECHNIQUES.length}
        />

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
          <PremiumRow
            onPress={() => Alert.alert(t('profile.upgrade_premium'))}
          />
          <LanguageRow />
          <SignOutRow onPress={onSignOut} />
        </SettingsGroup>

        <View style={styles.groupGap} />
        <SettingsGroup>
          <DeleteRow onPress={() => setConfirmingDelete(true)} />
        </SettingsGroup>
      </ScrollView>

      {confirmingDelete ? (
        <DeleteDialog
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            // Real `delete_user` RPC lands in a later phase; signing
            // out keeps the session from lingering in the meantime.
            void onSignOut();
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
