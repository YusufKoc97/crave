import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessions } from '@/context/SessionsContext';
import { useAuth } from '@/context/AuthContext';
import { useAddictions } from '@/context/AddictionsContext';
import { useAddictionScores } from '@/context/AddictionScoresContext';
import { getUsername } from '@/lib/profile';
import { useUserStats } from '@/lib/userStats';
import { overallRankFromTotalPoints } from '@/lib/overallRank';
import { weeklyResistCounts } from '@/lib/scoring';
import { TOOLKIT_TECHNIQUES } from '@/constants/toolkitCatalog';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { HeroRankCard } from '@/components/profile/HeroRankCard';
import {
  CravingsResistedCard,
  LongestStreakCard,
  SuccessRateCard,
  TechniquesCard,
} from '@/components/profile/StatCards';
import { TrackingRow } from '@/components/profile/TrackingRow';
import {
  dsColors,
  dsFont,
  dsRadius,
  dsSectionHeaderStyle,
  dsSpacing,
} from '@/constants/designSystem';
import { t } from '@/lib/i18n';

/**
 * Profile screen — polish-phase rewrite (M4).
 *
 * Structure (top → bottom):
 *   1. Hero rank card    — avatar + username + overall-rank projection
 *                          from the shared 9-step ladder + total points
 *   2. Statistics grid   — 2×2 (resisted / streak / success rate /
 *                          techniques used). React-Query-backed via
 *                          `useUserStats()`; falls back to 0s while
 *                          the fetch is in flight.
 *   3. Your addictions   — grouped list (tracked only) with rank +
 *                          score per row. Tap → Info detail landing.
 *   4. Settings          — language / upgrade / sign out / delete.
 *                          Delete is a placeholder confirmation +
 *                          signOut (real delete_user RPC lives in
 *                          a later phase).
 *
 * The previous WeeklyChart and StatCard (won today / lost today /
 * momentum) blocks were dropped for this design — the streak + rate
 * on the grid cover the same "how am I doing" question with less
 * chart real estate. Existing SessionsContext still exposes those
 * numbers for anywhere else in the app that wants them.
 */

export default function ProfileScreen() {
  const { totalPoints, sessions } = useSessions();
  const { user, signOut } = useAuth();
  const { addictions } = useAddictions();
  const { viewFor } = useAddictionScores();
  const stats = useUserStats();
  const [username, setUsername] = useState<string | null>(null);

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
  const avatarGlyph = (username?.[0] || user?.email?.[0] || '?').toUpperCase();

  const onSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  // Delete account — placeholder for a later RPC. Confirmation
  // Alert then a signOut so the session doesn't linger.
  const onDeleteAccount = () => {
    Alert.alert(
      t('profile.delete_confirmation_title'),
      t('profile.delete_confirmation_message'),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        {
          text: t('profile.delete_confirm'),
          style: 'destructive',
          onPress: onSignOut,
        },
      ]
    );
  };

  const goToAddictionLanding = (id: string) => {
    router.push(`/info/${id}` as unknown as Parameters<typeof router.push>[0]);
  };

  // Sort addictions by score desc — the "you're most invested in"
  // one leads. Ties resolved lexicographically for determinism.
  const sortedTracked = [...addictions].sort((a, b) => {
    const scoreDiff = viewFor(b.id).score - viewFor(a.id).score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.id.localeCompare(b.id);
  });

  // Weekly resist-count sparklines: one overall series (cravings-resisted
  // stat card) plus one per tracked addiction (tracking rows). Memoised
  // on the sessions list so the pure aggregation doesn't re-run per render.
  const { overallWeekly, weeklyByAddiction } = useMemo(() => {
    const nowMs = Date.now();
    const overall = weeklyResistCounts({ sessions, nowMs });
    const byAddiction: Record<string, number[]> = {};
    for (const a of addictions) {
      byAddiction[a.id] = weeklyResistCounts({
        sessions: sessions.filter((s) => s.addictionId === a.id),
        nowMs,
      });
    }
    return { overallWeekly: overall, weeklyByAddiction: byAddiction };
  }, [sessions, addictions]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>{t('profile.screen_title')}</Text>

      {/* ── Hero rank card ─────────────────────────────────────── */}
      <HeroRankCard
        avatarGlyph={avatarGlyph}
        displayName={username || user?.email || ''}
        overall={overall}
        totalPoints={totalPoints}
      />

      {/* ── Statistics 2×2 grid ────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{t('profile.statistics_section')}</Text>
      <View style={styles.statsGrid}>
        <CravingsResistedCard
          value={stats.cravingsResisted}
          weekly={overallWeekly}
          label={t('profile.stat_cravings_resisted')}
          index={0}
        />
        <LongestStreakCard
          value={stats.longestStreakDays}
          label={`${t('profile.stat_longest_streak')} (${t('profile.stat_streak_unit')})`}
          index={1}
        />
        <SuccessRateCard
          rate={stats.successRate}
          label={t('profile.stat_success_rate')}
          index={2}
        />
        <TechniquesCard
          used={stats.techniquesUsed}
          total={TOOLKIT_TECHNIQUES.length}
          label={t('profile.stat_techniques_used')}
          index={3}
        />
      </View>

      {/* ── Tracked addictions list ────────────────────────────── */}
      {sortedTracked.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>
            {t('profile.your_addictions_section')}
          </Text>
          <SurfaceCard style={styles.listCard} radius={dsRadius.card}>
            {sortedTracked.map((a, idx) => (
              <TrackingRow
                key={a.id}
                addiction={a}
                showDivider={idx < sortedTracked.length - 1}
                rankName={viewFor(a.id).currentRank.name}
                score={viewFor(a.id).score}
                weekly={weeklyByAddiction[a.id] ?? []}
                onPress={() => goToAddictionLanding(a.id)}
              />
            ))}
          </SurfaceCard>
        </>
      )}

      {/* ── Settings ──────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{t('profile.settings_section')}</Text>
      <SurfaceCard style={styles.listCard} radius={dsRadius.card}>
        <SettingsRow
          icon="language-outline"
          label={t('profile.language')}
          trailing={t('profile.language_value')}
          showDivider
        />
        <SettingsRow
          icon="star-outline"
          label={t('profile.upgrade_premium')}
          accent={dsColors.accentBlue}
          onPress={() => Alert.alert(t('profile.upgrade_premium'))}
          showDivider
        />
        <SettingsRow
          icon="log-out-outline"
          label={t('profile.sign_out')}
          onPress={onSignOut}
          showDivider
        />
        <SettingsRow
          icon="trash-outline"
          label={t('profile.delete_account')}
          accent={dsColors.dangerGlow}
          onPress={onDeleteAccount}
        />
      </SurfaceCard>
    </ScrollView>
  );
}

// ─────────────────────── Sub-components ───────────────────────

type IonName = React.ComponentProps<typeof Ionicons>['name'];

function SettingsRow({
  icon,
  label,
  trailing,
  accent,
  onPress,
  showDivider,
}: {
  icon: IonName;
  label: string;
  trailing?: string;
  accent?: string;
  onPress?: () => void;
  showDivider?: boolean;
}) {
  const textColor = accent || dsColors.textPrimary;
  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.settingsRow,
          pressed && onPress && styles.rowPressed,
        ]}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={label}
      >
        <Ionicons
          name={icon}
          size={20}
          color={accent || dsColors.textSecondary}
        />
        <Text style={[styles.settingsLabel, { color: textColor }]}>
          {label}
        </Text>
        {trailing ? (
          <Text style={styles.settingsTrailing}>{trailing}</Text>
        ) : null}
      </Pressable>
      {showDivider && <View style={styles.divider} />}
    </>
  );
}

// ─────────────────────────── Styles ───────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: dsColors.bgBase,
  },
  scrollContent: {
    paddingTop: 64,
    paddingHorizontal: dsSpacing.xl,
    paddingBottom: 120,
  },
  pageTitle: {
    color: dsColors.textPrimary,
    fontSize: dsFont.size.displayXl,
    fontWeight: dsFont.weight.bold,
    marginTop: dsSpacing.xl,
    marginBottom: dsSpacing.md,
  },
  sectionLabel: {
    ...dsSectionHeaderStyle,
    paddingHorizontal: 2,
  },

  // ── Stats grid ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: dsSpacing.md,
  },

  // ── Grouped list card ──
  listCard: {
    // Uses SurfaceCard defaults; rows self-render dividers.
  },

  // ── Settings rows ──
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dsSpacing.md,
    height: 56,
    paddingHorizontal: dsSpacing.lg,
  },
  settingsLabel: {
    flex: 1,
    fontSize: dsFont.size.body,
    fontWeight: dsFont.weight.semibold,
    letterSpacing: dsFont.letterSpacing.tight,
  },
  settingsTrailing: {
    color: dsColors.textSecondary,
    fontSize: dsFont.size.label,
    fontWeight: dsFont.weight.regular,
  },

  divider: {
    height: 1,
    backgroundColor: dsColors.borderSubtle,
    marginHorizontal: dsSpacing.lg,
  },
  rowPressed: {
    backgroundColor: dsColors.cardSurfaceElevated,
  },
});
