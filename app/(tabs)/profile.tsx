import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useSessions } from '@/context/SessionsContext';

export default function ProfileScreen() {
  const { totalPoints, wonToday, lostToday, momentum, streak } = useSessions();

  return (
    <View style={styles.root}>
      <View style={styles.topSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>?</Text>
        </View>
        <View style={styles.dash} />

        <View style={styles.totalCard}>
          <Text style={styles.totalNumber}>{totalPoints}</Text>
          <Text style={styles.totalLabel}>TOTAL POINTS</Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            value={wonToday}
            label="WON TODAY"
            valueColor="#10B981"
            topBorderColor="#10B981"
          />
          <StatCard
            value={lostToday}
            label="LOST TODAY"
            valueColor="#EF4444"
            topBorderColor="#EF4444"
          />
          <StatCard value={momentum} label="MOMENTUM" valueColor={colors.textPrimary} />
        </View>

        {streak > 0 && (
          <View style={styles.streakCard}>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakLabel}>RESIST STREAK</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function StatCard({
  value,
  label,
  valueColor,
  topBorderColor,
}: {
  value: number;
  label: string;
  valueColor: string;
  topBorderColor?: string;
}) {
  return (
    <View style={styles.statCard}>
      {topBorderColor && (
        <View style={[styles.statTopBorder, { backgroundColor: topBorderColor }]} />
      )}
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020810',
    paddingTop: 64,
    paddingHorizontal: 20,
  },
  topSection: {
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0D1E35',
    borderWidth: 1,
    borderColor: '#1E3050',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#3B82F6',
    fontSize: 24,
    fontWeight: '500',
  },
  dash: {
    width: 24,
    height: 1.5,
    backgroundColor: '#94A3B8',
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 1,
    opacity: 0.6,
  },
  totalCard: {
    width: 140,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1A2840',
    alignItems: 'center',
    marginTop: 4,
  },
  totalNumber: {
    color: '#3B82F6',
    fontSize: 30,
    fontWeight: '600',
  },
  totalLabel: {
    color: '#6B8BA4',
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '500',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    width: '100%',
    paddingHorizontal: 4,
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1A2840',
    alignItems: 'center',
    overflow: 'hidden',
  },
  statTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
  },
  statLabel: {
    color: '#6B8BA4',
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '500',
    marginTop: 4,
  },
  streakCard: {
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#3B82F640',
    alignItems: 'center',
  },
  streakNumber: {
    color: '#7DC3FF',
    fontSize: 22,
    fontWeight: '700',
  },
  streakLabel: {
    color: '#6B8BA4',
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '500',
    marginTop: 2,
  },
});
