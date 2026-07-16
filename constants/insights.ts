/**
 * Client-side insight presentation constants.
 *
 * The rule engine + wire types live in `shared/insightRules.ts`
 * (cross-runtime). This file only carries UI-layer mapping —
 * category → Ionicons name — so the server never has to know
 * about icon libraries.
 */

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { InsightCategory } from '@/shared/insightRules';

type IonName = ComponentProps<typeof Ionicons>['name'];

/** Ionicons name per rule category. */
export const INSIGHT_CATEGORY_ICON: Record<InsightCategory, IonName> = {
  time: 'time-outline',
  trigger: 'flash-outline',
  technique: 'construct-outline',
  trend: 'trending-up-outline',
};

/** Known action keys the server may return. Keep in sync with rules. */
export type InsightActionKey = 'open_toolkit';
