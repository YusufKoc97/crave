import { StyleSheet, Text, View } from 'react-native';
import type { TechniqueScreenProps } from './types';

/** M3 shell — actual guided flow lands in M7. */
export function BodyScanScreen(_props: TechniqueScreenProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.placeholder}>Body Scan — coming in M7</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: '#6B8BA4', fontSize: 14 },
});
