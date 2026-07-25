import { useEffect, useState } from 'react';
import { Text, type TextProps } from 'react-native';
import { useReducedMotion } from '@/components/toolkit/useReducedMotion';
import { PROFILE_ANIM } from './profileTheme';

/**
 * Count-up number — same belt-and-braces approach the Comparison
 * module tabs use (Pulse card): the final value is written up front
 * so a stalled rAF never leaves the number stuck at 0, then the
 * display rewinds to 0 and eases up to the target (easeOut cubic).
 *
 * Reduced motion pins straight to the target with no roll.
 */
export function CountUp({
  target,
  delay = 0,
  suffix = '',
  prefix = '',
  format,
  style,
}: {
  target: number;
  delay?: number;
  suffix?: string;
  prefix?: string;
  /** Optional custom formatter (e.g. thousands separators). */
  format?: (v: number) => string;
  style?: TextProps['style'];
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? target : 0);

  useEffect(() => {
    setDisplay(target); // guarantee final value first
    if (reduced) return;
    let cancelled = false;
    const rewind = setTimeout(() => {
      if (cancelled) return;
      setDisplay(0);
      const startAt = performance.now();
      const step = () => {
        if (cancelled) return;
        const p = Math.min(
          1,
          (performance.now() - startAt) / PROFILE_ANIM.countUpMs
        );
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
        else setDisplay(target);
      };
      requestAnimationFrame(step);
    }, delay);
    // Safety: force the final value well after the window closes.
    const safety = setTimeout(
      () => {
        if (!cancelled) setDisplay(target);
      },
      delay + PROFILE_ANIM.countUpMs * 3
    );
    return () => {
      cancelled = true;
      clearTimeout(rewind);
      clearTimeout(safety);
    };
  }, [target, delay, reduced]);

  const body = format ? format(display) : String(display);
  return <Text style={style}>{prefix + body + suffix}</Text>;
}
