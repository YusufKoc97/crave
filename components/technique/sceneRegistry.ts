import type { ComponentType } from 'react';
import type { TechniqueType } from '@/constants/toolkitCatalog';
import type { SceneProps } from './types';
import { Breathing478Screen } from './Breathing478Screen';
import { UrgeSurfingScreen } from './UrgeSurfingScreen';
import { Grounding54321Screen } from './Grounding54321Screen';
import { BodyScanScreen } from './BodyScanScreen';
import { RideTheWaveScreen } from './RideTheWaveScreen';

/**
 * Scene registry — the single place the {@link ExerciseRunner} looks up
 * which component renders a given exercise. Replaces the old
 * `switch (technique.type)` inside the runner so that adding an
 * exercise never touches the runner shell: define a new
 * `TechniqueType`, add its catalog entry, and register one line here.
 */
export type ExerciseScene = {
  component: ComponentType<SceneProps>;
  /**
   * Whether the scene renders its own timer / progress readout.
   * Defaults to `true` — the four MVP scenes each drive their own
   * countdown. A scene that sets this `false` is opting into the
   * shell's generic progress affordance and should report `onProgress`.
   */
  ownsProgress?: boolean;
  /**
   * Grace window (ms) before a foreground event triggers a full
   * restart. Default `0` = the foundation's behaviour: any
   * background→foreground remounts the scene from zero. A scene that
   * can meaningfully resume mid-flow (e.g. Ride the Wave's timeline)
   * sets a short window so a brief glance away resumes instead of
   * resetting; only an absence longer than this restarts.
   */
  foregroundGraceMs?: number;
};

/**
 * type → scene. Typed as a *total* `Record<TechniqueType, …>`, so TS
 * fails the build if a `TechniqueType` has no scene — the same
 * exhaustiveness the old `never` guard gave, enforced at the registry
 * instead of the call site.
 */
export const SCENE_REGISTRY: Record<TechniqueType, ExerciseScene> = {
  breathing: { component: Breathing478Screen, ownsProgress: true },
  mindfulness: { component: UrgeSurfingScreen, ownsProgress: true },
  grounding: { component: Grounding54321Screen, ownsProgress: true },
  body_scan: { component: BodyScanScreen, ownsProgress: true },
  // Draws its own progress (the wave + marker) and additionally reports
  // onProgress to drive the shell's focal glow. A 12s grace window lets
  // a brief glance away resume the wave instead of restarting it.
  ride_the_wave: {
    component: RideTheWaveScreen,
    ownsProgress: true,
    foregroundGraceMs: 12_000,
  },
};

export function sceneFor(type: TechniqueType): ExerciseScene {
  return SCENE_REGISTRY[type];
}
