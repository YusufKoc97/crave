import { StyleSheet, Text, View } from 'react-native';
import type { TechniqueScreenProps } from './types';

/** M3 shell — actual guided flow lands in M6. */
export function Grounding54321Screen(_props: TechniqueScreenProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.placeholder}>Grounding 5-4-3-2-1 — coming in M6</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: '#6B8BA4', fontSize: 14 },
});
