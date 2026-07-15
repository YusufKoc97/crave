import { t } from '@/lib/i18n';

/**
 * Faz 5 — trigger whitelist. Structure only; display strings come
 * from i18n (`triggers.common.<id>` for shared triggers,
 * `triggers.<addictionId>.<id>` for addiction-specific ones).
 *
 * Catalog is CLIENT-ONLY (Faz 5 karar #2). The Edge Function does
 * not validate trigger ids and there is no DB CHECK constraint —
 * the client is trusted to pick from this list. Trigger data feeds
 * Modül 3 (heatmap); if an unknown id ever slips in, the heatmap
 * gracefully bucket it as "unknown".
 *
 * If we ever need cross-runtime validation, mirror the ids under
 * `shared/triggers.ts` the same way `shared/catalog.ts` mirrors
 * addiction ids for the score Edge Function.
 */

export type Trigger = {
  id: string;
  /** 'common' when the trigger is shared across all addictions,
   *  otherwise the addiction_id it belongs to. */
  scope: 'common' | string;
  displayOrder: number;
};

/**
 * Eight shared triggers that appear on every craving-start screen
 * above the addiction-specific list. Kept short on purpose — a
 * longer list turns the picker into a wall of chips.
 */
export const COMMON_TRIGGERS: readonly Trigger[] = [
  { id: 'stress', scope: 'common', displayOrder: 1 },
  { id: 'loneliness', scope: 'common', displayOrder: 2 },
  { id: 'boredom', scope: 'common', displayOrder: 3 },
  { id: 'anxiety', scope: 'common', displayOrder: 4 },
  { id: 'sadness', scope: 'common', displayOrder: 5 },
  { id: 'tiredness', scope: 'common', displayOrder: 6 },
  { id: 'anger', scope: 'common', displayOrder: 7 },
  { id: 'social_situation', scope: 'common', displayOrder: 8 },
] as const;

/**
 * Addiction-specific triggers. Keys must match ADDICTION_CATALOG
 * ids from `constants/addictions.ts`. Missing key = "no specific
 * triggers for this addiction" — the picker renders the common
 * section only.
 */
export const ADDICTION_TRIGGERS: Record<string, readonly Trigger[]> = {
  nicotine: [
    { id: 'after_coffee', scope: 'nicotine', displayOrder: 1 },
    { id: 'after_meal', scope: 'nicotine', displayOrder: 2 },
    { id: 'with_alcohol', scope: 'nicotine', displayOrder: 3 },
    { id: 'someone_smoking', scope: 'nicotine', displayOrder: 4 },
    { id: 'morning_routine', scope: 'nicotine', displayOrder: 5 },
    { id: 'driving', scope: 'nicotine', displayOrder: 6 },
    { id: 'break_time', scope: 'nicotine', displayOrder: 7 },
    { id: 'phone_in_hand', scope: 'nicotine', displayOrder: 8 },
  ],
  alcohol: [
    { id: 'evening_after_work', scope: 'alcohol', displayOrder: 1 },
    { id: 'weekend', scope: 'alcohol', displayOrder: 2 },
    { id: 'social_gathering', scope: 'alcohol', displayOrder: 3 },
    { id: 'restaurant_bar', scope: 'alcohol', displayOrder: 4 },
    { id: 'stressed_at_work', scope: 'alcohol', displayOrder: 5 },
    { id: 'watching_tv', scope: 'alcohol', displayOrder: 6 },
    { id: 'someone_offered', scope: 'alcohol', displayOrder: 7 },
    { id: 'special_occasion', scope: 'alcohol', displayOrder: 8 },
  ],
  caffeine: [
    { id: 'morning_routine', scope: 'caffeine', displayOrder: 1 },
    { id: 'afternoon_slump', scope: 'caffeine', displayOrder: 2 },
    { id: 'meeting_break', scope: 'caffeine', displayOrder: 3 },
    { id: 'studying', scope: 'caffeine', displayOrder: 4 },
    { id: 'need_focus', scope: 'caffeine', displayOrder: 5 },
    { id: 'warm_drink_craving', scope: 'caffeine', displayOrder: 6 },
    { id: 'habit_routine', scope: 'caffeine', displayOrder: 7 },
  ],
  vape: [
    { id: 'phone_in_hand', scope: 'vape', displayOrder: 1 },
    { id: 'break_time', scope: 'vape', displayOrder: 2 },
    { id: 'someone_vaping', scope: 'vape', displayOrder: 3 },
    { id: 'hidden_spot', scope: 'vape', displayOrder: 4 },
    { id: 'boredom_scroll', scope: 'vape', displayOrder: 5 },
    { id: 'after_meal', scope: 'vape', displayOrder: 6 },
    { id: 'morning_routine', scope: 'vape', displayOrder: 7 },
    { id: 'concert_event', scope: 'vape', displayOrder: 8 },
  ],
  gambling: [
    { id: 'app_notification', scope: 'gambling', displayOrder: 1 },
    { id: 'money_worry', scope: 'gambling', displayOrder: 2 },
    { id: 'big_game', scope: 'gambling', displayOrder: 3 },
    { id: 'payday', scope: 'gambling', displayOrder: 4 },
    { id: 'chasing_loss', scope: 'gambling', displayOrder: 5 },
    { id: 'friend_won', scope: 'gambling', displayOrder: 6 },
    { id: 'weekend_evening', scope: 'gambling', displayOrder: 7 },
    { id: 'alone_at_night', scope: 'gambling', displayOrder: 8 },
  ],
  junk_food: [
    { id: 'late_night', scope: 'junk_food', displayOrder: 1 },
    { id: 'after_argument', scope: 'junk_food', displayOrder: 2 },
    { id: 'watching_tv', scope: 'junk_food', displayOrder: 3 },
    { id: 'passing_fast_food', scope: 'junk_food', displayOrder: 4 },
    { id: 'sweet_craving', scope: 'junk_food', displayOrder: 5 },
    { id: 'salty_craving', scope: 'junk_food', displayOrder: 6 },
    { id: 'cheat_day_thought', scope: 'junk_food', displayOrder: 7 },
    { id: 'emotional_pain', scope: 'junk_food', displayOrder: 8 },
  ],
  shopping: [
    { id: 'notification_email', scope: 'shopping', displayOrder: 1 },
    { id: 'payday', scope: 'shopping', displayOrder: 2 },
    { id: 'social_media_ad', scope: 'shopping', displayOrder: 3 },
    { id: 'bad_mood', scope: 'shopping', displayOrder: 4 },
    { id: 'sale_announcement', scope: 'shopping', displayOrder: 5 },
    { id: 'comparing_others', scope: 'shopping', displayOrder: 6 },
    { id: 'bored_scrolling', scope: 'shopping', displayOrder: 7 },
    { id: 'feeling_deserving', scope: 'shopping', displayOrder: 8 },
  ],
  pmo: [
    { id: 'alone_private', scope: 'pmo', displayOrder: 1 },
    { id: 'before_sleep', scope: 'pmo', displayOrder: 2 },
    { id: 'after_waking', scope: 'pmo', displayOrder: 3 },
    { id: 'phone_in_hand', scope: 'pmo', displayOrder: 4 },
    { id: 'suggestive_content', scope: 'pmo', displayOrder: 5 },
    { id: 'sexual_thought', scope: 'pmo', displayOrder: 6 },
    { id: 'post_argument', scope: 'pmo', displayOrder: 7 },
    { id: 'winding_down', scope: 'pmo', displayOrder: 8 },
  ],
  doomscroll: [
    { id: 'notification', scope: 'doomscroll', displayOrder: 1 },
    { id: 'waking_up', scope: 'doomscroll', displayOrder: 2 },
    { id: 'before_sleep', scope: 'doomscroll', displayOrder: 3 },
    { id: 'bathroom', scope: 'doomscroll', displayOrder: 4 },
    { id: 'waiting_somewhere', scope: 'doomscroll', displayOrder: 5 },
    { id: 'after_stressful', scope: 'doomscroll', displayOrder: 6 },
    { id: 'habit_autopilot', scope: 'doomscroll', displayOrder: 7 },
    { id: 'fear_missing_out', scope: 'doomscroll', displayOrder: 8 },
  ],
  gaming: [
    { id: 'one_more_round', scope: 'gaming', displayOrder: 1 },
    { id: 'friends_online', scope: 'gaming', displayOrder: 2 },
    { id: 'new_release', scope: 'gaming', displayOrder: 3 },
    { id: 'bad_day_escape', scope: 'gaming', displayOrder: 4 },
    { id: 'weekend', scope: 'gaming', displayOrder: 5 },
    { id: 'game_notification', scope: 'gaming', displayOrder: 6 },
    { id: 'ranking_pressure', scope: 'gaming', displayOrder: 7 },
    { id: 'habit_after_work', scope: 'gaming', displayOrder: 8 },
  ],
};

/** Full addiction-specific list for a given id, ordered. */
export function triggersFor(addictionId: string): readonly Trigger[] {
  return ADDICTION_TRIGGERS[addictionId] ?? [];
}

/**
 * i18n label lookup — abstracts the scope split so callers just
 * pass a trigger and get back a rendered string, without having to
 * remember which namespace ('triggers.common' vs
 * `triggers.<addictionId>`) the id lives under.
 */
export function triggerLabel(trigger: Trigger): string {
  if (trigger.scope === 'common') {
    return t(`triggers.common.${trigger.id}`);
  }
  return t(`triggers.${trigger.scope}.${trigger.id}`);
}
