import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Flag, Sunrise } from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { compColors, compHexAlpha } from './comparisonTheme';
import { DistributionCard } from './DistributionCard';
import { PatternCard } from './PatternCard';
import type { DistributionMetric, PatternsData } from './__mockData';

/**
 * Launch state — shown when there aren't enough community members
 * yet to compute meaningful aggregates. Design brief:
 * "yapı/söz var, sahte sayı yok. Hayalet kartlar + 'The lookout
 * before sunrise' + tek gerçek sayı ('first 500 resisters')".
 *
 * Two heavily blurred preview cards (a real distribution card and a
 * real pattern card, on neutral shape-only values) show what's coming
 * (so the layout doesn't feel empty), then a centered sunrise
 * hero card announces the honest state + the one real fact we
 * can share.
 */

/**
 * Shape-only preview for the launch state. These cards are NOT data:
 * they exist so the user sees what the comparison will look like once the
 * community fills in. Values are neutral and the blur is strong enough
 * that nothing on them reads as a real number.
 */
const PREVIEW_BLUR = 34;
const PREVIEW_METRIC: DistributionMetric = {
  key: 'resistance_rate',
  labelKey: 'comparison.metric.resistance_rate',
  icon: 'shield-check',
  youNum: 60,
  suffix: '%',
  avg: 55,
  avgLabel: '55%',
  sd: 15,
  tone: 'good',
  deltaLabel: '+5 pts',
};
const PREVIEW_PATTERNS: PatternsData = {
  clock: { startHour: 19, endHour: 22, sharePct: 30 },
  wave: { techniqueLabel: '', successPct: 0 },
  bar: { values: [1, 1, 1, 1, 1, 1, 1], hardestDayIdx: 0, labels: [] },
};

type Props = {
  addiction: Addiction;
  count: number; // "first N resisters"
};

export function LaunchState({ addiction, count }: Props) {
  const accent = addiction.color;
  const alpha = (a: number) => compHexAlpha(accent, a);

  return (
    <View>
      {/* Blurred/dim ghost cards — pure decorative shapes so the
          user can see the shape of what's coming without any real
          numbers. */}
      <View style={styles.ghostStack} pointerEvents="none">
        <DistributionCard
          metric={PREVIEW_METRIC}
          addiction={addiction}
          index={0}
          locked
          lockedIntensity={PREVIEW_BLUR}
        />
        <PatternCard
          kind="clock"
          data={PREVIEW_PATTERNS}
          addiction={addiction}
          index={1}
          locked
          lockedIntensity={PREVIEW_BLUR}
        />
      </View>

      {/* Sunrise hero */}
      <View
        style={[
          styles.hero,
          {
            borderColor: 'rgba(255,255,255,0.08)',
          },
        ]}
      >
        <View pointerEvents="none" style={styles.heroHalo}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient
                id="launchHeroHalo"
                cx="50"
                cy="50"
                rx="50"
                ry="50"
                fx="50"
                fy="50"
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0%" stopColor={accent} stopOpacity={0.26} />
                <Stop offset="60%" stopColor={accent} stopOpacity={0.1} />
                <Stop offset="100%" stopColor={accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100"
              height="100"
              fill="url(#launchHeroHalo)"
            />
          </Svg>
        </View>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: alpha(0.14),
              borderColor: alpha(0.34),
            },
          ]}
        >
          <Sunrise size={24} color={accent} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>{t('comparison.launch_title')}</Text>
        <Text style={styles.body}>{t('comparison.launch_body')}</Text>
        <View
          style={[
            styles.chip,
            {
              backgroundColor: alpha(0.12),
              borderColor: alpha(0.3),
            },
          ]}
        >
          <Flag size={12} color={compColors.textSecondary} strokeWidth={2.4} />
          <Text style={styles.chipText}>
            {t('comparison.launch_chip', { count })}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ghostStack: {
    gap: 11,
    opacity: 0.85,
    ...Platform.select({
      web: {
        filter: 'blur(2px)',
      } as any,
      default: {},
    }),
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: 16,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#101a30',
    borderWidth: 1,
  },
  heroHalo: {
    position: 'absolute',
    top: -60,
    left: '50%',
    marginLeft: -75,
    width: 150,
    height: 150,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginTop: 14,
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    fontWeight: '500',
    color: compColors.textSecondary,
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dbe4f0',
  },
});
