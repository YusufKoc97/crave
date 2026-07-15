import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ToolkitGrid } from '@/components/ToolkitGrid';
import type { Technique } from '@/constants/toolkitCatalog';
import { t } from '@/lib/i18n';

/**
 * Faz 6 — active-session toolkit picker.
 *
 * A slide-up bottom-sheet-style modal that wraps the same
 * ToolkitGrid used on the Info Toolkit sub-tab. Opened from the
 * "Try a technique" button on the active-craving screen; picking
 * a card hands the Technique back to the caller (which then
 * mounts TechniqueRunnerModal with context='active_craving').
 *
 * Rendered as an RN <Modal> rather than a Stack.Screen route so
 * the underlying timer keeps ticking behind it. The user can
 * always × close and drop back onto the running timer without
 * losing state.
 */

type Props = {
  visible: boolean;
  accentColor: string;
  onSelect: (technique: Technique) => void;
  onClose: () => void;
};

export function ToolkitPickerModal({
  visible,
  accentColor,
  onSelect,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Backdrop press = dismiss. Content is a separate Pressable
            that swallows the tap so hitting a card doesn't also
            close the sheet. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.handle} />
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('toolkit.quit')}
            >
              <Ionicons name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ToolkitGrid
              accentColor={accentColor}
              onSelect={(tech) => {
                onSelect(tech);
              }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 16, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    // Bottom-sheet look: rounded top corners, capped at 78% of the
    // screen so a peek of the timer stays visible.
    maxHeight: '78%',
    backgroundColor: '#0A1628',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#1E2D4D',
    boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.6)',
  },
  header: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1E3050',
    marginBottom: 6,
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1E35',
    borderWidth: 1,
    borderColor: '#1E3050',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
});
