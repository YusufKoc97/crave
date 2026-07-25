import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import {
  ADDICTION_CATALOG,
  type AddictionCategory,
} from '@/constants/addictions';
import { GlowDisc } from '@/components/ui/GlowDisc';
import {
  LoadoutPanel,
  type SlotItem,
} from '@/components/addictionPicker/LoadoutPanel';
import { PoolToken } from '@/components/addictionPicker/PoolToken';
import {
  ADDICTION_ICON,
  pickerColors,
  pickerLayout,
  pickerRadius,
} from '@/components/addictionPicker/pickerTheme';
import { hexAlpha } from '@/constants/designSystem';
import { useAddictions } from '@/context/AddictionsContext';
import { hapticTap, hapticWarn } from '@/lib/haptics';
import { t } from '@/lib/i18n';

/**
 * Add / remove addictions — the "socket loadout" sheet.
 *
 * Replaces the old flat card list, whose free-tier ceiling was a blue
 * info banner nobody read. Here the ceiling is the layout: the LOADOUT
 * panel renders one socket per slot the user is entitled to, and
 * equipping is a physical move from the pool into a socket.
 *
 * Three corrections to the design handoff, which was authored without
 * the app's data model:
 *
 * 1. **Slot count is live.** The handoff hardcodes four sockets and a
 *    "Equip up to four" subtitle. The real ceiling is
 *    `useAddictions().limit` — 1 on free, 5 on premium — so both are
 *    derived, and `socketSizeFor()` caps socket width so a single free
 *    slot doesn't inflate into one giant square.
 * 2. **Ids and colours come from `ADDICTION_CATALOG`.** The prototype
 *    invented `junkfood` / `porn` / `doomscrolling` / `games` and its
 *    own desaturated hexes. Using the catalog keeps a token the same
 *    colour as that addiction's orb on the home screen.
 * 3. **The sheet stays open after an equip.** The old screen called
 *    `router.back()` on success; that made sense for a one-shot list
 *    but fights a loadout editor, where swapping means unequip →
 *    equip in the same breath.
 *
 * Unequipping is immediate, with no confirmation dialog — unlike the
 * long-press delete on the home screen. That's deliberate:
 * `removeAddiction` is a soft delete (history is preserved server-side
 * and re-adding restores it), and on the free tier "swap what I'm
 * tracking" is the primary job of this screen. A modal per swap would
 * turn a one-tap action into three.
 */

const CATEGORY_ORDER: AddictionCategory[] = [
  'substance',
  'behavioral',
  'digital',
];

/** How long a failed add/remove stays on the hint line. */
const ERROR_TTL_MS = 4000;

export default function AddictionPickerScreen() {
  const {
    activeIds,
    addictions,
    limit,
    atLimit,
    addAddiction,
    removeAddiction,
  } = useAddictions();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const [freshId, setFreshId] = useState<string | null>(null);
  const [rejectSignal, setRejectSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), ERROR_TTL_MS);
    return () => clearTimeout(id);
  }, [error]);

  const panelWidth = width - pickerLayout.pagePadding * 2;
  const columnWidth =
    (panelWidth - pickerLayout.poolColumnGap * (pickerLayout.poolColumns - 1)) /
    pickerLayout.poolColumns;

  const slots: SlotItem[] = useMemo(
    () =>
      addictions.map((a) => ({
        id: a.id,
        name: a.name,
        hue: a.color,
        Icon: ADDICTION_ICON[a.id],
      })),
    [addictions]
  );

  const pool = useMemo(() => {
    const byCat: Record<AddictionCategory, typeof ADDICTION_CATALOG> = {
      substance: [],
      behavioral: [],
      digital: [],
    };
    for (const entry of ADDICTION_CATALOG) {
      if (activeIds.has(entry.id)) continue;
      byCat[entry.category] = [...byCat[entry.category], entry];
    }
    return byCat;
  }, [activeIds]);

  const categoryTotals = useMemo(() => {
    const totals: Record<AddictionCategory, number> = {
      substance: 0,
      behavioral: 0,
      digital: 0,
    };
    for (const entry of ADDICTION_CATALOG) totals[entry.category] += 1;
    return totals;
  }, []);

  const onEquip = async (id: string) => {
    if (atLimit) {
      // No sentence, no dialog — the panel refuses in place.
      hapticWarn();
      setRejectSignal((s) => s + 1);
      return;
    }
    hapticTap();
    setError(null);
    setFreshId(id);
    try {
      await addAddiction(id);
    } catch (e) {
      setFreshId(null);
      setError((e as Error).message);
    }
  };

  const onUnequip = (id: string) => {
    hapticTap();
    setError(null);
    if (freshId === id) setFreshId(null);
    void removeAddiction(id);
  };

  // Holding more than the plan allows is reachable — a premium
  // subscription lapsing leaves the extra addictions tracked. Say so
  // plainly instead of claiming they have one slot while four sockets
  // are on screen.
  const subtitle =
    slots.length > limit
      ? t('picker.subtitle_over', { count: slots.length, limit })
      : limit === 1
        ? t('picker.subtitle_one')
        : t('picker.subtitle_many', { count: limit });

  const hint = atLimit
    ? t('picker.hint_full')
    : slots.length > 0
      ? t('picker.hint_unequip')
      : t('picker.hint_first');

  return (
    <View style={styles.root}>
      {/* Page wash. A GlowDisc, not a CSS radial-gradient — the latter
          is web-only and leaves the sheet flat black on device. */}
      <GlowDisc
        leftPct={50}
        topPct={0}
        size={width * 1.9}
        color={hexAlpha(pickerColors.bgLift, 0.9)}
      />

      <View style={styles.header}>
        <View style={styles.grabber} />
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t('picker.title')}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            style={styles.closeBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('picker.close_a11y')}
          >
            <X size={20} strokeWidth={2} color={pickerColors.closeGlyph} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LoadoutPanel
          width={panelWidth}
          limit={limit}
          slots={slots}
          freshId={freshId}
          rejectSignal={rejectSignal}
          reduced={reduced}
          error={error}
          onUnequip={onUnequip}
          labels={{
            loadout: t('picker.loadout'),
            free: t('picker.slots_free', { total: limit }),
            next: t('picker.socket_next'),
            empty: t('picker.socket_empty'),
            hint,
            unequipA11y: (name) => t('picker.unequip_a11y', { name }),
          }}
        />

        {CATEGORY_ORDER.map((cat) => {
          const list = pool[cat];
          if (list.length === 0) return null;
          return (
            <View key={cat}>
              <View style={styles.catRow}>
                <Text style={styles.catLabel}>
                  {t(`categories.${cat}`).toUpperCase()}
                </Text>
                <View style={styles.catPill}>
                  <Text style={styles.catPillText}>
                    {t('picker.category_count', {
                      shown: list.length,
                      total: categoryTotals[cat],
                    })}
                  </Text>
                </View>
                <View style={styles.catHairline} />
              </View>
              <View style={styles.grid}>
                {list.map((entry, i) => {
                  const name = t(`addictions.${entry.id}.name`);
                  return (
                    <PoolToken
                      key={entry.id}
                      name={name}
                      hue={entry.color}
                      Icon={ADDICTION_ICON[entry.id]}
                      locked={atLimit}
                      index={i}
                      reduced={reduced}
                      width={columnWidth}
                      a11yLabel={
                        atLimit
                          ? t('picker.locked_a11y', { name })
                          : t('picker.equip_a11y', { name })
                      }
                      onPress={() => void onEquip(entry.id)}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: pickerColors.bgBase,
    overflow: 'hidden',
  },
  header: {
    // `relative` puts the header in the same paint layer as the
    // absolutely-positioned page wash behind it — without it, web
    // paints the wash on top. See Socket.tsx `centerGlyph`.
    position: 'relative',
    paddingTop: Platform.OS === 'android' ? 38 : 14,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: pickerColors.hairline,
    backgroundColor: pickerColors.headerBg,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: pickerColors.title,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: pickerColors.subtitle,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: pickerRadius.close,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scroll: {
    position: 'relative',
    flex: 1,
  },
  scrollContent: {
    paddingTop: 18,
    paddingHorizontal: pickerLayout.pagePadding,
    paddingBottom: 34,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 24,
    marginBottom: 14,
  },
  catLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.4,
    color: pickerColors.sectionLabel,
  },
  catPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: pickerRadius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  catPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: pickerColors.counter,
  },
  catHairline: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: pickerLayout.poolColumnGap,
    rowGap: pickerLayout.poolRowGap,
  },
});
