/**
 * revenuecat-webhook — flips `profiles.is_premium` from RevenueCat events.
 *
 * This is the SERVER half of the premium entitlement loop. RevenueCat is
 * the source of truth for "did this user pay / is the subscription still
 * active"; it POSTs an event here on every change, and we mirror the
 * resulting entitlement onto `profiles.is_premium`. Both the client
 * (`useIsPremium()` via AuthContext) and the Edge gates (resolve-craving
 * Streak Protection) read that column, so this one write lights up every
 * premium surface.
 *
 * ── SKELETON STATUS ──────────────────────────────────────────────
 * Written ahead of the billing accounts (iOS-first). It is deployable
 * now and correct for the standard event set, but two things are pinned
 * to config that only exists once RevenueCat is set up:
 *   1. `app_user_id` MUST equal the Supabase auth user id. Achieve that
 *      by calling `Purchases.logIn(supabaseUserId)` (or configuring the
 *      appUserID) in the native SDK when we wire purchases — do NOT rely
 *      on RevenueCat's anonymous ids.
 *   2. The shared secret. Set an Authorization header on the RevenueCat
 *      webhook (Project → Integrations → Webhooks) and store the same
 *      value as the `REVENUECAT_WEBHOOK_TOKEN` function secret.
 *
 * Env (set via `supabase secrets set`):
 *   REVENUECAT_WEBHOOK_TOKEN   — shared secret matching the RC webhook
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — injected by the platform
 *
 * Deploy: `supabase functions deploy revenuecat-webhook --no-verify-jwt`
 *   (--no-verify-jwt: RevenueCat authenticates with the shared secret
 *    above, not a Supabase JWT, so the platform's JWT gate must be off.)
 *
 * RevenueCat event reference:
 *   https://www.revenuecat.com/docs/webhooks/event-types-and-fields
 */

// @ts-expect-error — Deno resolves this from its runtime, not npm.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_TOKEN = Deno.env.get('REVENUECAT_WEBHOOK_TOKEN') ?? '';

const jsonHeaders: Record<string, string> = {
  'content-type': 'application/json',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

/**
 * Map a RevenueCat event type to the entitlement it should leave behind.
 *   true  → user is premium now (grant / keep)
 *   false → user is no longer premium (revoke)
 *   null  → event carries no entitlement change we act on (ack + ignore)
 *
 * Note CANCELLATION is intentionally `null`: turning off auto-renew does
 * NOT end access — the user keeps premium until EXPIRATION fires. TEST is
 * the ping RevenueCat sends when you first save the webhook.
 */
function entitlementFor(type: string): boolean | null {
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
    case 'NON_RENEWING_PURCHASE':
    case 'SUBSCRIPTION_EXTENDED':
      return true;
    case 'EXPIRATION':
      return false;
    case 'CANCELLATION':
    case 'BILLING_ISSUE': // grace period — keep access until it expires
    case 'TEST':
      return null;
    default:
      return null;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  // Shared-secret auth. RevenueCat sends the exact Authorization header
  // value you configure; accept it raw or as `Bearer <token>`.
  const auth = req.headers.get('authorization') ?? '';
  const presented = auth.startsWith('Bearer ')
    ? auth.slice('Bearer '.length)
    : auth;
  if (!WEBHOOK_TOKEN || presented !== WEBHOOK_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  let payload: { event?: { type?: string; app_user_id?: string } };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'bad_json' }, 400);
  }

  const event = payload.event;
  const type = event?.type ?? '';
  const appUserId = event?.app_user_id ?? '';

  const desired = entitlementFor(type);
  if (desired === null) {
    // Acknowledged, nothing to change (e.g. TEST, CANCELLATION).
    return jsonResponse({ ok: true, ignored: type });
  }

  if (!appUserId) {
    return jsonResponse({ error: 'missing_app_user_id' }, 400);
  }

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error } = await svc
    .from('profiles')
    .update({ is_premium: desired })
    .eq('id', appUserId);

  if (error) {
    // 5xx so RevenueCat retries (it backs off and re-delivers on non-2xx).
    console.error('revenuecat-webhook: profile update failed', {
      type,
      appUserId,
      error,
    });
    return jsonResponse({ error: 'update_failed' }, 500);
  }

  return jsonResponse({ ok: true, type, is_premium: desired });
});
