import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Users } from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { compColors, compHexAlpha } from './comparisonTheme';

/**
 * Free-tier gate for Comparison (Modül 4).
 *
 * The Community Pulse stays visible on Free (marketing +
 * belonging), but sections 2-4 (You vs. Community, Your Standing,
 * Community Patterns) render UNDER a blur+veil with an "Unlock
 * with Premium" CTA. Same paywall grammar as Triggers'
 * `FreeTierGate`.
 *
 * NOTE: This component is DEFINED but NOT MOUNTED. It waits
 * behind the `TEMP-PREMIUM-GATE-DISABLED` marker in
 * ComparisonPane.tsx — one-line JSX swap will restore the gate
 * when the paywall milestone lands. Keeping the import + the
 * `void FreeGate` binding preserved so `git blame` records the
 * intent.
 */

type Props = {
  addiction: Addiction;
  onUpgrade?: () => void;
  children: React.ReactNode;
};

export function FreeGate({ addiction, onUpgrade, children }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.underlay} pointerEvents="none">
        {children}
      </View>
      <View style={styles.veil} pointerEvents="box-none">
        <View style={styles.lockCard}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: compHexAlpha(compColors.community, 0.4),
                borderColor: compHexAlpha(compColors.community, 0.5),
              },
            ]}
          >
            <Users size={26} color="#dbe4f0" strokeWidth={1.9} />
          </View>
          <Text style={styles.title}>{t('comparison.free_title')}</Text>
          <Text style={styles.body}>
            {t('comparison.free_body', { addiction: addiction.name })}
          </Text>
          <Pressable
            onPress={onUpgrade}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={t('comparison.free_cta')}
          >
            <Text style={styles.ctaText}>{t('comparison.free_cta')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  underlay: {
    ...Platform.select({
      web: {
        filter: 'blur(7px)',
      } as any,
      default: {},
    }),
    opacity: 0.55,
  },
  veil: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 70,
    padding: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(7px)',
      } as any,
      default: {
        backgroundColor: 'rgba(10, 16, 32, 0.62)',
      },
    }),
  },
  lockCard: {
    width: '100%',
    maxWidth: 320,
    padding: 22,
    borderRadius: 24,
    backgroundColor: 'rgba(18, 26, 46, 0.94)',
    borderWidth: 1,
    borderColor: compHexAlpha(compColors.community, 0.42),
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 50px -20px rgba(0,0,0,0.6)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 0 18px rgba(154,163,184,0.35)',
      },
      default: {
        shadowColor: compColors.community,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
    }),
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    fontWeight: '500',
    color: compColors.textSecondary,
    marginTop: 8,
    lineHeight: 19,
    textAlign: 'center',
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
