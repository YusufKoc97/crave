import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Web-only keyboard shortcut hook. No-ops on native — RN doesn't have
 * a hardware keyboard event model, and the screens that use this hook
 * are modals where Esc / Cmd+Enter only make sense in a browser.
 *
 * Usage:
 *
 *   useKeyboardShortcut({
 *     onEscape: () => router.back(),
 *     onSubmit: () => submit(),  // Cmd/Ctrl+Enter
 *   });
 *
 * Both handlers are optional. If `onSubmit` is omitted, Cmd+Enter does
 * nothing; if `onEscape` is omitted, Esc does nothing. This lets pages
 * pick whichever subset fits.
 */
export function useKeyboardShortcut(handlers: {
  onEscape?: () => void;
  onSubmit?: () => void;
}) {
  const { onEscape, onSubmit } = handlers;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (
        e.key === 'Enter' &&
        (e.metaKey || e.ctrlKey) &&
        onSubmit
      ) {
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape, onSubmit]);
}
