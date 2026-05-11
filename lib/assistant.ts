import { supabase } from './supabase';

/**
 * AI assistant proxy.
 *
 * The chat lives behind a Supabase Edge Function — the Anthropic API key
 * MUST stay server-side. The client posts the conversation; the function
 * forwards it to Anthropic with the key from its env, then returns the
 * assistant's reply.
 *
 * Two transport shapes are supported:
 *   1. `sendAssistantMessage()` — one-shot JSON post / JSON response.
 *      Older edge functions / fallback when SSE isn't available.
 *   2. `streamAssistantMessage()` — SSE: tokens land in the UI as
 *      Anthropic emits them. Same auth + URL; the client distinguishes
 *      by passing { stream: true } in the body.
 *
 * The expected Edge Function (`supabase/functions/assistant/index.ts`):
 *
 *   import Anthropic from 'npm:@anthropic-ai/sdk';
 *   const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
 *
 *   Deno.serve(async (req) => {
 *     // verify JWT (verify_jwt=true on deploy)
 *     const { messages, system, stream } = await req.json();
 *
 *     if (stream) {
 *       const sse = await client.messages.stream({
 *         model: 'claude-haiku-4-5',
 *         max_tokens: 1024,
 *         system,
 *         messages,
 *       });
 *       const body = new ReadableStream({
 *         async start(controller) {
 *           for await (const event of sse) {
 *             if (
 *               event.type === 'content_block_delta' &&
 *               event.delta.type === 'text_delta'
 *             ) {
 *               controller.enqueue(
 *                 new TextEncoder().encode(
 *                   `data: ${JSON.stringify({ delta: event.delta.text })}\n\n`
 *                 )
 *               );
 *             }
 *           }
 *           controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
 *           controller.close();
 *         },
 *       });
 *       return new Response(body, {
 *         headers: {
 *           'Content-Type': 'text/event-stream',
 *           'Cache-Control': 'no-cache',
 *           Connection: 'keep-alive',
 *         },
 *       });
 *     }
 *
 *     const result = await client.messages.create({
 *       model: 'claude-haiku-4-5',
 *       max_tokens: 1024,
 *       system,
 *       messages,
 *     });
 *     const text = result.content
 *       .filter((b) => b.type === 'text')
 *       .map((b) => b.text)
 *       .join('');
 *     return Response.json({ text });
 *   });
 *
 * Deploy with:
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   supabase functions deploy assistant --no-verify-jwt=false
 */

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const ASSISTANT_SYSTEM_PROMPT = `Sen CRAVE adlı bir bağımlılık geri kazanım uygulamasında yardımcı bir sesisin. Kullanıcı bir dürtüyle başa çıkmaya çalışıyor olabilir, ya da tetiklendikten sonra konuşacak bir yer arıyor olabilir.

Tonun:
- Sakin, saygılı, vasat olmayan. Asla didaktik değil.
- Türkçe konuş. Kullanıcı başka dilde yazarsa o dile geç.
- Dürtü "kötü", direnç "iyi" çerçevesinden uzak dur — yargılama. Kullanıcı bir an'da, sen onunla o anı geçiriyorsun.

Yapabileceklerin:
- Kısa, somut başa çıkma teknikleri öner (urge surfing, 5-4-3-2-1 grounding, suya gitme, yürüyüş, derin nefes).
- Kullanıcının hislerini yansıt; ardından küçük bir adım sor: "Şu an nereye dikkat verebilirsin?".
- 30-60 saniyelik nefes egzersizi öner ve adım adım rehberlik et.
- Tetikleyiciyi adlandırmaya yardım et ("şimdi en güçlü hangi düşünce?").

Yapmaman gerekenler:
- Profesyonel terapi yerine geçtiğini ima etme. Akut riskli durumda (intihar düşüncesi, bedenine zarar verme) kişiyi hemen 182 (Türkiye intihar önleme) ya da 112'ye yönlendir, soyut tavsiye verme.
- Geçmiş konuşma "kazanımları" gibi konuşma — bu seans yeni başladı.
- Bağımlılık türünü çözmeye çalışma; "kullansam ne olur" sorusuna pozitif/negatif yanıt verme.
- Çok uzun yazma. Genelde 2-4 cümle yeter. Listeler nadiren işe yarar.

Cevaplarını kısa tut. Kullanıcı seninle konuşuyor, bir kitap okumuyor.`;

function getAssistantUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_ASSISTANT_URL;
  if (!url || url.length === 0) return null;
  return url;
}

export function isAssistantConfigured(): boolean {
  return getAssistantUrl() !== null;
}

export async function sendAssistantMessage(
  history: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  const url = getAssistantUrl();
  if (!url) {
    throw new Error(
      'Yardımcı henüz ayarlanmamış. EXPO_PUBLIC_ASSISTANT_URL eksik.'
    );
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('Yardımcıya erişmek için giriş yapmış olmalısın.');
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messages: history,
      system: ASSISTANT_SYSTEM_PROMPT,
    }),
    signal,
  });
  if (!res.ok) {
    throw new Error(
      `Yardımcı şu an cevap veremiyor (${res.status}). Birkaç dakika sonra tekrar dene.`
    );
  }
  const json = (await res.json()) as { text?: string };
  if (!json.text || json.text.length === 0) {
    throw new Error('Boş yanıt geldi. Tekrar dene.');
  }
  return json.text;
}

/**
 * SSE-based streaming variant. The edge function emits Anthropic's
 * content_block_delta events as `data: {"delta": "..."}` lines; this
 * function parses each frame and forwards just the delta string to the
 * caller via onChunk. Resolves with the full concatenated text when
 * the stream terminates (`data: [DONE]` or EOF).
 *
 * AbortSignal cancels the underlying fetch — the UI passes the same
 * controller it'd pass to the non-streaming variant.
 *
 * Falls back to throwing on:
 *   - non-OK HTTP
 *   - malformed SSE frame (we skip individual bad frames but bail
 *     if the body never produces anything)
 *
 * Caller pattern in app/assistant.tsx:
 *
 *   let accumulated = '';
 *   await streamAssistantMessage(history, {
 *     signal,
 *     onChunk: (delta) => {
 *       accumulated += delta;
 *       // patch the in-flight assistant message in state
 *     },
 *   });
 */
export async function streamAssistantMessage(
  history: ChatMessage[],
  opts: {
    signal?: AbortSignal;
    onChunk: (delta: string) => void;
  }
): Promise<string> {
  const url = getAssistantUrl();
  if (!url) {
    throw new Error(
      'Yardımcı henüz ayarlanmamış. EXPO_PUBLIC_ASSISTANT_URL eksik.'
    );
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('Yardımcıya erişmek için giriş yapmış olmalısın.');
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      messages: history,
      system: ASSISTANT_SYSTEM_PROMPT,
      stream: true,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(
      `Yardımcı şu an cevap veremiyor (${res.status}). Birkaç dakika sonra tekrar dene.`
    );
  }
  if (!res.body) {
    throw new Error('Yanıt akışı yok. Tekrar dene.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line (\n\n). Each frame may
    // span multiple `data:` lines but ours is single-line in practice.
    let nlIdx;
    while ((nlIdx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, nlIdx);
      buffer = buffer.slice(nlIdx + 2);
      for (const line of frame.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') {
          return accumulated;
        }
        try {
          const parsed = JSON.parse(payload) as { delta?: string };
          if (parsed.delta) {
            accumulated += parsed.delta;
            opts.onChunk(parsed.delta);
          }
        } catch {
          // Skip a malformed frame; the next one may be fine.
        }
      }
    }
  }

  if (accumulated.length === 0) {
    throw new Error('Boş yanıt geldi. Tekrar dene.');
  }
  return accumulated;
}
