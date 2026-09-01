import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import {
  techniquesForAddiction,
  type Technique,
} from '@/constants/toolkitCatalog';
import { GlassSegmentedControl, type ToolkitSegment } from './CarouselChrome';
import { ToolkitCarousel } from './ToolkitCarousel';
import { ToolkitAurora } from './ToolkitAurora';
import { CardScene } from './previews/CardScene';
import { CARD_H, FONT_STACK, TEXT_SUBTITLE, TEXT_TITLE } from './carouselStyle';
import { useToolkitFavorites } from '@/lib/useToolkitFavorites';
import { dsSectionHeaderStyle, dsSpacing } from '@/constants/designSystem';
import { t } from '@/lib/i18n';

/**
 * Toolkit sub-tab pane — Info-tab context (karar #7A).
 *
 * Sits inside the addiction detail screen, which already provides:
 *   - Nicotine header + back button (top)
 *   - Glass-pill sub-tab bar (Journey/Toolkit/Triggers/Comparison)
 *   - AmbientGlow atmospheric background layers
 *
 * So this pane does NOT re-render its own back button or "Toolkit"
 * title — those would be redundant. Instead it opens with a
 * Journey-parallel section kicker ("TRY DURING A CRAVING"), the
 * segment control, and the carousel — same information hierarchy
 * the Journey tab uses ("THE PATH" → visualization).
 *
 * Holds `focusedIndex` state so the carousel + preview slot stay
 * in sync. Only the focused card mounts its animated preview
 * (karar #4B).
 *
 * The "Favorites" segment narrows the deck to the techniques the
 * user has starred (per-device, via useToolkitFavorites). When the
 * favorites deck is empty the pane shows a gentle prompt rather than
 * an empty carousel.
 */

type Props = {
  accentColor: string;
  /** Whose toolkit this is — decides which techniques are offered. */
  addictionId?: string | null;
  onSelect: (technique: Technique) => void;
};

// Every technique gets a bespoke constellation scene (CardScene). The
// focused card's chart pulses; neighbours hold a fixed frame — same art,
// no empty gradients, animation cost constant.
function pickPreview(techniqueId: string, animate: boolean): React.ReactNode {
  return <CardScene techniqueId={techniqueId} animate={animate} />;
}

export function ToolkitPane({ accentColor, addictionId, onSelect }: Props) {
  const [segment, setSegment] = useState<ToolkitSegment>('all');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const { favorites } = useToolkitFavorites();

  const offered = useMemo(
    () => techniquesForAddiction(addictionId),
    [addictionId]
  );
  const favoriteFilter = useCallback(
    (tech: Technique) => favorites.has(tech.id),
    [favorites]
  );
  const favoritesOffered = useMemo(
    () => offered.filter((tech) => favorites.has(tech.id)),
    [offered, favorites]
  );

  const onFavorites = segment === 'favorites';
  const favoritesEmpty = onFavorites && favoritesOffered.length === 0;

  // Remount key: on Favorites it changes with the deck size so the
  // carousel resets to the first card when the user stars/unstars while
  // viewing it (no stranded index, scroll snaps back to 0). On All it
  // stays constant so favoriting a card there preserves scroll position.
  const carouselKey = onFavorites ? `fav-${favoritesOffered.length}` : 'all';

  // Keep the parent-owned focus index in range whenever the rendered
  // deck is rebuilt (segment switch or a favorites edit).
  useEffect(() => {
    setFocusedIndex(0);
  }, [carouselKey]);

  return (
    <View style={styles.root}>
      {/* Subtle aurora layer behind everything — a whisper of
          colour so the pane doesn't read as bare next to the
          Journey PATH scene. Sits BELOW all content (z-order
          via render order in RN). */}
      <ToolkitAurora />

      {/* Section kicker — matches Journey's "THE PATH" pattern
          so the two tabs read as one visual family. */}
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>{t('toolkit.section_kicker')}</Text>
        <View style={styles.hairline} />
      </View>

      <GlassSegmentedControl active={segment} onChange={setSegment} />

      {favoritesEmpty ? (
        <FavoritesEmpty />
      ) : (
        <ToolkitCarousel
          // Remount when the rendered deck changes so scroll offset +
          // scale interpolation reset to the first card.
          key={carouselKey}
          accentColor={accentColor}
          addictionId={addictionId}
          onSelect={onSelect}
          focusedIndex={focusedIndex}
          onIndexChange={setFocusedIndex}
          filter={onFavorites ? favoriteFilter : undefined}
          renderPreview={(tech, animate) => pickPreview(tech.id, animate)}
        />
      )}
    </View>
  );
}

/** Shown when the Favorites segment is active but nothing is starred
 *  yet for this addiction. Keeps the pane height stable (≈ card height)
 *  so switching segments doesn't make the layout jump. */
function FavoritesEmpty() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconRing}>
        <Heart color={TEXT_SUBTITLE} size={26} strokeWidth={2} />
      </View>
      <Text style={styles.emptyTitle}>
        {t('toolkit.favorites_empty_title')}
      </Text>
      <Text style={styles.emptyHint}>{t('toolkit.favorites_empty_hint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: dsSpacing.xl,
    marginBottom: dsSpacing.md,
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
  emptyWrap: {
    height: CARD_H,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  emptyIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 18,
  },
  emptyTitle: {
    color: TEXT_TITLE,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FONT_STACK,
    marginBottom: 8,
  },
  emptyHint: {
    color: TEXT_SUBTITLE,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FONT_STACK,
    textAlign: 'center',
    lineHeight: 20,
  },
});
