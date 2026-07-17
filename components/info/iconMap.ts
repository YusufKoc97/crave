import type { ComponentType } from 'react';
import {
  Beer,
  Cigarette,
  Cloud,
  Coffee,
  Dice5,
  EyeOff,
  Gamepad2,
  Sandwich,
  ShoppingBag,
  Smartphone,
  type LucideProps,
} from 'lucide-react-native';

/**
 * Info-tab local addiction → Lucide icon mapping.
 *
 * Scope guard (karar #2): the rest of the app (home orb, toolkit,
 * trigger map, active session) still renders `addiction.emoji`.
 * This map exists ONLY for the Info tab redesign. Adding a new
 * addiction to the catalog and forgetting to add an entry here
 * falls through to a generic `Circle` — the card still renders,
 * just without a themed glyph.
 */

const ICONS: Record<string, ComponentType<LucideProps>> = {
  nicotine: Cigarette,
  caffeine: Coffee,
  junk_food: Sandwich,
  doomscroll: Smartphone,
  alcohol: Beer,
  vape: Cloud,
  gambling: Dice5,
  shopping: ShoppingBag,
  pmo: EyeOff,
  gaming: Gamepad2,
};

export function lucideIconFor(addictionId: string): ComponentType<LucideProps> {
  return ICONS[addictionId] ?? Cigarette;
}
