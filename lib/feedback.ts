import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Client wrapper for the `submit-feedback` Edge Function (the
 * "Report a problem" channel).
 *
 * The function replies `{ ok: true }` on success and
 * `{ error: <reason> }` with a 4xx/5xx otherwise. As in
 * `lib/accountDeletion.ts`, supabase-js hands 4xx/5xx back as a
 * `FunctionsHttpError` whose JSON body lives on `error.context` (the
 * raw `Response`), not on `error.message` — so we unwrap it to tell a
 * "message too short" apart from "you're rate limited" apart from
 * "the network is down", and surface the right line to the user.
 */

/** Kept in lockstep with the CHECK in migration 015 and the Edge
 *  Function so an honest submission never round-trips just to fail. */
export const FEEDBACK_MIN_LENGTH = 10;
export const FEEDBACK_MAX_LENGTH = 2000;

export type FeedbackCategory = 'bug' | 'idea' | 'other';

export type FeedbackResult =
  | { ok: true }
  | {
      ok: false;
      /** Maps to an i18n line; 'rate_limited' also carries the wait. */
      reason: 'too_short' | 'too_long' | 'rate_limited' | 'network' | 'server';
      retryAfterSeconds?: number;
    };

function currentPlatform(): 'ios' | 'android' | 'web' | undefined {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
  if (Platform.OS === 'web') return 'web';
  return undefined;
}

export async function submitFeedback(
  message: string,
  category: FeedbackCategory
): Promise<FeedbackResult> {
  const trimmed = message.trim();
  // Cheap local guard so an obviously-too-short note never spends a
  // request (and a rate-limit slot) proving it.
  if (trimmed.length < FEEDBACK_MIN_LENGTH)
    return { ok: false, reason: 'too_short' };
  if (trimmed.length > FEEDBACK_MAX_LENGTH)
    return { ok: false, reason: 'too_long' };

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? undefined;

  const { data, error } = await supabase.functions.invoke('submit-feedback', {
    body: {
      message: trimmed,
      category,
      app_version: appVersion,
      platform: currentPlatform(),
    },
  });

  if (error) {
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof (ctx as { json?: unknown }).json === 'function') {
      try {
        const res = ctx as Response;
        const parsed = (await res.json()) as {
          error?: unknown;
          retry_after_seconds?: unknown;
        };
        if (parsed.error === 'rate_limited') {
          return {
            ok: false,
            reason: 'rate_limited',
            retryAfterSeconds:
              typeof parsed.retry_after_seconds === 'number'
                ? parsed.retry_after_seconds
                : undefined,
          };
        }
        if (parsed.error === 'message_too_short') {
          return { ok: false, reason: 'too_short' };
        }
        if (parsed.error === 'message_too_long') {
          return { ok: false, reason: 'too_long' };
        }
        return { ok: false, reason: 'server' };
      } catch {
        return { ok: false, reason: 'server' };
      }
    }
    // No Response at all — nothing was reached.
    return { ok: false, reason: 'network' };
  }

  if (data && (data as { ok?: unknown }).ok === true) return { ok: true };
  return { ok: false, reason: 'server' };
}
