import { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ComponentType } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  Activity,
  ArrowUpRight,
  Clock,
  Hand,
  PersonStanding,
  Smartphone,
  Waves,
  Wind,
} from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import {
  techniquesForAddiction,
  techniqueDurationLabel,
  techniqueName,
  type Technique,
} from '@/constants/toolkitCatalog';
import { dsSectionHeaderStyle } from '@/constants/designSystem';
import { CardScene } from '@/components/toolkit/previews/CardScene';
import { SCENE_HUES, hexAlpha } from '@/components/toolkit/carouselStyle';
import { t } from '@/lib/i18n';

/**
 * 2-column grid of the offered toolkit techniques.
 *
 * Mounted in the active-session "Try a technique" picker
 * (ToolkitPickerModal) during a live craving. Each tile is a MINI
 * version of the Toolkit carousel card: the same per-technique
 * constellation scene (`CardScene` — nebula, starfield, hero motif) in
 * the technique's own hue, a glass type badge, and the name + duration
 * on a dark fade. So the craving-time picker and the browsable deck read
 * as one family instead of two apps.
 *
 * The scenes render STATIC (`animate={false}`): this opens mid-craving on
 * possibly modest hardware, and five looping animations would be wasted.
 *
 * An odd technique count leaves one tile alone in the last row; that one
 * stretches to full width as a landscape card (scene on the left, text
 * on the right) instead of sitting orphaned.
 *
 * `accentColor` mirrors the craving's addiction brand colour — it owns
 * the small UI accents (duration icon); the technique's hue owns the
 * atmosphere, exactly like the carousel.
 */

type Props = {
  accentColor: string;
  /** Whose toolkit this is — decides which techniques are offered. */
  addictionId?: string | null;
  onSelect: (technique: Technique) => void;
};

const TYPE_ICONS: Record<Technique['type'], ComponentType<LucideProps>> = {
  breathing: Wind,
  mindfulness: Waves,
  grounding: Hand,
  body_scan: PersonStanding,
  ride_the_wave: Activity,
  fake_feed: Smartphone,
};

const SIDE_PAD = 20; // matches ToolkitPickerModal's scroll padding
const GAP = 12;
const TILE_H = 208;
const WIDE_H = 150;
const RADIUS = 22;
const FALLBACK_HUES = { primary: '#5A6BE8', secondary: '#3A2FA8' };

export function ToolkitGrid({ accentColor, addictionId, onSelect }: Props) {
  const { width } = useWindowDimensions();
  const tileW = (width - SIDE_PAD * 2 - GAP) / 2;
  const list = techniquesForAddiction(addictionId);
  const lastIsAlone = list.length % 2 === 1;

  return (
    <View>
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>{t('toolkit.section_kicker')}</Text>
        <View style={styles.hairline} />
      </View>
      <View style={styles.grid}>
        {list.map((tech, i) => {
          const wide = lastIsAlone && i === list.length - 1;
          return (
            <ToolkitCard
              key={tech.id}
              technique={tech}
              accentColor={accentColor}
              tileW={tileW}
              wide={wide}
              onPress={() => onSelect(tech)}
            />
          );
        })}
      </View>
    </View>
  );
}

let fadeSeq = 0;

function ToolkitCard({
  technique,
  accentColor,
  tileW,
  wide,
  onPress,
}: {
  technique: Technique;
  accentColor: string;
  tileW: number;
  wide: boolean;
  onPress: () => void;
}) {
  const Icon = TYPE_ICONS[technique.type];
  const hues = SCENE_HUES[technique.id] ?? FALLBACK_HUES;
  const uid = useRef((fadeSeq += 1)).current;
  const fadeId = `tileFade${uid}`;
  const height = wide ? WIDE_H : TILE_H;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={techniqueName(technique)}
      style={({ pressed }) => [
        styles.card,
        {
          width: wide ? tileW * 2 + GAP : tileW,
          height,
          borderColor: hexAlpha(hues.primary, 0.32),
          boxShadow: `0 10px 26px -12px ${hexAlpha(hues.primary, 0.55)}`,
        },
        pressed && styles.pressed,
      ]}
    >
      {/* Scene. Always the size of one small tile, anchored top-left: the
          constellation lives in the upper part of the scene, so on the wide
          card the extra height is simply clipped from the bottom. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: tileW,
          height: TILE_H,
        }}
      >
        <CardScene techniqueId={technique.id} animate={false} />
      </View>

      {/* Fade to dark: bottom-up on a tile (text sits low), left-to-right on
          the wide card (text sits right). */}
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient
            id={fadeId}
            x1={wide ? '0.3' : '0'}
            y1={wide ? '0' : '0.35'}
            x2={wide ? '0.62' : '0'}
            y2={wide ? '0' : '1'}
          >
            <Stop offset="0" stopColor="#060912" stopOpacity={wide ? 0 : 0} />
            <Stop
              offset="1"
              stopColor="#060912"
              stopOpacity={wide ? 1 : 0.94}
            />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${fadeId})`} />
      </Svg>

      <View style={styles.badge}>
        <Icon color="#ffffff" size={15} strokeWidth={2.2} />
      </View>

      <View style={wide ? styles.infoWide : styles.info}>
        <Text
          style={styles.name}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {techniqueName(technique)}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.durationPill}>
            <Clock color={accentColor} size={12} strokeWidth={2.4} />
            <Text style={styles.duration}>
              {techniqueDurationLabel(technique)}
            </Text>
          </View>
          <View style={styles.go}>
            <ArrowUpRight color="#0d1020" size={15} strokeWidth={2.6} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  kicker: {
    ...dsSectionHeaderStyle,
    marginTop: 0,
    marginBottom: 0,
  },
  hairline: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  card: {
    borderRadius: RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#0b1220',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  info: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  // Wide card: text hugs the right-hand side, clear of the scene.
  infoWide: {
    position: 'absolute',
    left: '46%',
    right: 14,
    bottom: 14,
  },
  name: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  duration: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  go: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
