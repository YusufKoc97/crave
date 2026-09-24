import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ToolkitGrid } from '@/components/ToolkitGrid';
import { ToolkitAurora } from '@/components/toolkit/ToolkitAurora';
import type { Technique } from '@/constants/toolkitCatalog';
import { t } from '@/lib/i18n';

/**
 * Faz 6 — active-session toolkit picker.
 *
 * A slide-up bottom-sheet-style modal that wraps the same
 * ToolkitGrid used on the Info Toolkit sub-tab. Opened from the
 * "Try a technique" button on the active-craving screen; picking
 * a card hands the Technique back to the caller (which then
 * mounts ExerciseRunner with context='active_craving').
 *
 * Rendered as an RN <Modal> rather than a Stack.Screen route so
 * the underlying timer keeps ticking behind it. The user can
 * always × close and drop back onto the running timer without
 * losing state.
 */

type Props = {
  visible: boolean;
  accentColor: string;
  /** Whose toolkit this is — decides which techniques are offered. */
  addictionId?: string | null;
  onSelect: (technique: Technique) => void;
  onClose: () => void;
};

export function ToolkitPickerModal({
  visible,
  accentColor,
  addictionId,
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
          {/* Same soft aurora as the Toolkit tab, so the sheet reads as
              part of that module rather than a flat panel. */}
          <View style={styles.aurora} pointerEvents="none">
            <ToolkitAurora />
          </View>
          <View style={styles.header}>
            <View style={styles.handle} />
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('toolkit.quit')}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.75)" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ToolkitGrid
              accentColor={accentColor}
              addictionId={addictionId}
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
    // Bottom-sheet look: rounded top corners, capped at 88% of the
    // screen so a peek of the timer stays visible.
    maxHeight: '88%',
    backgroundColor: '#0a1020',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    boxShadow: '0 -16px 48px rgba(0, 0, 0, 0.65)',
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
    backgroundColor: 'rgba(255,255,255,0.22)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  scroll: {
    flexGrow: 0,
  },
  aurora: {
    ...StyleSheet.absoluteFillObject,
    // The tab's aurora is tuned for a full page; dialled back here so the
    // glow doesn't muddy the gaps between the tiles.
    opacity: 0.6,
  },
  scrollContent: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
});
