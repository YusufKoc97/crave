import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Clock,
  Hand,
  Layers,
  PersonStanding,
  Play,
  Waves,
  Wind,
} from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import {
  techniqueDurationLabel,
  techniqueName,
  type Technique,
} from '@/constants/toolkitCatalog';
import { t } from '@/lib/i18n';
import {
  CARD_BG_BOT,
  CARD_BG_TOP,
  CARD_H,
  CARD_RADIUS,
  CARD_W,
  FONT_STACK,
  GLASS_BG,
  GLASS_BORDER,
  GLASS_INSET_HIGHLIGHT,
  PANEL_INSET,
  PANEL_RADIUS,
  PLAY_BG,
  PLAY_ICON_COLOR,
  PLAY_SIZE,
  SCENE_HUES,
  TEXT_MUTED,
  TEXT_SUBTITLE,
  TEXT_TITLE,
  hexAlpha,
} from './carouselStyle';

/**
 * Toolkit carousel card — a 300×452 rounded rectangle that hosts
 * a full-bleed cinematic scene, top badges, and a glass info panel
 * at the bottom with title, meta, position, and a big play button.
 *
 * Layout, back to front:
 *   1. Full-bleed cinematic scene: two radial glows (per-technique
 *      hue pair from SCENE_HUES) over a #0d1020→#090b14 linear
 *      base, plus a bottom fade toward near-black for readability.
 *   2. Optional `preview` slot — the animated per-technique preview
 *      (breathing orb / surf waves / grounding dots / body scan
 *      sweep) mounts here in M3. When null, the scene reads as
 *      static atmosphere.
 *   3. Top-left "type" pill (Wind / Waves / Hand / PersonStanding
 *      icon + type label). Glass treatment.
 *   4. Glass info panel at the bottom — title (28pt/800/white),
 *      meta row (Clock icon + duration, Layers icon + technique
 *      meta), and the play button + "N of M" position indicator.
 *
 * Tap on the card body OR on the play button both trigger
 * `onSelect(technique)` — the parent opens TechniqueRunnerModal
 * (karar #3A — no in-card playing state).
 */

type Props = {
  technique: Technique;
  index: number;
  total: number;
  accentColor: string;
  onSelect: () => void;
  /** Optional animated scene mounted between the base gradient and
   *  the readability fade. Static fallback when null. */
  preview?: ReactNode;
};

const TYPE_ICONS: Record<Technique['type'], ComponentType<LucideProps>> = {
  breathing: Wind,
  mindfulness: Waves,
  grounding: Hand,
  body_scan: PersonStanding,
};

const TYPE_LABEL_KEYS: Record<Technique['type'], string> = {
  breathing: 'toolkit.type_breathing',
  mindfulness: 'toolkit.type_mindfulness',
  grounding: 'toolkit.type_grounding',
  body_scan: 'toolkit.type_body_scan',
};

export function TechniqueCard({
  technique,
  index,
  total,
  accentColor,
  onSelect,
  preview,
}: Props) {
  const hues = SCENE_HUES[technique.id];
  const TypeIcon = TYPE_ICONS[technique.type];

  return (
    <Pressable
      onPress={onSelect}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={techniqueName(technique)}
    >
      {/* ── Layer 1: base gradient scene ─────────────────────── */}
      <View style={styles.sceneBase} />
      {hues && (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.sceneGlow,
              styles.sceneGlowTop,
              { backgroundColor: hexAlpha(hues.primary, 0.55) },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.sceneGlow,
              styles.sceneGlowBottom,
              { backgroundColor: hexAlpha(hues.secondary, 0.45) },
            ]}
          />
        </>
      )}

      {/* ── Layer 2: animated preview (fills in M3) ─────────── */}
      {preview ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {preview}
        </View>
      ) : null}

      {/* ── Readability fade at the bottom 40% ───────────────── */}
      <View pointerEvents="none" style={styles.bottomFade} />

      {/* ── Layer 3: top-left type pill ─────────────────────── */}
      <View style={styles.typePill}>
        <TypeIcon color="#ffffff" size={14} strokeWidth={2.2} />
        <Text style={styles.typePillLabel}>
          {t(TYPE_LABEL_KEYS[technique.type])}
        </Text>
      </View>

      {/* ── Layer 4: bottom glass info panel ─────────────────── */}
      <View style={styles.glassPanel}>
        <Text style={styles.title} numberOfLines={1}>
          {techniqueName(technique)}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Clock
              color={hexAlpha('#ffffff', 0.62)}
              size={13}
              strokeWidth={2}
            />
            <Text style={styles.metaText}>
              {techniqueDurationLabel(technique)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Layers
              color={hexAlpha('#ffffff', 0.62)}
              size={13}
              strokeWidth={2}
            />
            <Text style={styles.metaText}>
              {t(`toolkit.meta.${technique.id}`)}
            </Text>
          </View>
        </View>

        <View style={styles.panelBottomRow}>
          <Text style={styles.positionLabel}>
            {t('toolkit.card_position', {
              current: index + 1,
              total,
            })}
          </Text>
          <PlayButton />
        </View>

        {/* Passive progress bar — reflects (index+1)/total. Live
            "now playing" fill was intentionally cut per karar #3A;
            the runner modal owns the actual timer. */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((index + 1) / total) * 100}%`,
                backgroundColor: accentColor,
              },
            ]}
          />
        </View>
      </View>
    </Pressable>
  );
}

function PlayButton() {
  // Kept as a plain View — the outer card <Pressable> already
  // owns the tap. On web, nesting a Pressable inside another
  // Pressable yields <button> inside <button> which HTML doesn't
  // allow (hydration warning). The whole card is a huge tap
  // target; the play button is a visual CTA, not a separate hit
  // region.
  return (
    <View style={styles.playBtn} accessibilityElementsHidden>
      <Play
        color={PLAY_ICON_COLOR}
        size={22}
        strokeWidth={0}
        fill={PLAY_ICON_COLOR}
        // Offset a hair right so the triangle sits optically centered.
        style={{ marginLeft: 2 }}
      />
    </View>
  );
}

const glassBlurWeb = Platform.select({
  web: {
    backdropFilter: 'blur(22px)',
    WebkitBackdropFilter: 'blur(22px)',
  } as never,
  default: {},
});

const smallGlassBlurWeb = Platform.select({
  web: {
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  } as never,
  default: {},
});

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: CARD_BG_TOP,
  },

  // Scene layers
  sceneBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CARD_BG_BOT,
    ...Platform.select({
      web: {
        backgroundImage: `linear-gradient(160deg, ${CARD_BG_TOP}, ${CARD_BG_BOT})`,
      } as never,
      default: {},
    }),
  },
  sceneGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    // Web gets a real radial gradient + blur; native settles for
    // a semi-opaque disc that the layered stacking reads as glow.
    ...Platform.select({
      web: {
        filter: 'blur(48px)',
        opacity: 0.75,
      } as never,
      default: {
        opacity: 0.55,
      },
    }),
  },
  sceneGlowTop: {
    top: -80,
    left: -60,
  },
  sceneGlowBottom: {
    bottom: -60,
    right: -80,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.85) 100%)',
      } as never,
      default: {
        backgroundColor: 'rgba(0,0,0,0.35)',
      },
    }),
  },

  // Type pill (top-left)
  typePill: {
    position: 'absolute',
    top: 18,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...smallGlassBlurWeb,
  },
  typePillLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontFamily: FONT_STACK,
  },

  // Glass info panel (bottom)
  glassPanel: {
    position: 'absolute',
    left: PANEL_INSET,
    right: PANEL_INSET,
    bottom: PANEL_INSET,
    padding: 16,
    borderRadius: PANEL_RADIUS,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...glassBlurWeb,
    // Faint inset highlight at the top — sells "glass edge caught the light".
    ...Platform.select({
      web: {
        boxShadow: `inset 0 1px 0 ${GLASS_INSET_HIGHLIGHT}`,
      } as never,
      default: {},
    }),
  },
  title: {
    color: TEXT_TITLE,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontFamily: FONT_STACK,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: TEXT_SUBTITLE,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONT_STACK,
  },
  panelBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  positionLabel: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONT_STACK,
  },
  playBtn: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    backgroundColor: PLAY_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
