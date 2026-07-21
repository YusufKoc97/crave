import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import {
  triggersAccent,
  triggersAccentAlpha,
  triggersSurface,
} from './triggersTheme';

/**
 * Free-tier lock overlay for the Trigger Map (Modül 3 redesign).
 *
 * `children` renders the actual chart underneath. This component
 * layers a locked panel on top:
 *   - Web: real backdrop-filter blur if supported.
 *   - Native: a semi-opaque violet veil + lock card. Not a "true"
 *     blur (RN doesn't ship one; expo-blur is banned — karar #6A)
 *     but visually enough to signal the paywall boundary.
 *
 * Design brief: violet aurora border, `Sparkles` icon, "Unlock the
 * full trigger map" copy, gradient CTA. Kept single-shade (no
 * gradient dep) — the boxShadow + border alpha stack does the
 * "aurora" work.
 *
 * The CTA is a no-op today; wired through `onUpgrade` so the
 * paywall milestone only needs to inject a handler.
 *
 * NOTE: This component is currently NOT mounted (see
 * TEMP-PREMIUM-GATE-DISABLED in TriggersPane). Design polished
 * ahead of the paywall milestone so restoring the gate is a
 * single JSX swap.
 */

type Props = {
  children: React.ReactNode;
  onUpgrade?: () => void;
};

export function FreeTierGate({ children, onUpgrade }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.underlay} pointerEvents="none">
        {children}
      </View>
      <View style={styles.veil} pointerEvents="box-none">
        <View style={styles.lockCard}>
          <View style={styles.lockIconWrap}>
            <Sparkles size={22} color={triggersAccent} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>{t('trigger_map.free_gate.title')}</Text>
          <Text style={styles.body}>{t('trigger_map.free_gate.body')}</Text>
          <Pressable
            onPress={onUpgrade}
            style={({ pressed }) => [
              styles.cta,
              pressed && { backgroundColor: triggersAccentAlpha(0.32) },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('trigger_map.free_gate.cta')}
          >
            <Text style={styles.ctaText}>{t('trigger_map.free_gate.cta')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginBottom: 24,
  },
  underlay: {
    // On web the blur below applies to whatever lives inside this
    // View; on native the underlay just renders normally underneath
    // the veil.
    ...Platform.select({
      web: {
        filter: 'blur(6px)',
      },
      default: {},
    }),
    opacity: 0.35,
  },
  veil: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    // Web uses backdrop-filter; native uses a violet-tinged fill.
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
      },
      default: {
        backgroundColor: 'rgba(6, 10, 22, 0.62)',
      },
    }),
  },
  lockCard: {
    maxWidth: 320,
    padding: 22,
    borderRadius: triggersSurface.radius,
    backgroundColor: 'rgba(15, 26, 50, 0.95)',
    borderWidth: 1,
    borderColor: triggersAccentAlpha(0.42),
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: `0 18px 50px ${triggersAccentAlpha(0.28)}`,
      },
      default: {
        shadowColor: triggersAccent,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },
  lockIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: triggersAccentAlpha(0.14),
    borderWidth: 1,
    borderColor: triggersAccentAlpha(0.42),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#F1F5FF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  body: {
    color: '#B8C4E0',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  cta: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: triggersAccent,
    backgroundColor: triggersAccentAlpha(0.22),
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
