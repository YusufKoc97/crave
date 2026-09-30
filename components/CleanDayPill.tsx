import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { useSessions } from '@/context/SessionsContext';
import { useToast } from '@/context/ToastContext';
import { CleanDayScene } from '@/components/CleanDayScene';
import { dsColors } from '@/constants/designSystem';
import { CLEAN_DAY_POINTS } from '@/shared/scoring';
import {
  claimCleanDay,
  invalidateCleanDay,
  useCleanDayEligible,
} from '@/lib/dailyCheckin';
import { t } from '@/lib/i18n';

/**
 * The daily "craving-free day" bonus entry point on the home screen.
 *
 * A quiet pill while yesterday has something honest to claim, and the
 * full scene (CleanDayScene) raised by itself once on the first open of
 * that day. The app cannot tell "no craving came" from "a craving came
 * and was never logged", so the server does the real gatekeeping
 * (supabase/functions/daily-checkin); this component only decides when
 * to ask.
 */
export function CleanDayPill({
  visible,
  bottom,
}: {
  visible: boolean;
  bottom: number;
}) {
  const { day, eligible } = useCleanDayEligible();
  const { user } = useAuth();
  const { refreshTotals } = useSessions();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Set after a successful claim: switches the scene to its "saved" stage.
  const [result, setResult] = useState<{
    points: number;
    total: number;
  } | null>(null);

  // First open of the day with something honest to claim: raise the scene
  // once by itself. "Once" is remembered per user and per claimable day, so
  // dismissing it leaves only the quiet pill for the rest of the day.
  const autoKey = user ? `crave.clean_day.auto_shown:${user.id}` : null;
  const autoChecked = useRef<string | null>(null);
  useEffect(() => {
    if (!visible || !autoKey || !eligible) return;
    if (autoChecked.current === `${autoKey}:${day}`) return;
    autoChecked.current = `${autoKey}:${day}`;
    let cancelled = false;
    void (async () => {
      let shown: string | null = null;
      try {
        shown = await AsyncStorage.getItem(autoKey);
      } catch {
        // Storage unavailable — fall through and show once per session.
      }
      if (cancelled || shown === day) return;
      try {
        await AsyncStorage.setItem(autoKey, day);
      } catch {
        // Not fatal: worst case it shows again next launch.
      }
      // Let the home screen settle before a scene lands on it.
      setTimeout(() => {
        if (!cancelled) setOpen(true);
      }, 700);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, autoKey, day, eligible]);

  const onClaim = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const res = await claimCleanDay(day);
    setBusy(false);
    if (!res.ok) {
      // 409s mean the picture changed under us (a craving was logged, the
      // day was already claimed): refresh so the pill drops away, and say why.
      invalidateCleanDay();
      setOpen(false);
      toast.error(
        res.reason === 'had_sessions'
          ? t('clean_day.err_had_sessions')
          : t('clean_day.err_generic')
      );
      return;
    }
    // Overall points + rank hero live in SessionsContext.
    void refreshTotals();
    setResult({ points: res.pointsDelta, total: res.totalScore });
  }, [busy, day, refreshTotals, toast]);

  const onContinue = useCallback(() => {
    setOpen(false);
    // Drop the pill only once the scene is gone, so it does not vanish
    // from under the fade-out.
    invalidateCleanDay();
    setTimeout(() => setResult(null), 400);
  }, []);

  return (
    <>
      {visible && eligible ? (
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

      <CleanDayScene
        visible={open}
        stage={result ? 'saved' : 'ask'}
        points={CLEAN_DAY_POINTS}
        result={result}
        busy={busy}
        onClaim={() => void onClaim()}
        onLater={() => setOpen(false)}
        onContinue={onContinue}
      />
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
    borderColor: 'rgba(255, 196, 87, 0.32)',
    backgroundColor: 'rgba(10, 22, 40, 0.7)',
  },
  pillText: {
    color: dsColors.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
