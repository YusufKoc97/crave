import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useAddictions } from '@/context/AddictionsContext';
import { useAddictionScores } from '@/context/AddictionScoresContext';
import { useSessions } from '@/context/SessionsContext';
import { useToast } from '@/context/ToastContext';
import { RankUnlockModal } from '@/components/RankUnlockModal';
import { dsColors } from '@/constants/designSystem';
import { CLEAN_DAY_POINTS } from '@/shared/scoring';
import { addRankReminders } from '@/lib/rankReminders';
import {
  claimCleanDay,
  invalidateCleanDay,
  useCleanDayCandidates,
} from '@/lib/dailyCheckin';
import { t } from '@/lib/i18n';

/**
 * "Yesterday, without a craving?" — the daily check-in.
 *
 * A quiet pill on the home screen (only while there is something honest
 * to claim), opening a sheet with one row per addiction. The app cannot
 * tell "no craving came" from "a craving came and was never logged", so
 * the sheet says so plainly and points the other case at Resist; the
 * server does the real gatekeeping (supabase/functions/daily-checkin).
 */
export function CleanDayPill({
  visible,
  bottom,
}: {
  visible: boolean;
  bottom: number;
}) {
  const { day, addictionIds } = useCleanDayCandidates();
  const { addictions } = useAddictions();
  const { refresh: refreshScores } = useAddictionScores();
  const { refreshTotals } = useSessions();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unlockQueue, setUnlockQueue] = useState<string[]>([]);

  const rows = addictions.filter((a) => addictionIds.includes(a.id));

  // Nothing left to claim → close the sheet on its own.
  useEffect(() => {
    if (open && rows.length === 0) setOpen(false);
  }, [open, rows.length]);

  const onClaim = useCallback(
    async (addictionId: string) => {
      if (busyId) return;
      setBusyId(addictionId);
      const res = await claimCleanDay(addictionId, day);
      setBusyId(null);
      if (!res.ok) {
        // 409s mean the picture changed under us (a craving was logged, the
        // day was already claimed): drop the stale row instead of retrying.
        invalidateCleanDay();
        toast.error(
          res.reason === 'had_sessions'
            ? t('clean_day.err_had_sessions')
            : t('clean_day.err_generic')
        );
        return;
      }
      invalidateCleanDay();
      refreshScores();
      void refreshTotals();
      if (!res.alreadyClaimed) {
        toast.success(t('clean_day.claimed', { points: res.pointsDelta }));
      }
      if (res.newlyUnlockedRanks.length > 0) {
        void addRankReminders(res.newlyUnlockedRanks);
        // iOS cannot stack two Modals: let the sheet finish closing first.
        setOpen(false);
        setTimeout(() => setUnlockQueue(res.newlyUnlockedRanks), 350);
      }
    },
    [busyId, day, refreshScores, refreshTotals, toast]
  );

  return (
    <>
      {visible && rows.length > 0 ? (
        <Animated.View
          entering={FadeIn.duration(320)}
          exiting={FadeOut.duration(160)}
          style={[styles.pillWrap, { bottom }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.pill}
            onPress={() => setOpen(true)}
            accessibilityRole="button"
          >
            <Text style={styles.pillText}>
              {t('clean_day.pill', { points: CLEAN_DAY_POINTS })}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{t('clean_day.title')}</Text>
            <Text style={styles.body}>
              {t('clean_day.body', { points: CLEAN_DAY_POINTS })}
            </Text>

            <View style={styles.rows}>
              {rows.map((a) => (
                <View key={a.id} style={styles.row}>
                  <Text style={styles.emoji}>{a.emoji}</Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Pressable
                    style={[
                      styles.claimBtn,
                      { borderColor: a.color },
                      busyId === a.id && styles.claimBusy,
                    ]}
                    onPress={() => void onClaim(a.id)}
                    disabled={busyId !== null}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.claimText, { color: a.color }]}>
                      {t('clean_day.claim', { points: CLEAN_DAY_POINTS })}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>

            <Text style={styles.hint}>{t('clean_day.hint')}</Text>
            <Pressable
              onPress={() => setOpen(false)}
              hitSlop={8}
              style={styles.later}
            >
              <Text style={styles.laterText}>{t('clean_day.later')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <RankUnlockModal queue={unlockQueue} onDone={() => setUnlockQueue([])} />
    </>
  );
}

const styles = StyleSheet.create({
  pillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(120, 160, 220, 0.28)',
    backgroundColor: 'rgba(10, 22, 40, 0.7)',
  },
  pillText: {
    color: dsColors.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 16, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 342,
    backgroundColor: '#0A1628',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    paddingTop: 26,
    paddingBottom: 18,
    paddingHorizontal: 22,
    boxShadow:
      '0 20px 60px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  title: {
    color: '#F1F5F9',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    color: dsColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  rows: {
    marginTop: 18,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emoji: {
    fontSize: 20,
  },
  name: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '500',
  },
  claimBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimBusy: {
    opacity: 0.5,
  },
  claimText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  hint: {
    marginTop: 16,
    color: dsColors.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  later: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 4,
  },
  laterText: {
    color: dsColors.textTertiary,
    fontSize: 13,
    fontWeight: '600',
  },
});
