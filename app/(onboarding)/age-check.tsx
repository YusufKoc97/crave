import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Check, Minus } from 'lucide-react-native';
import { ADDICTION_CATALOG, toAddiction } from '@/constants/addictions';
import {
  ObBackdrop,
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
import { hapticTap, hapticWarn } from '@/lib/haptics';
import { t } from '@/lib/i18n';

/**
 * Onboarding screen 4 of 5 — Age check. A binary 18+ self-attestation
 * (FireVibe's design) with the KVKK / health-data consent folded in:
 * "Yes, I'm 18+" only proceeds once the required consent is checked, so
 * age and consent are captured together. "No" routes to a soft block.
 */

const ACCENT = dsColors.accentBlue;

export default function AgeCheckScreen() {
  const params = useLocalSearchParams<{ selected?: string }>();
  const selectedId = params.selected;
  const selected = selectedId
    ? toAddiction(
        ADDICTION_CATALOG.find((e) => e.id === selectedId) ??
          ADDICTION_CATALOG[0]
      )
    : null;

  const [consent, setConsent] = useState(false);
  const [showConsentHint, setShowConsentHint] = useState(false);

  const onYes = () => {
    if (!consent) {
      setShowConsentHint(true);
      hapticWarn();
      return;
    }
    hapticTap();
    router.push({
      pathname: '/(onboarding)/ready',
      params: {
        selected: selectedId ?? '',
        consentAt: new Date().toISOString(),
      },
    });
  };

  const onNo = () => {
    hapticTap();
    router.push('/(onboarding)/blocked');
  };

  return (
    <ObBackdrop glowY={320}>
      <ObHeader step={4} onBack={() => router.back()} />

      <View style={styles.main}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{t('onboarding.age.eyebrow')}</Text>
          {selected ? (
            <Text style={styles.selected}>{selected.name}</Text>
          ) : null}
          <Text style={styles.title}>{t('onboarding.age.title')}</Text>
          <Text style={styles.body}>{t('onboarding.age.body')}</Text>
        </View>

        {/* Folded KVKK / health-data consent — required before "Yes". */}
        <Pressable
          onPress={() => {
            setConsent((v) => !v);
            setShowConsentHint(false);
            hapticTap();
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          style={[styles.consent, consent && styles.consentChecked]}
        >
          <View style={[styles.checkbox, consent && styles.checkboxOn]}>
            {consent && <Check size={13} color="#06111F" strokeWidth={3} />}
          </View>
          <View style={styles.consentTextWrap}>
            <Text style={styles.consentTitle}>
              {t('onboarding.age.consent_title')}
            </Text>
            <Text style={styles.consentBody}>
              {t('onboarding.age.consent_body')}
            </Text>
          </View>
        </Pressable>

        {showConsentHint && (
          <Text style={styles.consentHint}>
            {t('onboarding.age.consent_required')}
          </Text>
        )}

        <View style={styles.choices}>
          <Pressable
            onPress={onYes}
            accessibilityRole="button"
            style={[
              styles.choice,
              consent ? styles.choiceYes : styles.choiceYesIdle,
            ]}
          >
            <Text
              style={[
                styles.choiceText,
                {
                  color: consent
                    ? dsColors.textPrimary
                    : dsColors.textSecondary,
                },
              ]}
            >
              {t('onboarding.age.yes')}
            </Text>
            <View style={[styles.choiceIcon, consent && styles.choiceIconOn]}>
              <ArrowRight
                size={17}
                color={consent ? ACCENT : dsColors.textTertiary}
                strokeWidth={2.2}
              />
            </View>
          </Pressable>

          <Pressable
            onPress={onNo}
            accessibilityRole="button"
            style={styles.choiceNo}
          >
            <Text style={styles.choiceNoText}>{t('onboarding.age.no')}</Text>
            <Minus size={17} color={dsColors.textTertiary} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      <ObFooter>
        <ObProgress index={3} />
      </ObFooter>
    </ObBackdrop>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    paddingHorizontal: dsSpacing.xxl,
    paddingBottom: 120,
  },
  heading: {
    marginTop: 90,
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: dsFont.size.tiny,
    fontWeight: '700',
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    color: ACCENT,
  },
  selected: {
    marginTop: dsSpacing.md,
    fontSize: dsFont.size.label,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: dsColors.textSecondary,
  },
  title: {
    marginTop: dsSpacing.xl,
    fontSize: dsFont.size.displayXl,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
    textAlign: 'center',
    color: dsColors.textPrimary,
  },
  body: {
    marginTop: dsSpacing.md,
    fontSize: dsFont.size.body,
    lineHeight: 22,
    textAlign: 'center',
    color: dsColors.textSecondary,
    maxWidth: 245,
  },
  consent: {
    marginTop: dsSpacing.x3l,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: dsSpacing.md,
    padding: dsSpacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
    backgroundColor: hexAlpha(dsColors.cardSurface, 0.5),
  },
  consentChecked: {
    borderColor: ACCENT,
    backgroundColor: hexAlpha(ACCENT, 0.08),
    boxShadow: `0 0 12px ${hexAlpha(ACCENT, 0.2)}`,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: dsColors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  consentTextWrap: {
    flex: 1,
  },
  consentTitle: {
    fontSize: dsFont.size.label,
    fontWeight: '700',
    color: dsColors.textPrimary,
    lineHeight: 18,
  },
  consentBody: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: dsColors.textSecondary,
  },
  consentHint: {
    marginTop: dsSpacing.md,
    fontSize: dsFont.size.label,
    fontWeight: '600',
    color: dsColors.dangerGlow,
    textAlign: 'center',
  },
  choices: {
    marginTop: dsSpacing.xl,
    gap: dsSpacing.md,
  },
  choice: {
    minHeight: 68,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: dsSpacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceYes: {
    borderColor: hexAlpha(ACCENT, 0.65),
    backgroundColor: hexAlpha(dsColors.cardSurfaceElevated, 0.6),
    boxShadow: `0 0 24px ${hexAlpha(ACCENT, 0.1)}`,
  },
  choiceYesIdle: {
    borderColor: dsColors.borderSubtle,
    backgroundColor: hexAlpha(dsColors.cardSurface, 0.5),
  },
  choiceText: {
    fontSize: dsFont.size.body,
    fontWeight: '700',
  },
  choiceIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIconOn: {
    borderColor: hexAlpha(ACCENT, 0.5),
    backgroundColor: hexAlpha(ACCENT, 0.1),
  },
  choiceNo: {
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
    backgroundColor: hexAlpha(dsColors.bgBase, 0.45),
    paddingHorizontal: dsSpacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceNoText: {
    fontSize: dsFont.size.body,
    fontWeight: '600',
    color: dsColors.textSecondary,
  },
});
