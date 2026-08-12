import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import {
  ObBackdrop,
  ObButton,
  ObFooter,
} from '@/components/onboarding/OnboardingChrome';
import {
  dsColors,
  dsFont,
  dsSpacing,
  hexAlpha,
} from '@/constants/designSystem';
import { t } from '@/lib/i18n';

/**
 * Soft block for the "No, under 18" answer. No data is written and there
 * is no route forward into the app — the only action is to go back to
 * the age check. Onboarding stays incomplete, so the next launch returns
 * here rather than dropping an underage user onto the home orb.
 */
export default function BlockedScreen() {
  return (
    <ObBackdrop glowY={300}>
      <View style={styles.main}>
        <View style={styles.emblem}>
          <ShieldAlert
            size={30}
            color={dsColors.textSecondary}
            strokeWidth={1.6}
          />
        </View>
        <Text style={styles.title}>{t('onboarding.blocked.title')}</Text>
        <Text style={styles.body}>{t('onboarding.blocked.body')}</Text>
      </View>

      <ObFooter>
        <ObButton
          label={t('onboarding.blocked.cta')}
          onPress={() => router.back()}
          variant="outline"
          showArrow={false}
        />
      </ObFooter>
    </ObBackdrop>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: dsSpacing.x3l,
    paddingBottom: 120,
  },
  emblem: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
    backgroundColor: hexAlpha(dsColors.cardSurface, 0.6),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: dsSpacing.xl,
  },
  title: {
    fontSize: dsFont.size.displayMd,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    color: dsColors.textPrimary,
  },
  body: {
    marginTop: dsSpacing.lg,
    fontSize: dsFont.size.body,
    lineHeight: 23,
    textAlign: 'center',
    color: dsColors.textSecondary,
    maxWidth: 300,
  },
});
