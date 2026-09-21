import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Flag, Sunrise } from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { compColors, compHexAlpha } from './comparisonTheme';
import { DistributionCard } from './DistributionCard';
import { PatternCard } from './PatternCard';
import { StandingCard } from './StandingCard';
import type {
  DistributionMetric,
  PatternsData,
  StandingData,
} from './__mockData';

/**
 * Launch state — shown when there aren't enough community members
 * yet to compute meaningful aggregates. Design brief:
 * "yapı/söz var, sahte sayı yok. Hayalet kartlar + 'The lookout
 * before sunrise' + tek gerçek sayı ('first 500 resisters')".
 *
 * A centered sunrise hero announces the honest state + the one real
 * fact we can share (and, for free users, the paywall CTA — kept on top
 * so it's never buried), followed by EVERY card of the full tab as a
 * heavily blurred, shape-only preview so the layout doesn't feel empty.
 */

/**
 * Shape-only preview for the launch state. These cards are NOT data:
 * they exist so the user sees what the comparison will look like once the
 * community fills in. Values are neutral and the blur is strong enough
 * that nothing on them reads as a real number.
 */
const PREVIEW_BLUR = 34;
const PREVIEW_METRICS: DistributionMetric[] = [
  {
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
  },
  {
    key: 'hold_out',
    labelKey: 'comparison.metric.hold_out',
    icon: 'timer',
    youNum: 10,
    unit: 'min',
    avg: 9,
    avgLabel: '9 min',
    sd: 5,
    tone: 'good',
    deltaLabel: '+1 min',
  },
  {
    key: 'cravings_week',
    labelKey: 'comparison.metric.cravings_week',
    icon: 'activity',
    youNum: 12,
    avg: 12,
    avgLabel: '12',
    sd: 6,
    tone: 'neutral',
    deltaLabel: 'on par',
    note: 'comparison.cravings_note',
  },
];
const PREVIEW_STANDING: StandingData = { percentPos: 62, tone: 'high' };
const PREVIEW_PATTERNS: PatternsData = {
  clock: { startHour: 19, endHour: 22, sharePct: 30 },
  wave: { techniqueLabel: 'Urge Surfing', successPct: 60 },
  bar: {
    values: [4, 7, 5, 6, 8, 3, 2],
    hardestDayIdx: 4,
    labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  },
};

type Props = {
  addiction: Addiction;
  count: number; // "first N resisters"
  /** Free users get a paywall CTA; omit for premium (nothing to unlock). */
  onUpgrade?: () => void;
};

export function LaunchState({ addiction, count, onUpgrade }: Props) {
  const accent = addiction.color;
  const alpha = (a: number) => compHexAlpha(accent, a);

  return (
    <View>
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
        {onUpgrade ? (
          <Pressable
            onPress={onUpgrade}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={t('comparison.free_cta')}
          >
            <Text style={styles.ctaText}>{t('comparison.free_cta')}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Every card of the full tab, blurred: shapes only, no real
          numbers. Order mirrors the FULL layout. */}
      <View pointerEvents="none">
        <SectionHeader label={t('comparison.you_vs_community')} />
        <View style={styles.previewStack}>
          {PREVIEW_METRICS.map((metric, i) => (
            <DistributionCard
              key={metric.key}
              metric={metric}
              addiction={addiction}
              index={i}
              locked
              lockedIntensity={PREVIEW_BLUR}
            />
          ))}
        </View>
        <View style={styles.standingWrap}>
          <StandingCard
            addiction={addiction}
            data={PREVIEW_STANDING}
            locked
            lockedIntensity={PREVIEW_BLUR}
          />
        </View>
        <SectionHeader label={t('comparison.community_patterns')} />
        <View style={styles.previewStack}>
          {(['clock', 'wave', 'bar'] as const).map((kind, i) => (
            <PatternCard
              key={kind}
              kind={kind}
              data={PREVIEW_PATTERNS}
              addiction={addiction}
              index={i}
              locked
              lockedIntensity={PREVIEW_BLUR}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionKicker}>{label}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

const styles = StyleSheet.create({
  previewStack: {
    gap: 11,
    opacity: 0.9,
  },
  standingWrap: {
    marginTop: 20,
    opacity: 0.9,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 26,
    marginBottom: 12,
  },
  sectionKicker: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 2.3,
    color: compColors.textMuted,
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(154,163,184,0.16)',
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
  cta: {
    marginTop: 18,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#c2cad8',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 22px -8px rgba(154,163,184,0.7)',
      },
      default: {
        shadowColor: compColors.community,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
      },
    }),
  },
  ctaText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#12172a',
  },
});
