import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Respect the OS-level reduced motion preference (karar #4C).
 *
 * When the user has "Reduce Motion" enabled on their device, our
 * preview scenes should either freeze at their resting frame or
 * skip animations entirely. Each scene component reads this and
 * bails from the Reanimated loops before they start.
 *
 * Web: `matchMedia('(prefers-reduced-motion: reduce)')`. RN Web's
 * AccessibilityInfo shim wires the same source, so the single API
 * call below covers both platforms without a Platform.select.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (!cancelled) setReduced(v);
      })
      .catch(() => {
        // API not available — leave motion enabled.
      });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduced;
}
