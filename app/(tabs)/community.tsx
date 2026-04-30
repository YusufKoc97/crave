import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';

export default function CommunityScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.emoji}>💬</Text>
        <Text style={styles.title}>Community</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 56,
    marginBottom: 18,
    opacity: 0.6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: 1.5,
  },
});
