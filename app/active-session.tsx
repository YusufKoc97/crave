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
import { colors } from '@/constants/theme';
import { calculateResistPoints, useSessions } from '@/context/SessionsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  saveActiveSessionId,
  clearActiveSessionId,
  saveActiveSnapshot,
  savePendingFinish,
  clearPendingFinish,
} from '@/lib/activeSession';

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

function formatTime(s: number) {
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
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
    /** When set, this screen resumes an existing DB row instead of creating one. */
    resumeId?: string;
    /** ISO timestamp the original craving started — anchors the wall-clock timer. */
    resumeStartedAt?: string;
  }>();

  const accentColor = params.color ?? colors.blue;
  const maxMinutes = Number(params.maxMinutes ?? 9);
  const sensitivity = Math.max(1, Math.min(10, Number(params.sensitivity ?? 5)));
  const cycleSeconds = Math.max(60, maxMinutes * 60);

  const { recordSession } = useSessions();
  const { user } = useAuth();
  // DB row id of the in-flight craving — set after the INSERT resolves.
  const sessionId = useRef<string | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [bonusFlash, setBonusFlash] = useState<{ key: number; amount: number } | null>(null);
  const [quoteIdx, setQuoteIdx] = useState(0);
  // Set after a successful "I Resisted" — replaces the action buttons with a
  // celebratory share banner. Custom addictions skip share (preset only).
  const [shareBanner, setShareBanner] = useState<{ points: number } | null>(null);

  // Wall-clock anchor — survives JS thread pauses (background/foreground).
  // For a resumed session we anchor to the ORIGINAL started_at so elapsed
  // includes the time the app was closed.
  const startedAt = useRef(
    params.resumeStartedAt ? Date.parse(params.resumeStartedAt) : Date.now()
  );

  // Persist a local snapshot the moment we have an addiction id, regardless
  // of auth — that way the app can resume even in DEV_MODE without Supabase.
  // For authenticated users we ALSO open an "active" row on the server.
  useEffect(() => {
    if (!params.id) return;

    if (params.resumeId) {
      // Already resuming a known row — keep id + snapshot in sync.
      sessionId.current = params.resumeId;
      saveActiveSessionId(params.resumeId);
      saveActiveSnapshot({
        addictionId: params.id,
        startedAt: startedAt.current,
        sessionId: params.resumeId,
      });
      return;
    }

    // Brand-new session: save the snapshot immediately so a hard kill in the
    // next millisecond is still recoverable.
    saveActiveSnapshot({
      addictionId: params.id,
      startedAt: startedAt.current,
    });

    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('craving_sessions')
        .insert({
          user_id: user.id,
          addiction_id: params.id!,
          status: 'active',
          started_at: new Date(startedAt.current).toISOString(),
          sensitivity,
        })
        .select('id')
        .single();
      if (!cancelled && !error && data) {
        sessionId.current = data.id;
        saveActiveSessionId(data.id);
        // Upgrade the snapshot with the DB row id.
        saveActiveSnapshot({
          addictionId: params.id!,
          startedAt: startedAt.current,
          sessionId: data.id,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, params.resumeId, user, sensitivity]);

  const quoteOpacity = useSharedValue(1);
  const arcOffset = useSharedValue(CIRCUMFERENCE);
  const spinnerRotate = useSharedValue(0);
  const completePulse = useSharedValue(0);
  const bonusFloat = useSharedValue(0);
  const ranOnce = useRef(false);
  const lastCycleSeen = useRef(0);

  // Slower spinner — 6s/turn so it feels meditative, not urgent.
  useEffect(() => {
    spinnerRotate.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );
  }, [spinnerRotate]);

  // Tick from wall clock instead of incrementing a counter — iOS suspends the
  // JS timer while backgrounded, but Date.now() still advances. AppState
  // listener forces a resync the moment the app returns to the foreground.
  useEffect(() => {
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    };
    tick();
    const id = setInterval(tick, 250);
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

  useEffect(() => {
    arcOffset.value = withTiming(CIRCUMFERENCE * (1 - cycleProgress), {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [cycleProgress, arcOffset]);

  // Detect a freshly completed cycle and play the celebration.
  useEffect(() => {
    if (currentCycle > lastCycleSeen.current && currentCycle > 0) {
      lastCycleSeen.current = currentCycle;
      const bonus = sensitivity * 5;
      setCompletedCycles(currentCycle);
      setBonusFlash({ key: Date.now(), amount: bonus });

      // Ring/timer pulse: scale + opacity bloom.
      completePulse.value = withSequence(
        withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }),
        withDelay(140, withTiming(0, { duration: 520, easing: Easing.in(Easing.cubic) }))
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
    opacity: bonusFloat.value < 0.05 ? 0 : 1 - Math.max(0, (bonusFloat.value - 0.6) / 0.4),
    transform: [{ translateY: -bonusFloat.value * 38 }],
  }));

  const finish = (outcome: 'resisted' | 'gave_in') => {
    const finalSeconds = Math.floor((Date.now() - startedAt.current) / 1000);
    let pointsEarned = 0;

    if (params.id) {
      pointsEarned = calculateResistPoints({
        outcome,
        durationSeconds: finalSeconds,
        sensitivity,
        completedCycles,
      });
      recordSession({
        addictionId: params.id,
        outcome,
        durationSeconds: finalSeconds,
        sensitivity,
        completedCycles,
      });

      if (sessionId.current && user) {
        // Fire-and-forget but with a retry path: if the network drops
        // mid-finish we still want to mark the row 'completed' on the
        // server eventually. Stash the payload locally so the next
        // app launch can replay it via ActiveSessionRestorer (which
        // already runs on cold start).
        const finishPayload = {
          status: 'completed' as const,
          outcome,
          ended_at: new Date().toISOString(),
          duration_seconds: finalSeconds,
          points_earned: pointsEarned,
          completed_cycles: completedCycles,
        };
        const rowId = sessionId.current;
        savePendingFinish({ sessionId: rowId, payload: finishPayload });
        supabase
          .from('craving_sessions')
          .update(finishPayload)
          .eq('id', rowId)
          .then(({ error }) => {
            if (!error) clearPendingFinish();
            // On error, the pending blob stays on disk and the next
            // ActiveSessionRestorer pass picks it up.
          });
      }
    }
    clearActiveSessionId();

    // On a win, hold the user on this screen and offer to share the moment.
    // On a loss, just bow out cleanly — no celebration prompt.
    if (outcome === 'resisted') {
      setShareBanner({ points: pointsEarned });
      return;
    }
    router.back();
  };

  const dismissAfterShareDecision = () => {
    setShareBanner(null);
    router.back();
  };

  const goShare = () => {
    if (!params.id || !params.name) return;
    // Custom addictions are not eligible — guard at the call site too.
    if (params.id.startsWith('custom-')) {
      dismissAfterShareDecision();
      return;
    }
    // Replace this modal with the compose modal so closing compose returns
    // straight to the home tab, not back to a now-finished active-session.
    router.replace({
      pathname: '/community-compose',
      params: {
        addictionId: params.id,
        prefill: `Az önce ${params.name}'a karşı dayanıp kazandım. `,
      },
    });
  };

  return (
    <View style={styles.root}>
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
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
      </View>

      <View style={styles.addictionArea}>
        <View style={[styles.addictionCard, { borderColor: `${accentColor}55` }]}>
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
            <Text style={styles.timerText}>{formatTime(cycleElapsed)}</Text>
            <Text style={[styles.pointsText, { color: accentColor }]}>+{points} pts</Text>
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
        <View style={[styles.quoteLine, { backgroundColor: `${accentColor}70` }]} />
        <Animated.Text style={[styles.quoteText, quoteStyle]}>
          {QUOTES[quoteIdx]}
        </Animated.Text>
        <View style={[styles.quoteLine, { backgroundColor: `${accentColor}70` }]} />
      </View>

      <View style={styles.btnArea}>
        {shareBanner ? (
          <View style={styles.shareBanner}>
            <Text style={styles.shareTitle}>
              <Text style={{ color: accentColor }}>+{shareBanner.points} </Text>
              <Text style={{ color: '#F1F5F9' }}>puan kazandın</Text>
            </Text>
            <Text style={styles.shareSubtitle}>Bu anı toplulukla paylaşmak ister misin?</Text>
            <View style={styles.shareBtnRow}>
              <Pressable
                style={[styles.dismissBtn]}
                onPress={dismissAfterShareDecision}
              >
                <Text style={styles.dismissText}>Bitir</Text>
              </Pressable>
              {!params.id?.startsWith('custom-') && (
                <Pressable
                  style={[styles.shareBtn, { borderColor: accentColor, backgroundColor: hexWithAlpha(accentColor, 0.12) }]}
                  onPress={goShare}
                >
                  <Text style={[styles.shareBtnText, { color: accentColor }]}>
                    Bunu paylaş
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <>
            <Pressable
              style={[styles.resistBtn, { borderColor: accentColor }]}
              onPress={() => finish('resisted')}
            >
              <Text style={[styles.resistText, { color: accentColor }]}>I Resisted</Text>
            </Pressable>
            <Pressable style={styles.gaveInBtn} onPress={() => finish('gave_in')}>
              <Text style={styles.gaveInText}>I gave in</Text>
            </Pressable>
          </>
        )}
      </View>
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
    backgroundColor: '#020810',
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
  timerText: {
    color: '#F1F5F9',
    fontSize: 56,
    fontWeight: '300',
    letterSpacing: 2,
  },
  pointsText: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1,
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
    color: '#94A3B8',
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '300',
    textAlign: 'center',
    paddingHorizontal: 16,
    flexShrink: 1,
  },
  btnArea: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    gap: 12,
  },
  resistBtn: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#0A1628',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resistText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  gaveInBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A2840',
    backgroundColor: '#080F1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaveInText: {
    color: '#3D5470',
    fontSize: 14,
    fontWeight: '400',
  },
  shareBanner: {
    backgroundColor: '#0A1628',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A2A45',
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  shareTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  shareSubtitle: {
    marginTop: 4,
    color: '#94A3B8',
    fontSize: 12.5,
    fontWeight: '400',
  },
  shareBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  dismissBtn: {
    flex: 1,
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#1A2A45',
    backgroundColor: '#080F1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    color: '#7BA8C8',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  shareBtn: {
    flex: 1.4,
    height: 44,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
