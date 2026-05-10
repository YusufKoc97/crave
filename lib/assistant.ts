import { supabase } from './supabase';

/**
 * AI assistant proxy.
 *
 * The chat lives behind a Supabase Edge Function — the Anthropic API key
 * MUST stay server-side. The client posts the conversation; the function
 * forwards it to Anthropic with the key from its env, then returns the
 * assistant's reply.
 *
 * The expected Edge Function (`supabase/functions/assistant/index.ts`):
 *
 *   import Anthropic from 'npm:@anthropic-ai/sdk';
 *   const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
 *   Deno.serve(async (req) => {
 *     // ... auth check via supabaseClient.auth.getUser(req.headers.get('Authorization')) ...
 *     const { messages, system } = await req.json();
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
 *
 * (verify-jwt should stay ON — every call should be authenticated so we
 * don't ship anonymous credit to anyone who finds the URL.)
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
