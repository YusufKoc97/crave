import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { v4 as uuidv4 } from 'uuid';
import { colors } from '@/constants/theme';
import { calculateResistPoints, useSessions } from '@/context/SessionsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  clearActiveSessionId,
  saveActiveSnapshot,
  savePendingFinish,
  clearPendingFinish,
} from '@/lib/activeSession';
import { hapticCelebrate, hapticCommit } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import type { Outcome } from '@/shared/scoring';
import { RankUnlockModal } from '@/components/RankUnlockModal';
import { useAddictionScores } from '@/context/AddictionScoresContext';
import { IntensityModal } from '@/components/IntensityModal';
import { TriggerCaptureModal } from '@/components/TriggerCaptureModal';
import { ToolkitPickerModal } from '@/components/ToolkitPickerModal';
import { TechniqueRunnerModal } from '@/components/TechniqueRunnerModal';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { AmbientGlow } from '@/components/ui/AmbientGlow';
import { dsColors, hexAlpha } from '@/constants/designSystem';
import { invalidateTriggerMaps } from '@/lib/queryClient';
import type { Technique } from '@/constants/toolkitCatalog';

const TIMER_SIZE = 220;
const STROKE_WIDTH = 2;
const R = (TIMER_SIZE - STROKE_WIDTH * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const SPINNER_RING_SIZE = TIMER_SIZE + 18;

// Flavor text shown beneath the timer. Turkish per the project's
// language-mixing rule (English is reserved for the brand + action
// labels). Lines are short on purpose — long quotes compete with the
// timer for attention.
const QUOTES = [
  'Geçen her saniye senin lehine.',
  'Bu dürtüden daha güçlüsün.',
  'Bu dalga kırılacak. Sen kırılmayacaksın.',
  'Dur. Nefes al. Dürtü geçici.',
  'Bunu seçtin — bu cesaret.',
  'Bir anlık sabır, pişmanlıktan kurtarır.',
  'Sen dürtü değilsin. Onu izleyensin.',
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** MM / colon / SS split so the colon can pulse independently. */
function formatTimeParts(s: number): { mm: string; ss: string } {
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return { mm, ss };
}

function ArcProgress({
  arcOffset,
  accentColor,
}: {
  arcOffset: SharedValue<number>;
  accentColor: string;
}) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: arcOffset.value,
  }));

  return (
    <Svg width={TIMER_SIZE} height={TIMER_SIZE} style={styles.arcSvg}>
      <Circle
        cx={TIMER_SIZE / 2}
        cy={TIMER_SIZE / 2}
        r={R}
        stroke="#0F1A2C"
        strokeWidth={STROKE_WIDTH}
        fill="transparent"
      />
      <AnimatedCircle
        cx={TIMER_SIZE / 2}
        cy={TIMER_SIZE / 2}
        r={R}
        stroke={accentColor}
        strokeWidth={STROKE_WIDTH}
        fill="transparent"
        strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        strokeLinecap="round"
        animatedProps={animatedProps}
        originX={TIMER_SIZE / 2}
        originY={TIMER_SIZE / 2}
        rotation={-90}
      />
    </Svg>
  );
}

export default function ActiveSession() {
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    emoji?: string;
    color?: string;
    maxMinutes?: string;
    sensitivity?: string;
    /** Client-generated session UUID — passed when resuming from
     *  AsyncStorage snapshot so the resolve payload uses the SAME
     *  id the interrupted attempt would have used. */
    resumeSessionId?: string;
    /** ISO timestamp the original craving started — anchors the wall-clock timer. */
    resumeStartedAt?: string;
  }>();

  const accentColor = params.color ?? colors.blue;
  const maxMinutes = Number(params.maxMinutes ?? 9);
  const sensitivity = Math.max(
    1,
    Math.min(10, Number(params.sensitivity ?? 5))
  );
  const cycleSeconds = Math.max(60, maxMinutes * 60);

  const { recordSession } = useSessions();
  const { user } = useAuth();
  // Client-generated session UUID. Persistent for the life of this
  // craving — used as craving_sessions.id (PK) when resolve-craving
  // does the atomic INSERT. Resumed sessions carry the previous
  // UUID in params so a mid-flight kill + relaunch resolves against
  // the same row (server dedup via PK).
  const sessionId = useRef<string>(params.resumeSessionId ?? uuidv4());

  const [elapsed, setElapsed] = useState(0);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [bonusFlash, setBonusFlash] = useState<{
    key: number;
    amount: number;
  } | null>(null);
  const [quoteIdx, setQuoteIdx] = useState(0);
  // Set after a successful "I Resisted" — replaces the action buttons with a
  // celebratory share banner. Custom addictions skip share (preset only).
  const [shareBanner, setShareBanner] = useState<{ points: number } | null>(
    null
  );
  // Rank ids returned by resolve-craving as newly unlocked. Fed into
  // RankUnlockModal which cycles through them one at a time; empty
  // list = modal closed.
  const [unlockQueue, setUnlockQueue] = useState<string[]>([]);
  const { refresh: refreshScores } = useAddictionScores();

  // Faz 5 REVERSAL modal gates.
  //   Resist flow: I Resisted → IntensityModal → TriggerCaptureModal → resolve
  //   Fail flow:   I Failed → TriggerCaptureModal → resolve
  // pendingOutcome holds which flow is in-flight so the trigger
  // modal knows what outcome to send when the user commits.
  const [intensityOpen, setIntensityOpen] = useState(false);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const pendingOutcome = useRef<Outcome | null>(null);
  const pendingIntensity = useRef<number | null>(null);
  // Faz 6: toolkit picker + runner state. Picker is the bottom
  // sheet; runner is the full-screen guided flow. Both are RN
  // Modals so they overlay the running timer without unmounting
  // it.
  const [toolkitPickerOpen, setToolkitPickerOpen] = useState(false);
  const [runningTechnique, setRunningTechnique] = useState<Technique | null>(
    null
  );

  // Wall-clock anchor — survives JS thread pauses (background/foreground).
  // For a resumed session we anchor to the ORIGINAL started_at so elapsed
  // includes the time the app was closed.
  const startedAt = useRef(
    params.resumeStartedAt ? Date.parse(params.resumeStartedAt) : Date.now()
  );

  // Faz 5 REVERSAL — no DB INSERT on mount. Just snapshot the
  // client-only state so a hard kill mid-timer is recoverable via
  // ActiveSessionRestorer. The row is INSERTed atomically by
  // resolve-craving when the user commits their outcome + triggers.
  useEffect(() => {
    if (!params.id) return;
    saveActiveSnapshot({
      addictionId: params.id,
      startedAt: startedAt.current,
      sessionId: sessionId.current,
      sensitivity,
    });
  }, [params.id, sensitivity]);

  const quoteOpacity = useSharedValue(1);
  const arcOffset = useSharedValue(CIRCUMFERENCE);
  const spinnerRotate = useSharedValue(0);
  const completePulse = useSharedValue(0);
  const bonusFloat = useSharedValue(0);
  // Design-polish M5 — "heartbeat" of the timer. The colon between
  // MM and SS pulses on a 1s cycle so the screen reads as a live
  // vitals monitor rather than a static clock.
  const colonOpacity = useSharedValue(1);
  const ranOnce = useRef(false);
  const lastCycleSeen = useRef(0);

  // Colon heartbeat — 1s in, 1s out. Stays on the compositor.
  useEffect(() => {
    colonOpacity.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [colonOpacity]);

  // Slower spinner — 6s/turn so it feels meditative, not urgent.
  useEffect(() => {
    spinnerRotate.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );
  }, [spinnerRotate]);

  // Tick from wall clock instead of incrementing a counter — iOS suspends
  // the JS timer while backgrounded, but Date.now() still advances. The
  // AppState listener forces a resync the moment the app returns to the
  // foreground (web translates 'visibilitychange' → 'active'/'background',
  // see react-native-web AppState).
  //
  // 1Hz tick: the timer label only renders whole seconds, and the arc /
  // ring animations are interpolated by Reanimated worklets on the UI
  // thread, so a 250ms tick was just thrashing React for no visible win.
  useEffect(() => {
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);

  // Progress within the current cycle (0–1). Resets each time the ring fills.
  const cycleElapsed = elapsed % cycleSeconds;
  const cycleProgress = Math.min(1, cycleElapsed / cycleSeconds);
  const currentCycle = Math.floor(elapsed / cycleSeconds);

  // First arc paint after mount snaps to whatever progress the resume
  // starts at — otherwise the user watches a 900ms sweep from 0 to e.g.
  // 18% on every resume, which feels like the timer is "starting over".
  // Subsequent updates animate normally.
  const arcInitialPaint = useRef(true);
  useEffect(() => {
    const target = CIRCUMFERENCE * (1 - cycleProgress);
    if (arcInitialPaint.current) {
      arcOffset.value = target;
      arcInitialPaint.current = false;
    } else {
      arcOffset.value = withTiming(target, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [cycleProgress, arcOffset]);

  // Detect a freshly completed cycle and play the celebration.
  useEffect(() => {
    if (currentCycle > lastCycleSeen.current && currentCycle > 0) {
      lastCycleSeen.current = currentCycle;
      const bonus = sensitivity * 5;
      setCompletedCycles(currentCycle);
      setBonusFlash({ key: Date.now(), amount: bonus });
      hapticCelebrate();

      // Ring/timer pulse: scale + opacity bloom.
      completePulse.value = withSequence(
        withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }),
        withDelay(
          140,
          withTiming(0, { duration: 520, easing: Easing.in(Easing.cubic) })
        )
      );

      // Floating "+X" indicator
      bonusFloat.value = 0;
      bonusFloat.value = withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
        withDelay(300, withTiming(0, { duration: 0 }))
      );
    }
  }, [currentCycle, sensitivity, completePulse, bonusFloat]);

  useEffect(() => {
    if (!ranOnce.current) {
      ranOnce.current = true;
      return;
    }
    const id = setInterval(() => {
      quoteOpacity.value = withTiming(0, { duration: 350 }, (finished) => {
        if (finished) {
          quoteOpacity.value = withTiming(1, { duration: 450 });
        }
      });
      setTimeout(() => {
        setQuoteIdx((i) => (i + 1) % QUOTES.length);
      }, 350);
    }, 7000);
    return () => clearInterval(id);
  }, [quoteOpacity]);

  // Live points = base elapsed × sensitivity + cycle bonuses already earned.
  const baseProjected = Math.round((elapsed / 60) * sensitivity);
  const cycleBonus = completedCycles * sensitivity * 5;
  const points = Math.max(elapsed > 0 ? 1 : 0, baseProjected) + cycleBonus;

  const quoteStyle = useAnimatedStyle(() => ({ opacity: quoteOpacity.value }));
  const colonStyle = useAnimatedStyle(() => ({ opacity: colonOpacity.value }));
  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinnerRotate.value}deg` }],
  }));

  // Pulse bloom on cycle completion: timer briefly grows + a halo ring fades.
  const timerCelebrateStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + completePulse.value * 0.06 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: completePulse.value * 0.85,
    transform: [{ scale: 1 + completePulse.value * 0.18 }],
  }));
  const bonusFloatStyle = useAnimatedStyle(() => ({
    opacity:
      bonusFloat.value < 0.05
        ? 0
        : 1 - Math.max(0, (bonusFloat.value - 0.6) / 0.4),
    transform: [{ translateY: -bonusFloat.value * 38 }],
  }));

  // Faz 5 entry points — invoked directly from the action buttons.
  // Both gate the actual resolve behind a modal so we can capture
  // Safe "back to home" for every exit path. Two independent
  // problems the earlier `router.back()` had:
  //   1. Nav stack empty on cold-launch restore / deep links /
  //      direct URL open → back() is a no-op. Fall back to
  //      replacing into the tabs root so the button always does
  //      something.
  //   2. Local `active_craving_*` snapshot survives the exit,
  //      so ActiveSessionRestorer immediately fires the user
  //      back into /active-session on the next mount / focus.
  //      Clearing it here treats the manual back tap as
  //      "leave this session" intent (server row stays 'active'
  //      until the user resumes another one or the 2h stale
  //      window kicks in server-side).
  const goHome = () => {
    clearActiveSessionId();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Faz 5 REVERSAL — the button taps only stage state. The Edge
  // Function isn't invoked until the trigger modal commits, at
  // which point the atomic INSERT happens in one shot.
  const onResistPress = () => {
    hapticCommit();
    pendingOutcome.current = 'resisted';
    pendingIntensity.current = null;
    setIntensityOpen(true);
  };

  const onFailPress = () => {
    hapticCommit();
    pendingOutcome.current = 'failed';
    pendingIntensity.current = null;
    setTriggerModalOpen(true);
  };

  const onIntensityPick = (intensity: number | null) => {
    setIntensityOpen(false);
    pendingIntensity.current = intensity;
    // Resist path chains straight into the trigger picker.
    setTriggerModalOpen(true);
  };

  const onTriggerCancel = () => {
    // Cancel keeps the timer alive — user can hit either button
    // again. Clear the staged outcome so a stray commit doesn't
    // fire the wrong flow.
    setTriggerModalOpen(false);
    pendingOutcome.current = null;
    pendingIntensity.current = null;
  };

  const onTriggerCommit = (triggerIds: string[]) => {
    const outcome = pendingOutcome.current;
    if (!outcome) return;
    const intensity = outcome === 'resisted' ? pendingIntensity.current : null;
    setTriggerModalOpen(false);
    pendingOutcome.current = null;
    pendingIntensity.current = null;
    resolveAndFinish(outcome, { intensity, triggerIds });
  };

  const resolveAndFinish = (
    outcome: Outcome,
    extras: { intensity: number | null; triggerIds: string[] }
  ) => {
    const endedAtMs = Date.now();
    const finalSeconds = Math.floor((endedAtMs - startedAt.current) / 1000);

    // Optimistic estimate — same formula the Edge Function runs
    // server-side (shared/scoring.ts). Renders the "+X points"
    // banner immediately; the server-authoritative number
    // reconciles when resolve-craving lands.
    const estimatedPoints = calculateResistPoints({
      outcome,
      durationSeconds: finalSeconds,
      sensitivity,
    });

    if (params.id) {
      // Local cache push for the "today at a glance" counters —
      // server-side view is the source of truth for cumulative
      // scores.
      recordSession({
        addictionId: params.id,
        outcome,
        durationSeconds: finalSeconds,
        sensitivity,
        pointsDelta: outcome === 'resisted' ? estimatedPoints : 0,
      });

      if (user) {
        // Atomic resolve: the Edge Function INSERTs the session
        // row (using our client UUID as PK) + score row + trigger
        // rows + rank unlocks in one call. Stash the full payload
        // in the pending blob first so a mid-flight network drop
        // is replayable on cold launch.
        const rowId = sessionId.current;
        const payload = {
          addictionId: params.id,
          startedAt: new Date(startedAt.current).toISOString(),
          endedAt: new Date(endedAtMs).toISOString(),
          sensitivity,
          outcome,
          intensity: extras.intensity,
          triggerIds: extras.triggerIds,
        };
        savePendingFinish({ sessionId: rowId, payload });
        supabase.functions
          .invoke('resolve-craving', {
            body: {
              session_id: rowId,
              addiction_id: payload.addictionId,
              started_at: payload.startedAt,
              ended_at: payload.endedAt,
              sensitivity: payload.sensitivity,
              outcome: payload.outcome,
              intensity: payload.intensity,
              trigger_ids: payload.triggerIds,
            },
          })
          .then(({ data, error }) => {
            if (error) {
              // Blob stays on disk for the ActiveSessionRestorer
              // replay on next launch. UI already committed the
              // optimistic estimate; user sees no interruption.
              return;
            }
            clearPendingFinish();
            const respPayload = data as {
              points_delta?: number;
              newly_unlocked_ranks?: string[];
            } | null;
            const serverDelta = respPayload?.points_delta;
            if (typeof serverDelta === 'number' && outcome === 'resisted') {
              setShareBanner({ points: Math.max(0, serverDelta) });
            }
            const unlocks = respPayload?.newly_unlocked_ranks ?? [];
            if (unlocks.length > 0) setUnlockQueue(unlocks);
            refreshScores();
            // Faz 8a — refresh trigger-map cache so the Info tab
            // reflects the newly-captured triggers on next visit.
            invalidateTriggerMaps();
          });
      }
    }
    clearActiveSessionId();

    // On a win, hold the user on this screen and offer to share the moment.
    // On a loss, just bow out cleanly — no celebration prompt.
    if (outcome === 'resisted') {
      hapticCelebrate();
      setShareBanner({ points: estimatedPoints });
      return;
    }
    goHome();
  };

  const dismissAfterShareDecision = () => {
    setShareBanner(null);
    goHome();
  };

  return (
    <View style={styles.root}>
      {/* Design-polish M5 — atmospheric background. Two overlapping
          radial glows blend to create the "vitals monitor" feel
          behind the timer. Blue anchors the design system, the
          addiction color layers a personal accent below it. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <AmbientGlow
          color={dsColors.accentBlue}
          size={560}
          intensity="medium"
          position={{ x: 195, y: 340 }}
        />
        <AmbientGlow
          color={accentColor}
          size={360}
          intensity="low"
          position={{ x: 195, y: 520 }}
        />
      </View>
      {Platform.OS === 'web' && (
        <View
          pointerEvents="none"
          style={[
            styles.topGlow,
            {
              backgroundImage: `radial-gradient(ellipse at top, ${accentColor}47 0%, transparent 60%)`,
            },
          ]}
        />
      )}

      <View style={styles.topBar}>
        <Pressable
          onPress={goHome}
          style={styles.backBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
      </View>

      <View style={styles.addictionArea}>
        <View
          style={[styles.addictionCard, { borderColor: `${accentColor}55` }]}
        >
          <Text style={styles.addictionEmoji}>{params.emoji ?? '⚠️'}</Text>
        </View>
        <Text style={styles.addictionName}>
          {(params.name ?? 'Craving').toUpperCase()}
        </Text>
        {completedCycles > 0 && (
          <Text style={[styles.cycleTag, { color: accentColor }]}>
            CYCLE {completedCycles + 1} · +{cycleBonus} EARNED
          </Text>
        )}
      </View>

      <View style={styles.timerArea}>
        <Animated.View style={[styles.timerWrap, timerCelebrateStyle]}>
          {/* Celebration halo — bloom on cycle completion */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.celebrateHalo,
              {
                borderColor: hexWithAlpha(accentColor, 0.85),
                shadowColor: accentColor,
              },
              haloStyle,
            ]}
          />

          <Animated.View
            pointerEvents="none"
            style={[
              styles.spinnerRing,
              {
                borderTopColor: hexWithAlpha(accentColor, 0.95),
                borderRightColor: hexWithAlpha(accentColor, 0.55),
                borderBottomColor: hexWithAlpha(accentColor, 0.18),
                borderLeftColor: hexWithAlpha(accentColor, 0.04),
              },
              spinnerStyle,
            ]}
          />
          <ArcProgress arcOffset={arcOffset} accentColor={accentColor} />
          <View style={styles.timerCenter} pointerEvents="none">
            <View style={styles.timerRow}>
              <Text style={styles.timerText}>
                {formatTimeParts(cycleElapsed).mm}
              </Text>
              <Animated.Text style={[styles.timerText, colonStyle]}>
                :
              </Animated.Text>
              <Text style={styles.timerText}>
                {formatTimeParts(cycleElapsed).ss}
              </Text>
            </View>
            <Text style={[styles.pointsText, { color: accentColor }]}>
              +{points} pts
            </Text>
          </View>

          {/* Floating bonus indicator */}
          {bonusFlash && (
            <Animated.View
              key={bonusFlash.key}
              pointerEvents="none"
              style={[styles.bonusFloat, bonusFloatStyle]}
            >
              <Text style={[styles.bonusFloatText, { color: accentColor }]}>
                +{bonusFlash.amount}
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </View>

      <View style={styles.quoteArea}>
        <View
          style={[styles.quoteLine, { backgroundColor: `${accentColor}70` }]}
        />
        <Animated.Text style={[styles.quoteText, quoteStyle]}>
          {QUOTES[quoteIdx]}
        </Animated.Text>
        <View
          style={[styles.quoteLine, { backgroundColor: `${accentColor}70` }]}
        />
      </View>

      {/* Faz 7 — live "you're not alone" indicator. Placed between
          the motivational quote and the primary action buttons
          (karar #3): close enough to the CTAs to feel like a
          nudge, far enough from the quote to preserve its beat.
          Fails silent; the wrapper doesn't reserve space when the
          component renders null (first fetch error / count = 0). */}
      <PresenceIndicator />

      <View style={styles.btnArea}>
        {shareBanner ? (
          // Post-resolve banner: "+X points earned" + Finish. The
          // Faz 5 intensity modal fires BEFORE this banner shows,
          // so by the time the user sees Finish the intensity is
          // already in flight.
          <View style={styles.shareBanner}>
            <Text style={styles.shareTitle}>
              <Text style={{ color: accentColor }}>+{shareBanner.points} </Text>
              <Text style={{ color: '#F1F5F9' }}>
                {t('active.points_earned')}
              </Text>
            </Text>
            <View style={styles.shareBtnRow}>
              <Pressable
                style={[styles.dismissBtn]}
                onPress={dismissAfterShareDecision}
              >
                <Text style={styles.dismissText}>{t('active.finish')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {/* Faz 6: subtle secondary CTA for the toolkit picker.
                Sits above the primary resist/fail buttons so the
                user's eye lands on the decision buttons first, but
                the escape hatch is always reachable. */}
            <Pressable
              style={styles.toolkitBtn}
              onPress={() => setToolkitPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('toolkit.try_a_technique')}
            >
              <Ionicons
                name="sparkles-outline"
                size={14}
                color={dsColors.accentBlue}
              />
              <Text style={styles.toolkitBtnText}>
                {t('toolkit.try_a_technique')}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.resistBtn,
                {
                  backgroundColor: accentColor,
                  borderColor: accentColor,
                  opacity: pressed ? 0.85 : 1,
                  // Accent-tinted halo — same energy as before, now
                  // wrapping a filled surface instead of an outline.
                  shadowColor: accentColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 18,
                  elevation: 6,
                  boxShadow: `0 0 20px ${hexWithAlpha(accentColor, 0.4)}`,
                },
              ]}
              onPress={onResistPress}
            >
              <Text style={styles.resistText}>{t('active.resist')}</Text>
            </Pressable>
            <Pressable style={styles.gaveInBtn} onPress={onFailPress}>
              <Text style={styles.gaveInText}>{t('active.failed')}</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Rank-unlock celebration — full-screen modal that cycles
          through however many ranks resolve-craving returned in
          newly_unlocked_ranks. Sitting inside the active-session
          root means it can steal focus while the share banner is
          still on screen; user dismisses celebration → sees the
          banner underneath → taps Finish to close the session. */}
      <RankUnlockModal
        queue={unlockQueue}
        accentColor={accentColor}
        onDone={() => setUnlockQueue([])}
      />

      {/* Faz 5 REVERSAL — resist flow: intensity rating first,
          then chains into the trigger modal from onIntensityPick.
          "Skip" on intensity still opens the trigger modal (with
          intensity=null); intensity is optional, triggers are not. */}
      <IntensityModal
        visible={intensityOpen}
        accentColor={accentColor}
        onSelect={onIntensityPick}
      />

      {/* Faz 5 REVERSAL — post-outcome trigger capture. Fires from
          both flows (resist → after intensity; fail → immediately
          after tap). Mandatory min-1, no pre-selection. Cancel
          keeps the timer alive without side effects. Commit is
          what actually invokes resolve-craving. */}
      <TriggerCaptureModal
        visible={triggerModalOpen}
        accentColor={accentColor}
        addictionId={params.id ?? ''}
        addictionName={params.name ?? ''}
        outcome={pendingOutcome.current}
        onCommit={onTriggerCommit}
        onCancel={onTriggerCancel}
      />

      {/* Faz 6 — toolkit picker bottom sheet. Timer keeps ticking
          underneath. Selecting a card closes the sheet and
          mounts TechniqueRunnerModal below. */}
      <ToolkitPickerModal
        visible={toolkitPickerOpen}
        accentColor={accentColor}
        onClose={() => setToolkitPickerOpen(false)}
        onSelect={(tech) => {
          setToolkitPickerOpen(false);
          setRunningTechnique(tech);
        }}
      />

      {/* Faz 6 — guided-flow overlay. Runs on top of the timer;
          context = 'active_craving' so telemetry ties this
          technique_use back to the specific craving session. */}
      <TechniqueRunnerModal
        technique={runningTechnique}
        accentColor={accentColor}
        context="active_craving"
        addictionId={params.id ?? null}
        sessionId={sessionId.current}
        onClose={() => setRunningTechnique(null)}
      />
    </View>
  );
}

function hexWithAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: dsColors.bgBase,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  topBar: {
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0D1E35',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E3050',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  backArrow: {
    color: '#7BA8C8',
    fontSize: 22,
    lineHeight: 22,
    marginTop: -2,
  },
  addictionArea: {
    alignItems: 'center',
    marginTop: 8,
  },
  addictionCard: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Inset highlight + soft outer shadow so the emoji card reads as
    // an actual object hovering over the canvas. The accent-tinted
    // border is set inline from the addiction color downstream.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 5,
    boxShadow:
      '0 6px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  addictionEmoji: {
    fontSize: 36,
  },
  addictionName: {
    marginTop: 14,
    color: '#7BA8C8',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 4,
  },
  cycleTag: {
    marginTop: 6,
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 2,
  },
  timerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerWrap: {
    width: TIMER_SIZE,
    height: TIMER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerRing: {
    position: 'absolute',
    width: SPINNER_RING_SIZE,
    height: SPINNER_RING_SIZE,
    borderRadius: SPINNER_RING_SIZE / 2,
    borderWidth: 1.5,
  },
  celebrateHalo: {
    position: 'absolute',
    width: TIMER_SIZE + 36,
    height: TIMER_SIZE + 36,
    borderRadius: (TIMER_SIZE + 36) / 2,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 12,
  },
  arcSvg: {
    position: 'absolute',
  },
  timerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  timerText: {
    color: dsColors.textPrimary,
    fontSize: 72,
    fontWeight: '700',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
    // Blue text-shadow glow — brief spec (0 0 20pt rgba(77,171,255,0.4)).
    textShadowColor: hexAlpha(dsColors.accentBlue, 0.4),
    textShadowRadius: 20,
    textShadowOffset: { width: 0, height: 0 },
  },
  pointsText: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  bonusFloat: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bonusFloatText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 1,
  },
  quoteArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginBottom: 28,
  },
  quoteLine: {
    flex: 1,
    height: 1,
    maxWidth: 32,
  },
  quoteText: {
    color: dsColors.textSecondary,
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 16,
    flexShrink: 1,
    maxWidth: '80%',
  },
  btnArea: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    gap: 12,
  },
  resistBtn: {
    // Primary CTA — filled with the addiction accent, white label.
    // The accent bg + accent glow are injected inline at the call
    // site so each session feels color-locked.
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resistText: {
    color: dsColors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  gaveInBtn: {
    // Tertiary — transparent bg, muted border, secondary text.
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dsColors.borderAccent,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaveInText: {
    color: dsColors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  toolkitBtn: {
    // Secondary CTA — subtle blue tint, accent blue label. Never
    // competes visually with the primary resist button.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hexAlpha(dsColors.accentBlue, 0.3),
    backgroundColor: hexAlpha(dsColors.accentBlue, 0.1),
  },
  toolkitBtnText: {
    color: dsColors.accentBlue,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  shareBanner: {
    backgroundColor: '#0A1628',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    // Banner is celebrating the win — give it a real surface presence
    // so it lands as a moment, not a notification strip.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 5,
    boxShadow:
      '0 6px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  shareTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  shareBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  dismissBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2D4D',
    backgroundColor: '#080F1C',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  dismissText: {
    color: '#7BA8C8',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
