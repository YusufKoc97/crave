import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

/**
 * App-wide toast queue. Up to MAX_VISIBLE toasts can stack at once;
 * each one auto-dismisses after AUTO_DISMISS_MS. Tap dismisses early.
 *
 * Usage:
 *
 *   const toast = useToast();
 *   toast.success('Gönderi paylaşıldı');
 *   toast.error('Bağlantı yok');
 *   toast.info('Yardımcıyla konuş', { duration: 5000 });
 *
 * Replaces the per-screen inline error banners that lived in compose,
 * add-craving, etc. Those can stay for inline form-field errors that
 * belong WITH the field, but anything ephemeral (post saved, link
 * sent, like failed) is a toast.
 */

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 3500;

type ToastVariant = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
};

type ToastContextValue = {
  success: (message: string, opts?: { duration?: number }) => void;
  error: (message: string, opts?: { duration?: number }) => void;
  info: (message: string, opts?: { duration?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback(
    (variant: ToastVariant, message: string, duration: number) => {
      const id = nextId++;
      setToasts((prev) => {
        const next = [...prev, { id, variant, message, duration }];
        // Cap the visible stack — drop the oldest if we're over.
        return next.length > MAX_VISIBLE
          ? next.slice(next.length - MAX_VISIBLE)
          : next;
      });
    },
    []
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (m, o) => push('success', m, o?.duration ?? AUTO_DISMISS_MS),
      error: (m, o) => push('error', m, o?.duration ?? AUTO_DISMISS_MS),
      info: (m, o) => push('info', m, o?.duration ?? AUTO_DISMISS_MS),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.layer}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  // Auto-dismiss timer + entrance animation. We keep a ref to the
  // timeout so an early tap can cancel it.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    translateY.value = withTiming(0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    timeoutRef.current = setTimeout(onDismiss, toast.duration);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [toast.duration, onDismiss, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const palette = VARIANT_STYLE[toast.variant];

  return (
    <Animated.View
      style={[
        styles.toast,
        { borderColor: palette.border, backgroundColor: palette.bg },
        style,
      ]}
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Bildirimi kapat"
        style={styles.toastBody}
        hitSlop={4}
      >
        <Ionicons name={palette.icon} size={14} color={palette.iconColor} />
        <Text
          style={[styles.toastText, { color: palette.text }]}
          numberOfLines={3}
        >
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const VARIANT_STYLE: Record<
  ToastVariant,
  {
    border: string;
    bg: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    text: string;
  }
> = {
  success: {
    border: 'rgba(16, 185, 129, 0.45)',
    bg: 'rgba(16, 185, 129, 0.12)',
    icon: 'checkmark-circle',
    iconColor: '#10B981',
    text: '#F1F5F9',
  },
  error: {
    border: 'rgba(239, 68, 68, 0.45)',
    bg: 'rgba(239, 68, 68, 0.12)',
    icon: 'alert-circle',
    iconColor: '#EF4444',
    text: '#F1F5F9',
  },
  info: {
    border: 'rgba(125, 195, 255, 0.45)',
    bg: 'rgba(59, 130, 246, 0.12)',
    icon: 'information-circle',
    iconColor: '#7DC3FF',
    text: '#F1F5F9',
  },
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  // The layer sits at the absolute top of the app tree but below modals.
  // Tab bar lives at bottom: 22 with height 48 → we float above it.
  layer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 90,
    gap: 8,
    pointerEvents: 'box-none',
  },
  toast: {
    borderRadius: 12,
    borderWidth: 1,
  },
  toastBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toastText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: 18,
  },
});
