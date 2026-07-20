import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import {
  DOT_ACTIVE_LENGTH,
  DOT_HEIGHT_ACTIVE,
  DOT_INACTIVE,
  DOT_INACTIVE_SIZE,
  FONT_STACK,
  GLASS_BG,
  GLASS_BG_ACTIVE,
  GLASS_BORDER,
  GLASS_BORDER_ACTIVE,
  TEXT_HINT,
  TEXT_TITLE,
} from './carouselStyle';

/**
 * Toolkit carousel chrome — the non-card UI around the swipe deck:
 *   - GlassBackButton (top-left, closes the sub-tab)
 *   - CarouselHeader ("Toolkit" title + "Swipe to explore" hint)
 *   - GlassSegmentedControl (All / Quick · under 3m — visual only
 *     for now per karar #1B; segment tap flips the active state,
 *     the card list stays at 4)
 *   - DotNavigation (4 dots, active one stretches to a 22pt pill
 *     in accent color; tap → snap to that card)
 *
 * All chrome pieces use the same glass treatment: bg rgba white
 * at 8%, border rgba white at 14%, backdrop-blur on web, fill+
 * border only on native (karar #6A — no expo-blur dep).
 */

// ─────────────── Glass back button ───────────────

export function GlassBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.backBtn}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <ChevronLeft color="#ffffff" size={20} strokeWidth={2.4} />
    </Pressable>
  );
}

// ─────────────── Header ───────────────

export function CarouselHeader() {
  return (
    <View style={styles.headerRow}>
      <Text style={styles.headerTitle}>{t('toolkit.screen_title')}</Text>
      <Text style={styles.headerHint}>{t('toolkit.screen_hint')}</Text>
    </View>
  );
}

// ─────────────── Segmented control ───────────────

export type ToolkitSegment = 'all' | 'quick';

export function GlassSegmentedControl({
  active,
  onChange,
}: {
  active: ToolkitSegment;
  onChange: (next: ToolkitSegment) => void;
}) {
  return (
    <View style={styles.segmentWrap}>
      <SegmentPill
        label={t('toolkit.segment_all')}
        isActive={active === 'all'}
        onPress={() => onChange('all')}
      />
      <SegmentPill
        label={t('toolkit.segment_quick')}
        isActive={active === 'quick'}
        onPress={() => onChange('quick')}
      />
    </View>
  );
}

function SegmentPill({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentPill, isActive && styles.segmentPillActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Text
        style={[
          styles.segmentLabel,
          isActive ? styles.segmentLabelActive : styles.segmentLabelInactive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─────────────── Dot navigation ───────────────

export function DotNavigation({
  count,
  activeIndex,
  accentColor,
  onDotPress,
}: {
  count: number;
  activeIndex: number;
  accentColor: string;
  onDotPress: (i: number) => void;
}) {
  return (
    <View style={styles.dotRow}>
      {Array.from({ length: count }, (_, i) => {
        const isActive = i === activeIndex;
        return (
          <Pressable
            key={i}
            onPress={() => onDotPress(i)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Go to card ${i + 1} of ${count}`}
            accessibilityState={{ selected: isActive }}
          >
            <View
              style={[
                styles.dot,
                isActive
                  ? { ...styles.dotActive, backgroundColor: accentColor }
                  : styles.dotIdle,
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────── Styles ───────────────

const glassBlurWeb = Platform.select({
  web: {
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  } as never,
  default: {},
});

const styles = StyleSheet.create({
  // Back button
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...glassBlurWeb,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  headerTitle: {
    color: TEXT_TITLE,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontFamily: FONT_STACK,
  },
  headerHint: {
    color: TEXT_HINT,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: FONT_STACK,
  },

  // Segmented control
  segmentWrap: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS_BG,
    alignItems: 'center',
    ...glassBlurWeb,
  },
  segmentPillActive: {
    backgroundColor: GLASS_BG_ACTIVE,
    borderColor: GLASS_BORDER_ACTIVE,
  },
  segmentLabel: {
    fontSize: 14,
    fontFamily: FONT_STACK,
    letterSpacing: 0.1,
  },
  segmentLabelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  segmentLabelInactive: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },

  // Dots
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  dot: {
    height: DOT_INACTIVE_SIZE,
    borderRadius: DOT_INACTIVE_SIZE / 2,
  },
  dotIdle: {
    width: DOT_INACTIVE_SIZE,
    backgroundColor: DOT_INACTIVE,
  },
  dotActive: {
    width: DOT_ACTIVE_LENGTH,
    height: DOT_HEIGHT_ACTIVE,
    borderRadius: DOT_HEIGHT_ACTIVE / 2,
  },
});
