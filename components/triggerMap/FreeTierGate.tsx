import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/lib/i18n';

/**
 * Faz 8a — free-tier lock overlay for the trigger map sections.
 *
 * `children` renders the actual chart underneath. This component
 * layers a locked panel on top:
 *   - Web: real backdrop-filter blur if supported.
 *   - Native: a semi-opaque veil + lock icon. Not a "true" blur
 *     — RN doesn't ship one and expo-blur is a heavier dep for a
 *     surface the paywall will replace soon. Visual hint is
 *     enough at this stage.
 *
 * The CTA is a no-op today (Faz X). Wired through `onUpgrade` so
 * the paywall milestone only needs to inject a handler.
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
            <Ionicons name="lock-closed" size={20} color="#F1F5F9" />
          </View>
          <Text style={styles.title}>{t('trigger_map.free_gate.title')}</Text>
          <Text style={styles.body}>{t('trigger_map.free_gate.body')}</Text>
          <Pressable
            onPress={onUpgrade}
            style={styles.cta}
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
        filter: 'blur(8px)',
      },
      default: {},
    }),
    opacity: 0.4,
  },
  veil: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    // On native the underlay's opacity isn't enough on its own —
    // the extra fill kills the parallax look of the chart peeking
    // through. On web the backdrop-filter does the heavy lifting.
    ...Platform.select({
      web: {
        backdropFilter: 'blur(6px)',
      },
      default: {
        backgroundColor: 'rgba(2, 8, 16, 0.55)',
      },
    }),
  },
  lockCard: {
    maxWidth: 320,
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 22, 40, 0.92)',
    borderWidth: 1,
    borderColor: '#1E2D4D',
    alignItems: 'center',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
  },
  lockIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  body: {
    color: '#94A3B8',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  cta: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
  },
  ctaText: {
    color: '#7DC3FF',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
