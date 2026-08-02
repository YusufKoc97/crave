import type { Technique } from '@/constants/toolkitCatalog';

/**
 * Haptic hooks the runner injects into every scene. Scenes call these
 * at their own moments (phase boundary, commit, celebration) instead
 * of importing `@/lib/haptics` directly — a single injection point so
 * the shell can later gate haptics (e.g. behind a setting) without
 * editing every scene. Optional on {@link SceneProps} for backward
 * compatibility: the four MVP scenes still import haptics directly and
 * ignore this prop, which is harmless.
 */
export type SceneHaptics = {
  tap: () => void;
  commit: () => void;
  celebrate: () => void;
};

/**
 * The scene contract. Every exercise scene the {@link ExerciseRunner}
 * can host implements this. The runner switches on `technique.type`
 * via the scene registry and mounts the matching component; each scene
 * is responsible for signalling `onComplete()` when its guided phase
 * naturally finishes so the runner can advance to the feedback pane.
 *
 * Invariants a scene must uphold (these are the runner's acceptance
 * guarantees, do not break them when authoring a new scene):
 *   - Call `onComplete()` exactly once, when the guided phase finishes.
 *   - Be safe to unmount at any instant — the runner owns the ×/quit
 *     affordance and simply unmounts the scene; clean up timers /
 *     listeners in an effect cleanup. There is no `onQuit`.
 *   - Run from zero on mount — foreground restart is a `key`-driven
 *     remount, never a resume.
 *
 * The last three fields are additive and optional so the original four
 * scenes need no changes; new scenes should prefer them.
 */
export type SceneProps = {
  technique: Technique;
  accentColor: string;
  onComplete: () => void;
  /**
   * 0..1 guided-phase progress. Scenes that let the shell render a
   * generic progress/glow affordance report it here; scenes that own
   * their own timer (the four MVP scenes) may ignore it. See
   * `ExerciseScene.ownsProgress`.
   */
  onProgress?: (fraction: number) => void;
  /** Injected haptic hooks — see {@link SceneHaptics}. */
  haptics?: SceneHaptics;
  /** OS reduced-motion preference, resolved once by the runner. */
  reducedMotion?: boolean;
};

/**
 * @deprecated Kept as an alias so the existing scene files
 * (`Breathing478Screen` etc.) compile unchanged. New scenes should
 * import {@link SceneProps}.
 */
export type TechniqueScreenProps = SceneProps;
