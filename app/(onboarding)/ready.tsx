import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Activity } from 'lucide-react-native';
import { ADDICTION_CATALOG, toAddiction } from '@/constants/addictions';
import { ResistanceOrb } from '@/components/ResistanceOrb';
import {
  ObBackdrop,
  ObButton,
  ObFooter,
  ObHeader,
} from '@/components/onboarding/OnboardingChrome';
import {
  dsColors,
  dsFont,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';
import { lucideIconFor } from '@/components/info/iconMap';
import { useAddictions } from '@/context/AddictionsContext';
import { markOnboardingCompleted } from '@/lib/onboarding';
import { hapticCelebrate } from '@/lib/haptics';
import { t } from '@/lib/i18n';

/**
 * Onboarding screen 5 of 5 — Ready. The real orb returns as the hero,
 * and "Enter Crave" is where everything is committed: the chosen
 * addiction becomes the sole tracked one and the onboarding + consent
 * record is persisted, before replacing the stack with the home tabs.
 */

const ACCENT = dsColors.accentBlue;

export default function ReadyScreen() {
  const params = useLocalSearchParams<{
    selected?: string;
    consentAt?: string;
  }>();
  const selectedId = params.selected || null;
  const selected = selectedId
    ? toAddiction(
        ADDICTION_CATALOG.find((e) => e.id === selectedId) ??
          ADDICTION_CATALOG[0]
      )
    : null;
  const Icon = selected ? lucideIconFor(selected.id) : null;

  const { setExclusiveAddiction } = useAddictions();
  const [submitting, setSubmitting] = useState(false);

  const onEnter = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (selectedId) {
        await setExclusiveAddiction(selectedId);
      }
      // dob is intentionally blank — the flow uses a binary 18+
      // self-attestation, not a birth date. The consent timestamp from
      // the age screen is the KVKK record.
      await markOnboardingCompleted({
        dob: '',
        consentSignedAt: params.consentAt || new Date().toISOString(),
      });
      hapticCelebrate();
      router.replace('/(tabs)');
    } catch (e) {
      // Don't advance if the pick or the consent record didn't persist —
      // otherwise the user lands with nothing tracked or loops back
      // through onboarding on the next cold launch.
      console.warn('onboarding completion failed', e);
      Alert.alert(
        "Couldn't finish setup",
        'We couldn’t save your choice. Please check your connection and try again.'
      );
      setSubmitting(false);
    }
  };

  return (
    <ObBackdrop glowY={210}>
      <ObHeader step={5} onBack={() => router.back()} />

      <View style={styles.main}>
        {selected && Icon ? (
          <View style={styles.chip}>
            <Icon size={15} color={selected.color} strokeWidth={2.2} />
            <Text style={styles.chipText}>{selected.name}</Text>
          </View>
        ) : null}

        <View style={styles.orbWrap}>
          <ResistanceOrb />
        </View>

        <View style={styles.text}>
          <Text style={styles.eyebrow}>{t('onboarding.ready.eyebrow')}</Text>
          <Text style={styles.title}>{t('onboarding.ready.title')}</Text>
          <Text style={styles.body}>{t('onboarding.ready.body')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardLabel}>
                {t('onboarding.ready.rank_label')}
              </Text>
              <Text style={styles.cardValue}>
                {selected ? `${selected.name} · ` : ''}Base · 0 pts
              </Text>
            </View>
            <View style={styles.cardIcon}>
              <Activity size={18} color={ACCENT} strokeWidth={2} />
            </View>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              {t('onboarding.ready.progress_label')}
            </Text>
            <Text style={styles.progressHint}>
              {t('onboarding.ready.progress_hint')}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>
      </View>

      <ObFooter>
        <ObButton
          label={t('onboarding.ready.cta')}
          onPress={onEnter}
          disabled={submitting}
          variant="outline"
        />
      </ObFooter>
    </ObBackdrop>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: dsSpacing.xxl,
    paddingBottom: 130,
  },
  chip: {
    marginTop: dsSpacing.x3l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: dsSpacing.sm,
    // Above the orb's ambient atmosphere (a later sibling in the tree).
    zIndex: 2,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: hexAlpha(ACCENT, 0.35),
    backgroundColor: hexAlpha(dsColors.cardSurface, 0.7),
    paddingHorizontal: dsSpacing.md,
    paddingVertical: dsSpacing.sm,
  },
  chipText: {
    fontSize: dsFont.size.tiny,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: dsColors.textSecondary,
  },
  orbWrap: {
    marginTop: dsSpacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 76,
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: dsFont.size.tiny,
    fontWeight: '700',
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    color: ACCENT,
  },
  title: {
    marginTop: dsSpacing.md,
    fontSize: dsFont.size.displayXl,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
    color: dsColors.textPrimary,
  },
  body: {
    marginTop: dsSpacing.lg,
    fontSize: dsFont.size.body,
    lineHeight: 22,
    textAlign: 'center',
    color: dsColors.textSecondary,
    maxWidth: 310,
  },
  card: {
    marginTop: dsSpacing.xl,
    alignSelf: 'stretch',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
    backgroundColor: hexAlpha(dsColors.cardSurface, 0.8),
    paddingHorizontal: dsSpacing.xl,
    paddingVertical: dsSpacing.lg,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTextWrap: {
    flex: 1,
    marginRight: dsSpacing.md,
  },
  cardLabel: {
    fontSize: dsFont.size.tiny,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: dsColors.textTertiary,
  },
  cardValue: {
    marginTop: dsSpacing.sm,
    fontSize: dsFont.size.body,
    fontWeight: '700',
    color: dsColors.textPrimary,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: hexAlpha(ACCENT, 0.3),
    backgroundColor: hexAlpha(ACCENT, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    marginTop: dsSpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: dsFont.size.tiny,
    fontWeight: '700',
    color: dsColors.textSecondary,
  },
  progressHint: {
    fontSize: dsFont.size.tiny,
    fontWeight: '700',
    color: ACCENT,
  },
  progressTrack: {
    marginTop: dsSpacing.sm,
    height: 6,
    borderRadius: 3,
    backgroundColor: dsColors.cardSurfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '2%',
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
});
