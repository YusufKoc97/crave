import { supabase } from './supabase';

/**
 * Client wrapper for the `delete-account` Edge Function.
 *
 * The function replies `{ deleted: true }` on success (optionally with
 * a `warnings` list of non-fatal row purges) and
 * `{ error: 'delete_failed', stage }` with an HTTP 4xx/5xx on failure.
 *
 * supabase-js hands 4xx/5xx back as a `FunctionsHttpError` whose JSON
 * body lives on `error.context` (the raw `Response`) — NOT on
 * `error.message`. Every other call site in this app drops it; this
 * one unwraps it so the screen can show the user which stage broke.
 */

export type DeleteAccountResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; stage: string };

export async function deleteAccount(): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { confirm: 'DELETE' },
  });

  if (error) {
    let stage = 'network';
    const ctx = (error as { context?: unknown }).context;
    // `context` is the raw Response on FunctionsHttpError; absent on
    // FunctionsFetchError (no server was reached at all).
    if (ctx && typeof (ctx as { json?: unknown }).json === 'function') {
      try {
        const body = (await (ctx as Response).json()) as {
          stage?: unknown;
          error?: unknown;
        };
        if (typeof body.stage === 'string') stage = body.stage;
        else if (typeof body.error === 'string') stage = body.error;
        else stage = 'server';
      } catch {
        stage = 'server';
      }
    }
    return { ok: false, stage };
  }

  if (data && (data as { deleted?: unknown }).deleted === true) {
    const warnings = (data as { warnings?: unknown }).warnings;
    return {
      ok: true,
      warnings: Array.isArray(warnings) ? (warnings as string[]) : undefined,
    };
  }

  return { ok: false, stage: 'unexpected_response' };
}
