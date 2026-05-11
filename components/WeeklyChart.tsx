import { StyleSheet, Text, View } from 'react-native';

/**
 * Minimal 7-day bar chart for the profile screen. Each bar is one day,
 * height scaled to the week's max — so a single resist day still feels
 * visible. The X axis is implicit: leftmost is six days ago, rightmost
 * is today, marked by a brighter color and a faint underline.
 *
 * Pure presentation — counts come from weeklyResistCounts() in
 * lib/scoring.
 */

// Turkish day initials, starting from Sunday to match
// JS Date.getDay()'s 0..6 indexing.
//   0 Pazar (Sun) · 1 Pazartesi (Mon) · 2 Salı (Tue) · 3 Çarşamba (Wed)
//   4 Perşembe (Thu) · 5 Cuma (Fri) · 6 Cumartesi (Sat)
const TR_DAY_INITIALS = ['P', 'P', 'S', 'Ç', 'P', 'C', 'C'] as const;

export function WeeklyChart({
  counts,
  accent = '#3B82F6',
  todayWeekday,
}: {
  counts: number[];
  accent?: string;
  /** 0 = Sunday … 6 = Saturday. Used to label each bar. */
  todayWeekday: number;
}) {
  const max = Math.max(1, ...counts);
  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {counts.map((c, i) => {
          const isToday = i === 6;
          // Day index relative to today: i=0 is 6 days back, i=6 is today.
          const weekdayIndex = (todayWeekday - (6 - i) + 7) % 7;
          const label = TR_DAY_INITIALS[weekdayIndex];
          const heightPct = (c / max) * 100;
          return (
            <View key={i} style={styles.col}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: c === 0 ? 2 : `${Math.max(8, heightPct)}%`,
                      backgroundColor: c === 0 ? '#1A2A45' : accent,
                      opacity: c === 0 ? 0.6 : isToday ? 1 : 0.55,
                    },
                  ]}
                />
                {c > 0 && (
                  <Text style={[styles.count, { color: accent }]}>{c}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  isToday ? { color: '#E2E8F0', fontWeight: '700' } : null,
                ]}
              >
                {label}
              </Text>
              {isToday && (
                <View style={[styles.todayDot, { backgroundColor: accent }]} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#0A1628',
    borderWidth: 1,
    borderColor: '#1A2840',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    height: 96,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: '100%',
    height: 70,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  bar: {
    width: '70%',
    minHeight: 2,
    borderRadius: 3,
  },
  count: {
    position: 'absolute',
    top: -16,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dayLabel: {
    marginTop: 6,
    color: '#6B8BA4',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  todayDot: {
    marginTop: 3,
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});
