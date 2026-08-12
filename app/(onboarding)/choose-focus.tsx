import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { ADDICTION_CATALOG, toAddiction } from '@/constants/addictions';
import {
  ObBackdrop,
  ObButton,
  ObFooter,
  ObHeader,
  ObProgress,
} from '@/components/onboarding/OnboardingChrome';
import {
  dsColors,
  dsFont,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';
import { lucideIconFor } from '@/components/info/iconMap';
import { hapticTap } from '@/lib/haptics';
import { t } from '@/lib/i18n';

/**
 * Onboarding screen 3 of 5 — Choose your first focus. The grid is built
 * from the REAL 10-item `ADDICTION_CATALOG` (ids, lucide icons, and
 * per-addiction accent colors), not FireVibe's hardcoded nine. The pick
 * is carried forward as a route param and only committed to tracking on
 * the final "Enter Crave".
 */

const ACCENT = dsColors.accentBlue;

export default function ChooseFocusScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId
    ? toAddiction(
        ADDICTION_CATALOG.find((e) => e.id === selectedId) ??
          ADDICTION_CATALOG[0]
      )
    : null;

  const onContinue = () => {
    if (!selectedId) return;
    hapticTap();
    router.push({
      pathname: '/(onboarding)/age-check',
      params: { selected: selectedId },
    });
  };

  return (
    <ObBackdrop glowY={160}>
      <ObHeader step={3} onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{t('onboarding.focus.eyebrow')}</Text>
          <Text style={styles.title}>{t('onboarding.focus.title')}</Text>
          <Text style={styles.body}>{t('onboarding.focus.body')}</Text>
        </View>

        <View style={styles.grid}>
          {ADDICTION_CATALOG.map((entry) => {
            const a = toAddiction(entry);
            const Icon = lucideIconFor(a.id);
            const isSel = a.id === selectedId;
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  hapticTap();
                  setSelectedId(a.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                style={[styles.tile, isSel && styles.tileSelected]}
              >
                {isSel && (
                  <View style={styles.check}>
                    <Check size={13} color="#06111F" strokeWidth={3} />
                  </View>
                )}
                <View
                  style={[
                    styles.iconWrap,
                    {
                      borderColor: hexAlpha(a.color, isSel ? 0.7 : 0.45),
                      backgroundColor: hexAlpha(a.color, 0.12),
                    },
                  ]}
                >
                  <Icon size={22} color={a.color} strokeWidth={2} />
                </View>
                <Text style={styles.tileName} numberOfLines={1}>
                  {a.name}
                </Text>
                {isSel && (
                  <Text style={styles.tileRank}>
                    {t('onboarding.focus.rank_pill')}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <ObFooter>
        <View style={styles.selectedRow}>
          <View style={styles.selectedTextWrap}>
            <Text style={styles.selectedLabel}>
              {t('onboarding.focus.selected_label')}
            </Text>
            <Text style={styles.selectedName} numberOfLines={1}>
              {selected ? selected.name : t('onboarding.focus.none_selected')}
            </Text>
          </View>
          {selected && (
            <View style={styles.rankPill}>
              <Text style={styles.rankPillText}>
                {t('onboarding.focus.rank_pill')}
              </Text>
            </View>
          )}
        </View>

        <ObProgress index={2} />
        <ObButton
          label={
            selected
              ? t('onboarding.focus.cta', { name: selected.name })
              : t('onboarding.focus.cta_empty')
          }
          onPress={onContinue}
          disabled={!selected}
        />
      </ObFooter>
    </ObBackdrop>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: dsSpacing.xxl,
    paddingTop: dsSpacing.xl,
    paddingBottom: 260,
  },
  heading: {
    maxWidth: 340,
  },
  eyebrow: {
    fontSize: dsFont.size.tiny,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: ACCENT,
  },
  title: {
    marginTop: dsSpacing.md,
    fontSize: dsFont.size.displayMd,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 34,
    color: dsColors.textPrimary,
  },
  body: {
    marginTop: dsSpacing.md,
    fontSize: dsFont.size.body,
    lineHeight: 22,
    color: dsColors.textSecondary,
  },
  grid: {
    marginTop: dsSpacing.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: dsSpacing.md,
  },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    minHeight: 128,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
    backgroundColor: hexAlpha(dsColors.cardSurface, 0.55),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: dsSpacing.lg,
    paddingHorizontal: dsSpacing.md,
  },
  tileSelected: {
    borderColor: ACCENT,
    backgroundColor: hexAlpha(ACCENT, 0.08),
    boxShadow: `0 0 30px ${hexAlpha(ACCENT, 0.15)}`,
  },
  check: {
    position: 'absolute',
    top: dsSpacing.md,
    right: dsSpacing.md,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 14px ${hexAlpha(ACCENT, 0.7)}`,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: dsSpacing.md,
  },
  tileName: {
    fontSize: dsFont.size.body,
    fontWeight: '700',
    color: dsColors.textPrimary,
  },
  tileRank: {
    marginTop: dsSpacing.xs,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: ACCENT,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: dsSpacing.lg,
  },
  selectedTextWrap: {
    flex: 1,
    marginRight: dsSpacing.md,
  },
  selectedLabel: {
    fontSize: dsFont.size.tiny,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: dsColors.textTertiary,
  },
  selectedName: {
    marginTop: dsSpacing.xs,
    fontSize: dsFont.size.body,
    fontWeight: '700',
    color: dsColors.textPrimary,
  },
  rankPill: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: hexAlpha(ACCENT, 0.3),
    backgroundColor: hexAlpha(ACCENT, 0.1),
    paddingHorizontal: dsSpacing.md,
    paddingVertical: 6,
  },
  rankPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: ACCENT,
  },
});
