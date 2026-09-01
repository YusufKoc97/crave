import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CalendarRange,
  Check,
  Crown,
  Flame,
  Layers,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react-native';
import { AmbientGlow } from '@/components/ui/AmbientGlow';
import { hexAlpha } from '@/constants/designSystem';
import { colors } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { defaultPlanId, usePaywallPlans, type PlanId } from '@/lib/pricing';

/**
 * Crave Premium paywall (Modül X — premium milestone, screen 1/5).
 *
 * A full-screen modal, reached only through `openPaywall()`
 * (`lib/paywall.ts`) so every gate CTA and the profile row funnel to
 * one place. Gold-accented on purpose: the app already reads gold as
 * "premium / best" (Streak Map best-run ring, the Crown lock banner),
 * so the paywall wears that identity instead of the Profile core's
 * blue — the memory rule "don't drown everything in one blue" applies.
 *
 * The feature list is NOT invented — every row maps to a surface that
 * is really gated today (see `useIsPremium()` consumers): full Streak
 * Map history, Trigger Distribution, Comparison deep-dive, the 5-vs-1
 * addiction ceiling, and give-in streak protection.
 *
 * Prices are NOT hardcoded in this screen — they come from
 * `usePaywallPlans()` (`lib/pricing.ts`), which today returns placeholder
 * ₺ values mirroring our App Store Connect products and later swaps to
 * the live StoreKit fetch without touching this file. The CTA is honest:
 * with no billing SDK yet, tapping it shows an inline "not live" notice
 * rather than faking a purchase.
 */

// ── Gold premium identity ──
const GOLD = '#e8c87c';
const gold = (a: number) => hexAlpha(GOLD, a);

const CARD = 'rgba(19,29,50,0.85)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const TEXT_TITLE = '#f4f9ff';
const TEXT_BODY = '#c9d6e8';
const TEXT_MUTED = '#8296b4';

// Plan display labels live in i18n (translatable); prices live in
// lib/pricing.ts (store data). Map id → label key.
const PLAN_LABEL_KEY: Record<PlanId, string> = {
  annual: 'paywall.plan_annual_label',
  monthly: 'paywall.plan_monthly_label',
};

const FEATURES: {
  icon: (color: string) => React.ReactNode;
  titleKey: string;
  bodyKey: string;
}[] = [
  {
    icon: (c) => <CalendarRange size={20} color={c} strokeWidth={2} />,
    titleKey: 'paywall.feature_streakmap_title',
    bodyKey: 'paywall.feature_streakmap_body',
  },
  {
    icon: (c) => <Flame size={20} color={c} strokeWidth={2} />,
    titleKey: 'paywall.feature_triggers_title',
    bodyKey: 'paywall.feature_triggers_body',
  },
  {
    icon: (c) => <Users size={20} color={c} strokeWidth={2} />,
    titleKey: 'paywall.feature_comparison_title',
    bodyKey: 'paywall.feature_comparison_body',
  },
  {
    icon: (c) => <Layers size={20} color={c} strokeWidth={2} />,
    titleKey: 'paywall.feature_addictions_title',
    bodyKey: 'paywall.feature_addictions_body',
  },
  {
    icon: (c) => <ShieldCheck size={20} color={c} strokeWidth={2} />,
    titleKey: 'paywall.feature_protection_title',
    bodyKey: 'paywall.feature_protection_body',
  },
];

export default function Paywall() {
  const reduced = useReducedMotion();
  // `source` is recorded for future tailoring; unused branching today.
  useLocalSearchParams<{ source?: string }>();
  const plans = usePaywallPlans();
  // Default to the recommended (Annual / BEST VALUE) plan — never Monthly.
  const [plan, setPlan] = useState<PlanId>(defaultPlanId());
  const [previewNotice, setPreviewNotice] = useState(false);
  const selectedPlan = plans.find((p) => p.id === plan) ?? plans[0];

  // No billing SDK yet — be honest rather than fake a charge or silently
  // do nothing. A root-level toast would render BEHIND this modal (the
  // toast layer is mounted at the app root, the modal sits above it), so
  // feedback lives inline where it's guaranteed visible. The billing
  // milestone swaps this for the real purchase flow.
  // Inline feedback (see note above); no billing SDK yet.
  const notLive = () => setPreviewNotice(true);

  const enter = (delay: number) =>
    reduced ? undefined : FadeInDown.duration(420).delay(delay);

  return (
    <View style={styles.root}>
      <AmbientGlow
        color={GOLD}
        size={360}
        intensity="medium"
        position={{ x: 200, y: 150 }}
        pulse={!reduced}
      />

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={t('paywall.close')}
        hitSlop={10}
      >
        <X size={20} strokeWidth={2} color={TEXT_MUTED} />
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={enter(0)} style={styles.hero}>
          <View style={styles.crownWrap}>
            <Crown size={30} color={GOLD} strokeWidth={2} fill={gold(0.18)} />
          </View>
          <Text style={styles.title}>{t('paywall.title')}</Text>
          <Text style={styles.tagline}>{t('paywall.tagline')}</Text>
        </Animated.View>

        {/* Feature list */}
        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <Animated.View
              key={f.titleKey}
              entering={enter(80 + i * 55)}
              style={styles.featureRow}
            >
              <View style={styles.featureIcon}>{f.icon(GOLD)}</View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{t(f.titleKey)}</Text>
                <Text style={styles.featureBody}>{t(f.bodyKey)}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Plan selector */}
        <Animated.View entering={enter(360)} style={styles.plans}>
          {plans.map((p) => {
            const selected = plan === p.id;
            const note = p.subNote ?? t('paywall.plan_monthly_note');
            return (
              <Pressable
                key={p.id}
                onPress={() => setPlan(p.id)}
                style={[
                  styles.planCard,
                  selected
                    ? styles.planCardSelected
                    : styles.planCardUnselected,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${t(PLAN_LABEL_KEY[p.id])} ${p.priceLine}`}
              >
                {p.best ? (
                  <View style={styles.bestBadge}>
                    <Text style={styles.bestBadgeText}>
                      {t('paywall.best_value')}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.planTop}>
                  <Text style={styles.planLabel}>
                    {t(PLAN_LABEL_KEY[p.id])}
                  </Text>
                  <View
                    style={[styles.radio, selected && styles.radioSelected]}
                  >
                    {selected ? (
                      <Check size={13} color="#12172a" strokeWidth={3.2} />
                    ) : null}
                  </View>
                </View>
                <Text style={styles.planPrice}>{p.priceLine}</Text>
                <Text style={styles.planNote}>{note}</Text>
                {p.trialDays > 0 ? (
                  <View style={styles.trialChip}>
                    <Text style={styles.trialChipText}>
                      {t('paywall.trial_badge', { days: p.trialDays })}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={reduced ? FadeIn : enter(430)}>
          <Pressable
            onPress={notLive}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel={t('paywall.cta')}
          >
            <Text style={styles.ctaText}>{t('paywall.cta')}</Text>
          </Pressable>
          {previewNotice ? (
            <Text style={styles.notice}>{t('paywall.not_live')}</Text>
          ) : (
            <Text style={styles.ctaSub}>
              {selectedPlan.trialDays > 0
                ? t('paywall.cta_sub_trial', {
                    days: selectedPlan.trialDays,
                    price: selectedPlan.priceLine,
                  })
                : t('paywall.cta_sub')}
            </Text>
          )}

          <Pressable
            onPress={notLive}
            style={({ pressed }) => [
              styles.restoreBtn,
              pressed && { opacity: 0.6 },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.restoreText}>{t('paywall.restore')}</Text>
          </Pressable>

          <Text style={styles.legal}>{t('paywall.legal')}</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 64 : 44,
    paddingBottom: 44,
  },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    marginBottom: 26,
  },
  crownWrap: {
    width: 66,
    height: 66,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: gold(0.1),
    borderWidth: 1,
    borderColor: gold(0.4),
    ...Platform.select({
      web: { boxShadow: `0 0 28px ${gold(0.35)}` },
      default: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
    }),
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: TEXT_TITLE,
    letterSpacing: -0.4,
    marginTop: 16,
  },
  tagline: {
    fontSize: 14.5,
    fontWeight: '500',
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 20,
    maxWidth: 280,
  },

  // ── Features ──
  features: {
    gap: 15,
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: gold(0.1),
    borderWidth: 1,
    borderColor: gold(0.22),
  },
  featureText: {
    flex: 1,
    paddingTop: 1,
  },
  featureTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: TEXT_TITLE,
    letterSpacing: -0.2,
  },
  featureBody: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_BODY,
    lineHeight: 18.5,
    marginTop: 3,
    opacity: 0.82,
  },

  // ── Plans ──
  plans: {
    flexDirection: 'row',
    gap: 11,
    marginBottom: 22,
  },
  planCard: {
    flex: 1,
    borderRadius: 18,
    padding: 15,
    paddingTop: 17,
    backgroundColor: CARD,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
  },
  planCardSelected: {
    borderColor: gold(0.7),
    backgroundColor: gold(0.08),
  },
  // Dim the unselected plan so the chosen one is unmistakable.
  planCardUnselected: {
    opacity: 0.6,
  },
  trialChip: {
    alignSelf: 'flex-start',
    marginTop: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: gold(0.14),
    borderWidth: 1,
    borderColor: gold(0.34),
  },
  trialChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: GOLD,
  },
  bestBadge: {
    position: 'absolute',
    top: -9,
    left: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  bestBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#1a1206',
  },
  planTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: TEXT_BODY,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: gold(0.4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  planPrice: {
    fontSize: 19,
    fontWeight: '800',
    color: TEXT_TITLE,
    marginTop: 12,
    letterSpacing: -0.3,
  },
  planNote: {
    fontSize: 11.5,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginTop: 3,
  },

  // ── CTA ──
  cta: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    ...Platform.select({
      web: { boxShadow: `0 10px 30px -8px ${gold(0.6)}` },
      default: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
        elevation: 6,
      },
    }),
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1206',
    letterSpacing: 0.2,
  },
  ctaSub: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 11,
  },
  notice: {
    fontSize: 12.5,
    fontWeight: '700',
    color: GOLD,
    textAlign: 'center',
    marginTop: 11,
    lineHeight: 17,
    paddingHorizontal: 16,
  },
  restoreBtn: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
  restoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: gold(0.9),
  },
  legal: {
    fontSize: 10.5,
    fontWeight: '500',
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 15,
    opacity: 0.7,
    maxWidth: 300,
    alignSelf: 'center',
  },
});
