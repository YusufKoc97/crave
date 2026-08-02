import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSharedValue } from 'react-native-reanimated';
import {
  FEEDBACK_OPTIONS,
  techniqueName,
  type Technique,
  type TechniqueContext,
  type TechniqueFeedback,
} from '@/constants/toolkitCatalog';
import { useAuth } from '@/context/AuthContext';
import { logTechniqueEnd, logTechniqueStart } from '@/lib/techniqueUses';
import { hapticCelebrate, hapticCommit, hapticTap } from '@/lib/haptics';
import { hexAlpha } from '@/constants/designSystem';
import { t } from '@/lib/i18n';
import { useReducedMotion } from '@/components/toolkit/useReducedMotion';
import { SCENE_REGISTRY } from '@/components/technique/sceneRegistry';
import { ExerciseAtmosphere } from '@/components/technique/ExerciseAtmosphere';
import type { SceneHaptics } from '@/components/technique/types';

/**
 * Faz 6 / Toolkit foundation — the shared exercise runner. One RN
 * <Modal> that hosts every exercise's guided "scene" + the post-flow
 * feedback pane, mounted from either the Info Toolkit sub-tab
 * (info_tab context) or the active-session picker (active_craving
 * context).
 *
 * The scene itself is resolved from {@link SCENE_REGISTRY} by
 * `technique.type` — the runner shell knows nothing about any specific
 * exercise, so a new one plugs in as a catalog entry + a scene file +
 * one registry line, with zero edits here.
 *
 * Two internal phases:
 *   1. 'guiding'  — the exercise-specific scene runs.
 *   2. 'feedback' — a 4-emoji + Skip pane records how the user felt.
 *
 * The RN Modal (as opposed to a Stack.Screen route) is deliberate:
 * when launched from active-session it must NOT unmount the timer
 * screen underneath. Same pattern as RankUnlockModal / IntensityModal
 * / FailureConfirmModal.
 *
 * Lifecycle contract:
 *   - Fresh mount on every launch (`technique` prop transitions from
 *     null → Technique). No state bleed between invocations.
 *   - `AppState` foreground → in-place restart (see the effect below).
 *     Modal stays open; the scene resets its own phase / timers.
 *   - Quit (×) or completion both funnel to the feedback pane. The DB
 *     `completed` flag records the distinction.
 */

type Props = {
  /** null = closed. Setting to a technique opens the modal on the
   *  guiding phase. */
  technique: Technique | null;
  accentColor: string;
  context: TechniqueContext;
  addictionId: string | null;
  sessionId: string | null;
  /** Fires after the feedback pane dismisses OR the user closes
   *  before completion. Caller clears its `technique` state here. */
  onClose: () => void;
};

type Phase = 'guiding' | 'feedback';

/** Stable haptic hooks handed to every scene (see {@link SceneHaptics}). */
const SCENE_HAPTICS: SceneHaptics = {
  tap: hapticTap,
  commit: hapticCommit,
  celebrate: hapticCelebrate,
};

export function ExerciseRunner({
  technique,
  accentColor,
  context,
  addictionId,
  sessionId,
  onClose,
}: Props) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('guiding');
  // Whether the guiding phase ended by full completion vs early
  // quit. Persisted via technique_uses.completed = this flag.
  const [completedFlag, setCompletedFlag] = useState(false);
  // technique_uses row id — set after the INSERT that runs on
  // technique start. UPDATE on end targets this row.
  const useIdRef = useRef<string | null>(null);
  // Reset seed for the guiding phase — bumping this re-mounts the
  // scene (fresh state) when the user re-foregrounds the app mid-flow
  // (Faz 6 karar #6).
  const [resetSeed, setResetSeed] = useState(0);
  // 0..1 guided-phase progress a scene may report; drives the shell's
  // focal-glow intensification. The four MVP scenes own their own
  // timers and never report, so it stays 0 and the glow simply
  // breathes at its ambient baseline.
  const progress = useSharedValue(0);

  const handleProgress = useCallback(
    (fraction: number) => {
      progress.value = Math.max(0, Math.min(1, fraction));
    },
    [progress]
  );

  // Log start when the technique changes from null → set.
  useEffect(() => {
    if (!technique) return;
    // Reset state for a brand-new launch.
    setPhase('guiding');
    setCompletedFlag(false);
    setResetSeed(0);
    progress.value = 0;
    useIdRef.current = null;
    if (!user) return;
    let cancelled = false;
    (async () => {
      const id = await logTechniqueStart({
        userId: user.id,
        techniqueId: technique.id,
        context,
        sessionId,
        addictionId,
      });
      if (!cancelled) useIdRef.current = id;
    })();
    return () => {
      cancelled = true;
    };
    // Keyed on user?.id, NOT the user object. supabase-js hands out a
    // fresh session object on every hourly token refresh; depending on
    // it re-ran this effect mid-technique, INSERTed a second
    // technique_uses row and overwrote useIdRef, stranding the first
    // row at completed=false forever — which silently corrupted the
    // "techniques used" statistic (lib/userStats.ts).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technique, user?.id, context, sessionId, addictionId]);

  // AppState foreground → in-place restart of the guiding scene.
  // Karar #6: modal stays open, scene starts from phase 0. Only fires
  // while the guiding pane is on-screen — resetting a feedback pane
  // would just undo the user's rating tap.
  useEffect(() => {
    if (!technique) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && phase === 'guiding') {
        setResetSeed((s) => s + 1);
      }
    });
    return () => sub.remove();
  }, [technique, phase]);

  const handleGuidingComplete = useCallback(() => {
    setCompletedFlag(true);
    setPhase('feedback');
  }, []);

  const handleQuit = useCallback(() => {
    // Quit (× tapped) — flow ends without full completion, but we
    // still surface the feedback pane so we capture the subjective
    // outcome even for partial attempts.
    setCompletedFlag(false);
    setPhase('feedback');
  }, []);

  const handleFeedback = useCallback(
    (feedback: TechniqueFeedback | null) => {
      hapticCommit();
      if (useIdRef.current) {
        // Fire-and-forget — we don't want to block the modal dismissal
        // on telemetry.
        logTechniqueEnd({
          useId: useIdRef.current,
          completed: completedFlag,
          feedback,
        });
      }
      onClose();
    },
    [completedFlag, onClose]
  );

  if (!technique) return null;

  return (
    <Modal
      visible
      transparent={false}
      animationType="slide"
      onRequestClose={handleQuit}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* Atmospheric shell behind every phase (Direction 2). */}
        <ExerciseAtmosphere accentColor={accentColor} progress={progress} />

        {phase === 'guiding' && (
          <>
            <View style={styles.header}>
              <View style={styles.headerTitleWrap} pointerEvents="none">
                <Text style={styles.headerEmoji}>{technique.emoji}</Text>
                <Text
                  style={[
                    styles.headerTitle,
                    { color: hexAlpha(accentColor, 0.9) },
                  ]}
                  numberOfLines={1}
                >
                  {techniqueName(technique).toUpperCase()}
                </Text>
              </View>
              <Pressable
                onPress={handleQuit}
                hitSlop={10}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={t('toolkit.quit')}
              >
                <Ionicons name="close" size={22} color="#cfe0f5" />
              </Pressable>
            </View>
            <GuidingScreen
              key={`${technique.id}-${resetSeed}`}
              technique={technique}
              accentColor={accentColor}
              onComplete={handleGuidingComplete}
              onProgress={handleProgress}
            />
          </>
        )}
        {phase === 'feedback' && (
          <FeedbackPane accentColor={accentColor} onSelect={handleFeedback} />
        )}
      </View>
    </Modal>
  );
}

/**
 * Resolves a technique to its scene via the registry and mounts it.
 * Every scene receives an `onComplete` callback that fires the moment
 * the guided phase naturally finishes; the runner then moves to the
 * feedback pane. Haptics + reduced-motion are injected so new scenes
 * have a single source for both.
 */
function GuidingScreen({
  technique,
  accentColor,
  onComplete,
  onProgress,
}: {
  technique: Technique;
  accentColor: string;
  onComplete: () => void;
  onProgress: (fraction: number) => void;
}) {
  const reducedMotion = useReducedMotion();
  const scene = SCENE_REGISTRY[technique.type];
  if (!scene) return null;
  const Scene = scene.component;
  return (
    <Scene
      technique={technique}
      accentColor={accentColor}
      onComplete={onComplete}
      onProgress={onProgress}
      haptics={SCENE_HAPTICS}
      reducedMotion={reducedMotion}
    />
  );
}

function FeedbackPane({
  accentColor,
  onSelect,
}: {
  accentColor: string;
  onSelect: (feedback: TechniqueFeedback | null) => void;
}) {
  return (
    <View style={styles.feedbackRoot}>
      <Text style={styles.feedbackTitle}>{t('toolkit.how_did_this_feel')}</Text>

      <View style={styles.feedbackGrid}>
        {FEEDBACK_OPTIONS.map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            style={[
              styles.feedbackOption,
              { borderColor: hexAlpha(accentColor, 0.28) },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t(opt.labelKey)}
          >
            <Text style={styles.feedbackEmoji}>{opt.emoji}</Text>
            <Text style={[styles.feedbackLabel, { color: accentColor }]}>
              {t(opt.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => onSelect(null)}
        style={styles.skipBtn}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('toolkit.feedback_skip')}
      >
        <Text style={styles.skipText}>{t('toolkit.feedback_skip')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Fallback under the atmospheric shell so there's never a flash of
    // white on mount; the shell paints the real, layered background.
    backgroundColor: '#02060e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEmoji: {
    fontSize: 15,
    lineHeight: 18,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.4,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 48,
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,22,40,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(207,224,245,0.16)',
  },
  feedbackRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  feedbackTitle: {
    color: '#F1F5F9',
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: 0.4,
    marginBottom: 40,
    textAlign: 'center',
  },
  feedbackGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 32,
  },
  feedbackOption: {
    width: 130,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    // Translucent so the atmospheric shell reads through; the accent
    // tint is layered on inline (per-addiction) in the JSX.
    borderColor: 'rgba(207,224,245,0.1)',
    backgroundColor: 'rgba(10,22,40,0.5)',
    alignItems: 'center',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  },
  feedbackEmoji: {
    fontSize: 34,
    lineHeight: 38,
  },
  feedbackLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  skipText: {
    color: '#7BA8C8',
    fontSize: 13.5,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
});
