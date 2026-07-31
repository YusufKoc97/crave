import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Check,
  ChevronRight,
  Languages,
  LogOut,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { t } from '@/lib/i18n';
import {
  coreDanger,
  coreDivider,
  coreRadius,
  coreText,
  neon,
} from './coreTheme';

/**
 * Settings, split into two groups so "delete account" is never one
 * mis-tap away from "sign out". Group 1 is everything routine; group 2
 * holds only the destructive action, visually separated and colour-
 * coded, and gated behind an in-app dialog rather than `Alert.alert`
 * so the confirmation can carry the same surface language as the rest
 * of the screen.
 */

type RowProps = {
  icon: React.ReactNode;
  label: string;
  trailing?: string;
  labelColor?: string;
  /** Premium row gets a faint leftward accent wash. */
  wash?: boolean;
  onPress?: () => void;
  showDivider?: boolean;
};

export function SettingsGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function SettingsRow({
  icon,
  label,
  trailing,
  labelColor,
  wash,
  onPress,
  showDivider,
}: RowProps) {
  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.row,
          wash && styles.rowWash,
          pressed && onPress && styles.rowPressed,
        ]}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={label}
      >
        {icon}
        <Text
          style={[styles.rowLabel, labelColor ? { color: labelColor } : null]}
        >
          {label}
        </Text>
        {trailing ? <Text style={styles.rowTrailing}>{trailing}</Text> : null}
        {onPress ? (
          <ChevronRight size={16} color={coreText.tertiary} strokeWidth={2} />
        ) : null}
      </Pressable>
      {showDivider ? <View style={styles.divider} /> : null}
    </>
  );
}

/**
 * Working skeleton for the settings rows. `Alert.alert` is a silent
 * no-op on web, which is why "none of the buttons did anything" —
 * every row now opens a real in-app sheet in the app's own surface
 * language. The sheets are deliberately skeletons: the paywall and
 * the language switch get their real designs later, but the plumbing
 * (open, close, select) already works.
 */
export function PremiumRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsRow
        icon={<Sparkles size={18} color={neon(0.95)} strokeWidth={2} />}
        label={t('profile.upgrade_premium')}
        labelColor={neon(0.95)}
        wash
        onPress={() => setOpen(true)}
        showDivider
      />
      {open && (
        <SettingsSheet
          title={t('profile.premium_sheet_title')}
          onClose={() => setOpen(false)}
        >
          <View style={styles.soonChip}>
            <Text style={styles.soonChipText}>{t('profile.coming_soon')}</Text>
          </View>
          {[
            t('profile.premium_feature_insights'),
            t('profile.premium_feature_addictions'),
            t('profile.premium_feature_themes'),
          ].map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Sparkles size={14} color={neon(0.85)} strokeWidth={2} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </SettingsSheet>
      )}
    </>
  );
}

export function LanguageRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsRow
        icon={
          <Languages size={18} color={coreText.secondary} strokeWidth={2} />
        }
        label={t('profile.language')}
        trailing={t('profile.language_value')}
        onPress={() => setOpen(true)}
        showDivider
      />
      {open && (
        <SettingsSheet
          title={t('profile.language')}
          onClose={() => setOpen(false)}
        >
          <Pressable
            style={styles.optionRow}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
          >
            <Text style={styles.optionText}>{t('profile.language_value')}</Text>
            <Check size={16} color={neon(0.9)} strokeWidth={2.4} />
          </Pressable>
          {/* Turkish is listed but inert — the i18n layer only ships
              English today. Showing it dimmed promises the direction
              without pretending the switch works. */}
          <View style={[styles.optionRow, styles.optionDisabled]}>
            <Text style={styles.optionText}>
              {t('profile.language_turkish')}
            </Text>
            <View style={styles.soonChipSmall}>
              <Text style={styles.soonChipText}>
                {t('profile.coming_soon')}
              </Text>
            </View>
          </View>
        </SettingsSheet>
      )}
    </>
  );
}

/** Shared skeleton sheet — backdrop + centred card, same surface
 *  language as DeleteDialog but generic. Rendered in a Modal so it
 *  escapes SettingsGroup's overflow-hidden rounded container. */
function SettingsSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('profile.close')}
      />
      <View style={styles.dialogWrap} pointerEvents="box-none">
        <Animated.View entering={ZoomIn.duration(240)} style={styles.dialog}>
          <Text style={styles.dialogTitle}>{title}</Text>
          {children}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.sheetCloseBtn,
              pressed && styles.rowPressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.sheetCloseText}>{t('profile.close')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function SignOutRow({ onPress }: { onPress: () => void }) {
  return (
    <SettingsRow
      icon={<LogOut size={18} color={coreText.secondary} strokeWidth={2} />}
      label={t('profile.sign_out')}
      onPress={onPress}
    />
  );
}

/**
 * Sign-out confirmation. Same surface language as DeleteDialog but
 * neutral (blue accent, not danger red) — signing out is reversible,
 * so it must not wear the same alarm colour as account deletion.
 */
export function SignOutDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={StyleSheet.absoluteFill}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t('profile.cancel')}
      />
      <View style={styles.dialogWrap} pointerEvents="box-none">
        <Animated.View
          entering={ZoomIn.duration(280)}
          style={[styles.dialog, styles.dialogNeutral]}
        >
          <View style={styles.dialogIcon}>
            <LogOut size={44} color={neon(0.95)} strokeWidth={1.5} />
          </View>
          <Text style={styles.dialogTitle}>
            {t('profile.sign_out_confirm_title')}
          </Text>
          <Text style={styles.dialogBody}>
            {t('profile.sign_out_confirm_message')}
          </Text>
          <View style={styles.dialogActions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.dialogBtn,
                styles.dialogCancel,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.dialogCancelText}>{t('profile.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.dialogBtn,
                styles.dialogConfirm,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.dialogConfirmText}>
                {t('profile.sign_out')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export function DeleteRow({ onPress }: { onPress: () => void }) {
  return (
    <SettingsRow
      icon={<Trash2 size={18} color={coreDanger.icon} strokeWidth={2} />}
      label={t('profile.delete_account')}
      labelColor={coreDanger.text}
      onPress={onPress}
    />
  );
}

/**
 * Delete confirmation. Rendered inline (the caller mounts it over the
 * ScrollView) rather than in a `Modal`, so the blurred backdrop can
 * sit inside the screen's own colour space instead of the OS's.
 */
export function DeleteDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={StyleSheet.absoluteFill}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t('profile.cancel')}
      />
      <View style={styles.dialogWrap} pointerEvents="box-none">
        <Animated.View entering={ZoomIn.duration(280)} style={styles.dialog}>
          <View style={styles.dialogIcon}>
            <Trash2 size={52} color={coreDanger.icon} strokeWidth={1.4} />
          </View>
          <Text style={styles.dialogTitle}>
            {t('profile.delete_confirmation_title')}
          </Text>
          <Text style={styles.dialogBody}>
            {t('profile.delete_confirmation_message')}
          </Text>
          <View style={styles.dialogActions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.dialogBtn,
                styles.dialogCancel,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.dialogCancelText}>{t('profile.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.dialogBtn,
                styles.dialogDelete,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.dialogDeleteText}>
                {t('profile.delete_confirm')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: coreRadius.group,
    backgroundColor: 'rgba(17,26,44,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 54,
    paddingHorizontal: 16,
  },
  rowWash: {
    backgroundColor: neon(0.06),
  },
  rowPressed: {
    opacity: 0.65,
  },
  rowLabel: {
    flex: 1,
    color: coreText.strong,
    fontSize: 14.5,
    fontWeight: '600',
  },
  rowTrailing: {
    color: coreText.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: coreDivider,
    marginLeft: 46,
  },

  // ── Dialog ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    // `backdropFilter` is RN-Web-only, so the native read comes from
    // opacity alone — dark enough that the screen behind reads as
    // pushed back rather than merely tinted.
    backgroundColor: 'rgba(6,10,22,0.78)',
    ...Platform.select({
      web: { backdropFilter: 'blur(7px)' },
      default: {},
    }),
  },
  dialogWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    backgroundColor: '#111a2c',
    borderWidth: 1,
    borderColor: coreDanger.border,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    alignItems: 'center',
  },
  dialogIcon: {
    marginBottom: 14,
  },
  dialogTitle: {
    color: coreText.title,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  dialogBody: {
    color: coreText.body,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    alignSelf: 'stretch',
  },
  dialogBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancel: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dialogCancelText: {
    color: coreText.strong,
    fontSize: 14.5,
    fontWeight: '700',
  },
  dialogDelete: {
    backgroundColor: coreDanger.ctaFrom,
  },
  dialogDeleteText: {
    color: '#fff',
    fontSize: 14.5,
    fontWeight: '800',
  },
  // Neutral confirm (sign-out) — blue accent so it doesn't read as the
  // destructive delete flow.
  dialogNeutral: {
    borderColor: neon(0.35),
  },
  dialogConfirm: {
    backgroundColor: neon(0.16),
    borderWidth: 1,
    borderColor: neon(0.45),
  },
  dialogConfirmText: {
    color: neon(0.95),
    fontSize: 14.5,
    fontWeight: '800',
  },

  // ── Skeleton sheets (Premium / Language) ──
  soonChip: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: neon(0.12),
    borderWidth: 1,
    borderColor: neon(0.3),
    marginBottom: 14,
  },
  soonChipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: neon(0.1),
    borderWidth: 1,
    borderColor: neon(0.25),
  },
  soonChipText: {
    color: neon(0.9),
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    alignSelf: 'stretch',
  },
  featureText: {
    color: coreText.strong,
    fontSize: 13.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: coreDivider,
  },
  optionDisabled: {
    opacity: 0.5,
    borderBottomWidth: 0,
  },
  optionText: {
    color: coreText.strong,
    fontSize: 14,
    fontWeight: '600',
  },
  sheetCloseBtn: {
    marginTop: 18,
    alignSelf: 'stretch',
    height: 44,
    borderRadius: coreRadius.iconSquare,
    borderWidth: 1,
    borderColor: neon(0.35),
    backgroundColor: neon(0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    color: neon(0.95),
    fontSize: 14,
    fontWeight: '700',
  },
});
