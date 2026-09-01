import { StyleSheet, Text, View } from 'react-native';
import { DEV_SEED_DATA } from '@/lib/devSeed';

/**
 * Loud, impossible-to-miss reminder that the DEV random-data seed is
 * on (see lib/devSeed.ts). Renders NOTHING when the seed is off, so it
 * self-removes the moment `DEV_SEED_DATA` is flipped to false — and,
 * like the seed itself, it is compiled out of production by `__DEV__`.
 *
 * Its whole job is to make "I forgot the fake data was on" impossible:
 * if you see this badge, the numbers on screen are fabricated.
 */
export function DevSeedBadge() {
  if (!DEV_SEED_DATA) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.text}>
        ⚠︎ DEV FAKE DATA — set DEV_SEED_DATA = false
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(224,160,122,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(224,160,122,0.5)',
  },
  text: {
    color: '#f0c9a8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
