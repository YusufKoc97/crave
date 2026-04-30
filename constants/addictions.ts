import type { ComponentProps } from 'react';
import {
  MaterialCommunityIcons,
  Ionicons,
  FontAwesome5,
} from '@expo/vector-icons';

export type IconLib = 'mci' | 'ion' | 'fa5';

export type Addiction = {
  id: string;
  name: string;
  emoji: string;
  iconLib: IconLib;
  iconName: string;
  color: string;
  bgGlow: string;
  /** 1 (mild) → 10 (severe). Drives both the timer ceiling and points reward. */
  sensitivity: number;
};

export const ICON_COMPONENTS = {
  mci: MaterialCommunityIcons,
  ion: Ionicons,
  fa5: FontAwesome5,
} as const;

export type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type IonName = ComponentProps<typeof Ionicons>['name'];
export type Fa5Name = ComponentProps<typeof FontAwesome5>['name'];

/**
 * Map a 1-10 sensitivity score to one craving cycle in minutes. Tuned to the
 * 5-15 min window where most urges naturally peak and pass — long ceilings
 * (30+ min) felt punishing in usability tests.
 *
 *   1 → 5 min, 5 → 9 min, 10 → 15 min
 */
export function maxMinutesFor(sensitivity: number): number {
  const s = Math.max(1, Math.min(10, sensitivity));
  return Math.round(5 + (s - 1) * (10 / 9));
}

export const DEFAULT_ADDICTIONS: Addiction[] = [
  {
    id: 'impulse',
    name: 'Impulse',
    emoji: '💳',
    iconLib: 'mci',
    iconName: 'lightning-bolt',
    color: '#10B981',
    bgGlow: 'rgba(16, 185, 129, 0.16)',
    sensitivity: 4,
  },
  {
    id: 'nicotine',
    name: 'Nicotine',
    emoji: '🚬',
    iconLib: 'mci',
    iconName: 'smoking',
    color: '#94A3B8',
    bgGlow: 'rgba(148, 163, 184, 0.14)',
    sensitivity: 6,
  },
  {
    id: 'alcohol',
    name: 'Alcohol',
    emoji: '🍷',
    iconLib: 'mci',
    iconName: 'glass-wine',
    color: '#FBBF24',
    bgGlow: 'rgba(251, 191, 36, 0.14)',
    sensitivity: 7,
  },
  {
    id: 'caffeine',
    name: 'Caffeine',
    emoji: '☕',
    iconLib: 'mci',
    iconName: 'coffee',
    color: '#FB923C',
    bgGlow: 'rgba(251, 146, 60, 0.14)',
    sensitivity: 5,
  },
  {
    id: 'feed',
    name: 'The Feed',
    emoji: '📱',
    iconLib: 'mci',
    iconName: 'cellphone',
    color: '#3B82F6',
    bgGlow: 'rgba(59, 130, 246, 0.14)',
    sensitivity: 7,
  },
  {
    id: 'substance',
    name: 'Substance',
    emoji: '💊',
    iconLib: 'mci',
    iconName: 'pill',
    color: '#F472B6',
    bgGlow: 'rgba(244, 114, 182, 0.14)',
    sensitivity: 9,
  },
  {
    id: 'binge',
    name: 'Binge',
    emoji: '🍾',
    iconLib: 'mci',
    iconName: 'food-drumstick',
    color: '#FB923C',
    bgGlow: 'rgba(251, 146, 60, 0.14)',
    sensitivity: 6,
  },
  {
    id: 'urge',
    name: 'Urge',
    emoji: '🙈',
    iconLib: 'mci',
    iconName: 'eye-off',
    color: '#EC4899',
    bgGlow: 'rgba(236, 72, 153, 0.14)',
    sensitivity: 5,
  },
  {
    id: 'bet',
    name: 'The Bet',
    emoji: '🎴',
    iconLib: 'mci',
    iconName: 'cards-playing-outline',
    color: '#A78BFA',
    bgGlow: 'rgba(167, 139, 250, 0.14)',
    sensitivity: 8,
  },
];
