import { useCallback, useEffect, useState } from 'react';
import {
  getFavoritesSnapshot,
  hydrateFavorites,
  subscribeFavorites,
  toggleFavorite,
} from './toolkitFavorites';

/**
 * React binding for the toolkit favorites store. Every consumer
 * subscribes to the same module-level store, so a heart tapped on one
 * card updates the pane's filter and any other mounted card in the
 * same frame.
 */
export function useToolkitFavorites() {
  const [favorites, setFavorites] =
    useState<ReadonlySet<string>>(getFavoritesSnapshot);

  useEffect(() => {
    const unsubscribe = subscribeFavorites(setFavorites);
    // Kick a hydrate in case this is the first mount before any read.
    void hydrateFavorites();
    return unsubscribe;
  }, []);

  const toggle = useCallback((id: string) => {
    void toggleFavorite(id);
  }, []);

  return { favorites, toggle };
}
