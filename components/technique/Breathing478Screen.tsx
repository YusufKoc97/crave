import { StyleSheet, Text, View } from 'react-native';
import type { TechniqueScreenProps } from './types';

/** M3 shell — actual guided flow lands in M4. */
export function Breathing478Screen(_props: TechniqueScreenProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.placeholder}>Breathing 4-7-8 — coming in M4</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: '#6B8BA4', fontSize: 14 },
});
