import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {
  dsColors,
  dsFont,
  dsRadius,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';
import { AmbientGlow } from '@/components/ui/AmbientGlow';

/**
 * Shared chrome for the 5-screen onboarding flow. Rebuilds the FireVibe
 * reference (layout / copy / structure) in our design system: navy
 * `bgBase` field, low-intensity radial glows, thin concentric orbital
 * rings, an uppercase step counter, a five-step progress rail that
 * brightens as resolve builds, and a single accent CTA. Nothing here is
 * a port of FireVibe's Tailwind — it's our tokens end to end.
 */

const ACCENT = dsColors.accentBlue;
const HEADER_TOP = 56;

// ─────────────────────────── Backdrop ──────────────────────────────

/** Root field: navy base + soft radial glow behind the content. */
export function ObBackdrop({
  children,
  glowY = 300,
}: {
  children: ReactNode;
  /** Vertical center of the primary glow, in pt from the top. */
  glowY?: number;
}) {
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <AmbientGlow
          color={ACCENT}
          size={560}
          intensity="low"
          position={{ x: 195, y: glowY }}
        />
      </View>
      {children}
    </View>
  );
}

/**
 * Thin concentric orbital rings centered on a point — the quiet sci-fi
 * geometry of the reference. `sizes` are diameters, largest first.
 */
export function ObRings({
  sizes,
  centerY,
  style,
}: {
  sizes: number[];
  /** Ring center as pt from the top of the parent. */
  centerY: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {sizes.map((size, i) => (
        <View
          key={size}
          style={{
            position: 'absolute',
            left: '50%',
            top: centerY,
            width: size,
            height: size,
            marginLeft: -size / 2,
            marginTop: -size / 2,
            borderRadius: size / 2,
            borderWidth: 1,
            borderColor: hexAlpha('#2A4062', 0.55 - i * 0.06),
          }}
        />
      ))}
    </View>
  );
}

// ──────────────────────────── Header ───────────────────────────────

/** Back chevron (optional) + "0X / 05" step counter. */
export function ObHeader({
  step,
  total = 5,
  onBack,
}: {
  step: number;
  total?: number;
  onBack?: () => void;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backBtn}
        >
          <ChevronLeft
            size={22}
            color={dsColors.textSecondary}
            strokeWidth={2}
          />
        </Pressable>
      ) : (
        <View style={styles.backSpacer} />
      )}
      <Text style={styles.stepCounter}>
        {String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </Text>
    </View>
  );
}

// ─────────────────────── Progress dot rail ─────────────────────────

/** Five-step rail; the active step stretches into a lit accent pill. */
export function ObProgress({
  index,
  total = 5,
}: {
  /** Zero-based active step. */
  index: number;
  total?: number;
}) {
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={`Onboarding progress, step ${index + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const active = i === index;
        return (
          <View
            key={i}
            style={[styles.dot, active ? styles.dotActive : styles.dotIdle]}
          />
        );
      })}
    </View>
  );
}

// ─────────────────────────── CTA button ────────────────────────────

/** Primary accent CTA. `variant="outline"` is the final "Enter Crave". */
export function ObButton({
  label,
  onPress,
  disabled,
  variant = 'solid',
  showArrow = true,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
  showArrow?: boolean;
}) {
  const outline = variant === 'outline';
  const textColor = outline
    ? ACCENT
    : disabled
      ? hexAlpha('#06111F', 0.5)
      : '#06111F';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[
        styles.cta,
        outline ? styles.ctaOutline : styles.ctaSolid,
        disabled && styles.ctaDisabled,
      ]}
    >
      <Text style={[styles.ctaText, { color: textColor }]}>{label}</Text>
      {showArrow && (
        <ArrowRight size={19} color={textColor} strokeWidth={2.4} />
      )}
    </Pressable>
  );
}

/** Bottom bar that anchors the progress rail + CTA. */
export function ObFooter({ children }: { children: ReactNode }) {
  return (
    <View style={styles.footer}>
      {/* Fade any scrolling content into the footer instead of letting it
          poke through — a transparent → bgBase vertical wash above the
          solid footer edge. */}
      <View pointerEvents="none" style={styles.footerFade}>
        <Svg width="100%" height="100%">
          <Defs>
            <SvgLinearGradient id="obFooterFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={dsColors.bgBase} stopOpacity={0} />
              <Stop offset="1" stopColor={dsColors.bgBase} stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#obFooterFade)"
          />
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: dsColors.bgBase,
  },
  header: {
    marginTop: HEADER_TOP,
    paddingHorizontal: dsSpacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Always above the orb's ambient atmosphere (a later sibling that
    // spills well beyond the orb and would otherwise dim the chrome).
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
    backgroundColor: hexAlpha(dsColors.bgBase, 0.55),
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Layout-only placeholder that keeps the step counter right-aligned on
  // screens with no back affordance (screen 1). No border/fill so it
  // doesn't read as an empty button.
  backSpacer: {
    width: 44,
    height: 44,
  },
  stepCounter: {
    fontSize: dsFont.size.tiny,
    fontWeight: dsFont.weight.bold,
    letterSpacing: dsFont.letterSpacing.caps,
    color: dsColors.textTertiary,
    textTransform: 'uppercase',
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: dsSpacing.xl,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotIdle: {
    width: 6,
    backgroundColor: dsColors.borderAccent,
  },
  dotActive: {
    width: 24,
    backgroundColor: ACCENT,
    // Soft accent glow — the rail "brightens as resolve builds".
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
    boxShadow: `0 0 10px ${hexAlpha(ACCENT, 0.8)}`,
  },
  cta: {
    height: 56,
    borderRadius: dsRadius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: dsSpacing.sm,
  },
  ctaSolid: {
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 6,
    boxShadow: `0 10px 30px ${hexAlpha(ACCENT, 0.22)}`,
  },
  ctaOutline: {
    backgroundColor: hexAlpha(ACCENT, 0.1),
    borderWidth: 1,
    borderColor: ACCENT,
    boxShadow: `0 0 26px ${hexAlpha(ACCENT, 0.24)}, inset 0 0 18px ${hexAlpha(ACCENT, 0.08)}`,
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    fontSize: dsFont.size.bodyLg,
    fontWeight: dsFont.weight.bold,
    letterSpacing: dsFont.letterSpacing.tight,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: dsSpacing.xxl,
    paddingBottom: dsSpacing.x4l,
    paddingTop: dsSpacing.xl,
    backgroundColor: dsColors.bgBase,
  },
  footerFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -44,
    height: 44,
  },
});
