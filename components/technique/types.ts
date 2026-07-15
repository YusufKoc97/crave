import type { Technique } from '@/constants/toolkitCatalog';

/**
 * Common interface every technique screen implements. The runner
 * modal switches on `technique.type` and mounts the matching
 * component; each is responsible for signalling `onComplete()` when
 * the guided phase naturally finishes so the runner can advance to
 * the feedback pane.
 */
export type TechniqueScreenProps = {
  technique: Technique;
  accentColor: string;
  onComplete: () => void;
};
