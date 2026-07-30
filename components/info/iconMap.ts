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
 * Addiction → Lucide icon mapping — the app's designed glyph set.
 *
 * Originally scoped to the Info tab (karar #2), later promoted to
 * the whole app by explicit decision: wherever an addiction shows a
 * glyph (home orb fan, Feeding the Core rows, Info cards), it is
 * THIS icon, never the platform emoji — iOS emojis clashed with the
 * drawn language everywhere else. Adding a new addiction to the
 * catalog and forgetting an entry here falls through to a default
 * icon — the surface still renders, just without a themed glyph.
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
