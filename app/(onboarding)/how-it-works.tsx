import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
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
import { RANK_LADDER } from '@/constants/rankLadder';
import { hapticTap } from '@/lib/haptics';
import { t } from '@/lib/i18n';

/**
 * Onboarding screen 2 of 5 — How It Works. Explains the core loop
 * (craving → tap the orb → hold out → earn points → climb rank) and
 * shows the real rank path pulled from `RANK_LADDER` so the names match
 * the rest of the app byte-for-byte.
 */

const ACCENT = dsColors.accentBlue;

type Step = {
  n: string;
  label: string;
  detail?: string;
  detailColor?: string;
};

export default function HowItWorksScreen() {
  const steps: Step[] = [
    { n: '1', label: t('onboarding.how.step1') },
    { n: '2', label: t('onboarding.how.step2') },
    { n: '3', label: t('onboarding.how.step3'), detail: '02:14' },
    {
      n: '4',
      label: t('onboarding.how.step4'),
      detail: '+12 pts',
      detailColor: dsColors.accentBlue,
    },
  ];

  const onContinue = () => {
    hapticTap();
    router.push('/(onboarding)/choose-focus');
  };

  return (
    <ObBackdrop glowY={220}>
      <ObHeader step={2} onBack={() => router.back()} />

      <View style={styles.main}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{t('onboarding.how.eyebrow')}</Text>
          <Text style={styles.title}>{t('onboarding.how.title')}</Text>
          <Text style={styles.body}>{t('onboarding.how.body')}</Text>
        </View>

        {/* The loop — four numbered steps feeding the RESIST core. */}
        <View style={styles.loopCard}>
          {steps.map((s, i) => {
            const lit = i >= 1;
            return (
              <View key={s.n} style={styles.step}>
                <View
                  style={[
                    styles.badge,
                    lit ? styles.badgeLit : styles.badgeIdle,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: lit ? ACCENT : dsColors.textTertiary },
                    ]}
                  >
                    {s.n}
                  </Text>
                </View>
                <Text style={styles.stepLabel}>{s.label}</Text>
                {s.detail ? (
                  <Text
                    style={[
                      styles.stepDetail,
                      { color: s.detailColor ?? dsColors.textSecondary },
                    ]}
                  >
                    {s.detail}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* The rank path — real ladder, Base highlighted as the start. */}
        <View style={styles.pathCard}>
          <View style={styles.pathHeader}>
            <Text style={styles.pathLabel}>
              {t('onboarding.how.path_label')}
            </Text>
            <Text style={styles.pathStart}>
              {t('onboarding.how.path_start')}
            </Text>
          </View>

          <View style={styles.pathTrack}>
            <View style={styles.pathLine} />
            <View style={styles.pathDot} />
          </View>

          <View style={styles.pathNames}>
            {RANK_LADDER.map((rank, i) => (
              <Text
                key={rank.id}
                style={[styles.pathName, i === 0 && styles.pathNameActive]}
              >
                {rank.name}
              </Text>
            ))}
          </View>
        </View>

        <Text style={styles.footerNote}>{t('onboarding.how.footer')}</Text>
      </View>

      <ObFooter>
        <ObProgress index={1} />
        <ObButton label={t('onboarding.how.cta')} onPress={onContinue} />
      </ObFooter>
    </ObBackdrop>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    paddingHorizontal: dsSpacing.xxl,
    paddingBottom: 168,
  },
  heading: {
    marginTop: dsSpacing.x3l,
    alignItems: 'center',
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
    letterSpacing: -0.6,
    textAlign: 'center',
    color: dsColors.textPrimary,
  },
  body: {
    marginTop: dsSpacing.sm,
    fontSize: dsFont.size.label,
    lineHeight: 20,
    textAlign: 'center',
    color: dsColors.textSecondary,
    maxWidth: 290,
  },
  loopCard: {
    marginTop: dsSpacing.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
    backgroundColor: hexAlpha(dsColors.cardSurface, 0.7),
    paddingVertical: dsSpacing.xs,
    paddingHorizontal: dsSpacing.lg,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: dsSpacing.md,
    gap: dsSpacing.md,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIdle: {
    borderColor: dsColors.borderSubtle,
    backgroundColor: dsColors.cardSurface,
  },
  badgeLit: {
    borderColor: hexAlpha(ACCENT, 0.45),
    backgroundColor: hexAlpha(ACCENT, 0.1),
  },
  badgeText: {
    fontSize: dsFont.size.label,
    fontWeight: '800',
  },
  stepLabel: {
    flex: 1,
    fontSize: dsFont.size.body,
    fontWeight: '600',
    color: dsColors.textPrimary,
  },
  stepDetail: {
    fontSize: dsFont.size.label,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pathCard: {
    marginTop: dsSpacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: dsColors.borderSubtle,
    backgroundColor: hexAlpha(dsColors.cardSurface, 0.7),
    paddingHorizontal: dsSpacing.lg,
    paddingVertical: dsSpacing.lg,
  },
  pathHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pathLabel: {
    fontSize: dsFont.size.tiny,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: dsColors.textSecondary,
  },
  pathStart: {
    fontSize: dsFont.size.tiny,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: ACCENT,
  },
  pathTrack: {
    marginTop: dsSpacing.lg,
    height: 12,
    justifyContent: 'center',
  },
  pathLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: hexAlpha(ACCENT, 0.35),
  },
  pathDot: {
    position: 'absolute',
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ACCENT,
    boxShadow: `0 0 12px ${hexAlpha(ACCENT, 0.7)}`,
  },
  pathNames: {
    marginTop: dsSpacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: dsSpacing.md,
    rowGap: dsSpacing.xs,
  },
  pathName: {
    fontSize: 10,
    fontWeight: '600',
    color: dsColors.textTertiary,
  },
  pathNameActive: {
    color: ACCENT,
    fontWeight: '800',
  },
  footerNote: {
    marginTop: dsSpacing.lg,
    fontSize: dsFont.size.label,
    lineHeight: 20,
    textAlign: 'center',
    color: dsColors.textSecondary,
  },
});
