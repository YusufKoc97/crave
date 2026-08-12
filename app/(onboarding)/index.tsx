import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ResistanceOrb } from '@/components/ResistanceOrb';
import {
  ObBackdrop,
  ObButton,
  ObFooter,
  ObHeader,
  ObProgress,
} from '@/components/onboarding/OnboardingChrome';
import { dsColors, dsFont, dsSpacing } from '@/constants/designSystem';
import { hapticTap } from '@/lib/haptics';
import { t } from '@/lib/i18n';

/**
 * Onboarding screen 1 of 5 — Welcome. The real resistance orb (the same
 * component the home screen mounts) is the hero, so the very first thing
 * the user sees is the exact orb they'll tap during a craving.
 */
export default function WelcomeScreen() {
  const onBegin = () => {
    hapticTap();
    router.push('/(onboarding)/how-it-works');
  };

  return (
    <ObBackdrop glowY={300}>
      <ObHeader step={1} />

      <View style={styles.main}>
        <Text style={styles.brand}>{t('onboarding.welcome.brand')}</Text>

        <View style={styles.orbWrap}>
          <ResistanceOrb />
        </View>

        <View style={styles.text}>
          <Text style={styles.eyebrow}>{t('onboarding.welcome.eyebrow')}</Text>
          <Text style={styles.title}>{t('onboarding.welcome.title')}</Text>
          <Text style={styles.body}>{t('onboarding.welcome.body')}</Text>
        </View>
      </View>

      <ObFooter>
        <ObProgress index={0} />
        <ObButton label={t('onboarding.welcome.cta')} onPress={onBegin} />
      </ObFooter>
    </ObBackdrop>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 168,
  },
  brand: {
    marginTop: dsSpacing.xl,
    fontSize: dsFont.size.tiny,
    fontWeight: '800',
    letterSpacing: 6,
    color: dsColors.textSecondary,
    // Sits above the orb's ambient atmosphere, which is a later sibling
    // and would otherwise paint over the wordmark.
    zIndex: 2,
  },
  orbWrap: {
    marginTop: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 84,
    alignItems: 'center',
    maxWidth: 336,
  },
  eyebrow: {
    fontSize: dsFont.size.tiny,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: dsColors.accentBlue,
  },
  title: {
    marginTop: dsSpacing.lg,
    fontSize: dsFont.size.displayLg,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
    textAlign: 'center',
    color: dsColors.textPrimary,
  },
  body: {
    marginTop: dsSpacing.lg,
    fontSize: dsFont.size.body,
    lineHeight: 22,
    textAlign: 'center',
    color: dsColors.textSecondary,
    maxWidth: 285,
  },
});
