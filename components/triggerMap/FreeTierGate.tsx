import { Platform, StyleSheet, View } from 'react-native';
import { LockedBlur } from '@/components/ui/LockedBlur';
import { PremiumPitch } from '@/components/ui/PremiumPitch';
import { t } from '@/lib/i18n';
import { triggersSurface } from './triggersTheme';

/**
 * Free-tier gate for the Trigger Map (Modül 3).
 *
 * `children` is the locked section (the trigger DISTRIBUTION — the
 * "why"). Instead of hiding it behind an opaque veil, it renders as a
 * lightly blurred teaser — bars and colour dots still read, labels and
 * numbers don't — so a free user sees what Premium unlocks. The shared
 * gold `PremiumPitch` sits right under it (same identity as the paywall
 * and the Comparison gate), so the tap into the paywall feels like a
 * continuation.
 *
 * Blur: native uses a real `BlurView` layer (`LockedBlur`); web keeps
 * the CSS `filter: blur`.
 */

type Props = {
  children: React.ReactNode;
  onUpgrade: () => void;
};

export function FreeTierGate({ children, onUpgrade }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.preview} pointerEvents="none">
        <View style={styles.underlay}>{children}</View>
        <LockedBlur intensity={14} radius={triggersSurface.radius} />
      </View>
      <PremiumPitch
        kicker={t('trigger_map.free_gate.kicker')}
        title={t('trigger_map.free_gate.title')}
        body={t('trigger_map.free_gate.body')}
        cta={t('trigger_map.free_gate.cta')}
        trial={t('trigger_map.free_gate.trial')}
        onUpgrade={onUpgrade}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 24,
  },
  preview: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: triggersSurface.radius,
  },
  underlay: {
    ...Platform.select({
      web: {
        filter: 'blur(5px)',
      } as never,
      default: {},
    }),
  },
});
