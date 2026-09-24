import { useSyncExternalStore } from 'react';
import { getLanguage, subscribeLanguage } from './i18n';

/** Current language code; re-renders the caller when it changes. */
export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
}
