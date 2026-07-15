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
import {
  FEEDBACK_OPTIONS,
  type Technique,
  type TechniqueContext,
  type TechniqueFeedback,
} from '@/constants/toolkitCatalog';
import { useAuth } from '@/context/AuthContext';
import { logTechniqueEnd, logTechniqueStart } from '@/lib/techniqueUses';
import { hapticCommit } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import { Breathing478Screen } from '@/components/technique/Breathing478Screen';
import { UrgeSurfingScreen } from '@/components/technique/UrgeSurfingScreen';
import { Grounding54321Screen } from '@/components/technique/Grounding54321Screen';
import { BodyScanScreen } from '@/components/technique/BodyScanScreen';

/**
 * Faz 6 — shared toolkit runner. One RN <Modal> that hosts every
 * technique's guided flow + the post-flow feedback pane, mounted
 * from either the Info Toolkit sub-tab (info_tab context) or the
 * active-session picker (active_craving context).
 *
 * Two internal phases:
 *   1. 'guiding'  — the technique-specific screen runs.
 *   2. 'feedback' — a 4-emoji + Skip pane records how the user
 *                    felt about it.
 *
 * The RN Modal (as opposed to a Stack.Screen route) is deliberate:
 * when launched from active-session it must NOT unmount the timer
 * screen underneath. Same pattern as RankUnlockModal /
 * IntensityModal / FailureConfirmModal.
 *
 * Lifecycle contract:
 *   - Fresh mount on every launch (`technique` prop transitions
 *     from null → Technique). No state bleed between invocations.
 *   - `AppState` foreground → in-place restart (see the effect
 *     below). Modal stays open; the guiding screen resets its own
 *     phase / timers.
 *   - Quit (×) or completion both funnel to the feedback pane.
 *     The DB `completed` flag records the distinction.
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

export function TechniqueRunnerModal({
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
  // technique component (fresh state) when the user re-foregrounds
  // the app mid-flow (Faz 6 karar #6).
  const [resetSeed, setResetSeed] = useState(0);

  // Log start when the technique changes from null → set.
  useEffect(() => {
    if (!technique) return;
    // Reset state for a brand-new launch.
    setPhase('guiding');
    setCompletedFlag(false);
    setResetSeed(0);
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
  }, [technique, user, context, sessionId, addictionId]);

  // AppState foreground → in-place restart of the guiding screen.
  // Karar #6: modal stays open, technique starts from phase 0.
  // Only fires while the guiding pane is on-screen — resetting a
  // feedback pane would just undo the user's rating tap.
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
    // Quit (× tapped) — flow ends without full completion, but
    // we still surface the feedback pane so we capture the
    // subjective outcome even for partial attempts.
    setCompletedFlag(false);
    setPhase('feedback');
  }, []);

  const handleFeedback = useCallback(
    (feedback: TechniqueFeedback | null) => {
      hapticCommit();
      if (useIdRef.current) {
        // Fire-and-forget — we don't want to block the modal
        // dismissal on telemetry.
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
        {phase === 'guiding' && (
          <>
            <View style={styles.header}>
              <Pressable
                onPress={handleQuit}
                hitSlop={10}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={t('toolkit.quit')}
              >
                <Ionicons name="close" size={22} color="#94A3B8" />
              </Pressable>
            </View>
            <GuidingScreen
              key={`${technique.id}-${resetSeed}`}
              technique={technique}
              accentColor={accentColor}
              onComplete={handleGuidingComplete}
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
 * Routes a technique to its matching guided screen. Every
 * sub-component receives an `onComplete` callback that fires the
 * moment the guided phase naturally finishes (last cycle / step /
 * region done). The runner then moves to the feedback pane.
 */
function GuidingScreen({
  technique,
  accentColor,
  onComplete,
}: {
  technique: Technique;
  accentColor: string;
  onComplete: () => void;
}) {
  switch (technique.type) {
    case 'breathing':
      return (
        <Breathing478Screen
          technique={technique}
          accentColor={accentColor}
          onComplete={onComplete}
        />
      );
    case 'mindfulness':
      return (
        <UrgeSurfingScreen
          technique={technique}
          accentColor={accentColor}
          onComplete={onComplete}
        />
      );
    case 'grounding':
      return (
        <Grounding54321Screen
          technique={technique}
          accentColor={accentColor}
          onComplete={onComplete}
        />
      );
    case 'body_scan':
      return (
        <BodyScanScreen
          technique={technique}
          accentColor={accentColor}
          onComplete={onComplete}
        />
      );
    default: {
      // Exhaustiveness guard — TS will flag any missing case.
      const _exhaustive: never = technique.type;
      void _exhaustive;
      return null;
    }
  }
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
            style={styles.feedbackOption}
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
    backgroundColor: '#020810',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1E2D4D',
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
    borderColor: '#1E2D4D',
    backgroundColor: '#0A1628',
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
