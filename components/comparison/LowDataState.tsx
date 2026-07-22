import { StyleSheet, Text, View } from 'react-native';
import { PencilLine } from 'lucide-react-native';
import type { Addiction } from '@/constants/addictions';
import { t } from '@/lib/i18n';
import { compColors, compHexAlpha } from './comparisonTheme';

/**
 * Low-personal-data state banner — shown when the user hasn't
 * logged enough of their own cravings for the You-side comparison
 * to be meaningful. Community aggregates still render (via ghost-
 * variant DistributionCards), and this banner asks them to keep
 * logging with a friendly progress bar.
 */

type Props = {
  addiction: Addiction;
  done: number;
  total: number;
};

export function LowDataBanner({ addiction, done, total }: Props) {
  const accent = addiction.color;
  const alpha = (a: number) => compHexAlpha(accent, a);
  const pct = Math.min(100, Math.max(0, (done / total) * 100));

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: alpha(0.3),
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.halo, { backgroundColor: alpha(0.12) }]}
      />
      <View style={styles.headRow}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: alpha(0.16),
              borderColor: alpha(0.36),
            },
          ]}
        >
          <PencilLine size={19} color={accent} strokeWidth={2} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{t('comparison.lowdata_title')}</Text>
          <Text style={styles.body}>{t('comparison.lowdata_body')}</Text>
        </View>
      </View>
      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${pct}%`,
                backgroundColor: accent,
              },
            ]}
          />
        </View>
        <Text style={[styles.count, { color: accent }]}>
          {t('comparison.lowdata_progress', { done, total })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#101a30',
    borderWidth: 1,
    marginBottom: 14,
  },
  halo: {
    position: 'absolute',
    right: -30,
    top: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    opacity: 0.6,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    position: 'relative',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#f2f6fc',
  },
  body: {
    fontSize: 11.5,
    fontWeight: '500',
    color: compColors.textMuted,
    marginTop: 3,
  },
  progressRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 13,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  count: {
    fontSize: 11,
    fontWeight: '700',
  },
});
