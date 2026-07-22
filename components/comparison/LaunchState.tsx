import { Platform, StyleSheet, Text, View } from 'react-native';
import { Flag, Sunrise } from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { compColors, compHexAlpha } from './comparisonTheme';

/**
 * Launch state — shown when there aren't enough community members
 * yet to compute meaningful aggregates. Design brief:
 * "yapı/söz var, sahte sayı yok. Hayalet kartlar + 'The lookout
 * before sunrise' + tek gerçek sayı ('first 500 resisters')".
 *
 * Two blurred/dim ghost cards preview the shape of what's coming
 * (so the layout doesn't feel empty), then a centered sunrise
 * hero card announces the honest state + the one real fact we
 * can share.
 */

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
      <View style={styles.ghostStack}>
        <GhostCard />
        <GhostCard />
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
        <View
          pointerEvents="none"
          style={[
            styles.heroHalo,
            {
              backgroundColor: alpha(0.12),
            },
          ]}
        />
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

function GhostCard() {
  return (
    <View style={styles.ghostCard}>
      <View style={styles.ghostTitle} />
      <View style={styles.ghostRow}>
        <View style={styles.ghostChip} />
        <View style={styles.ghostLine} />
      </View>
      <View style={styles.ghostRow}>
        <View style={styles.ghostChip} />
        <View style={styles.ghostLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ghostStack: {
    gap: 11,
    opacity: 0.5,
    ...Platform.select({
      web: {
        filter: 'blur(2px)',
      } as any,
      default: {},
    }),
  },
  ghostCard: {
    borderRadius: 18,
    padding: 15,
    backgroundColor: 'rgba(17, 26, 45, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  ghostTitle: {
    width: '45%',
    height: 11,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  ghostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  ghostChip: {
    width: 34,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  ghostLine: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    borderRadius: 75,
    ...Platform.select({
      web: {
        filter: 'blur(20px)',
      } as any,
      default: {},
    }),
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
