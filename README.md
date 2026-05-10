# CRAVE

Türkçe konuşulan, dürüstlüğe dayalı bir bağımlılık geri kazanım uygulaması.
Bir dürtü hissettiğinde **RESIST** orb'una basarsın; tetiklediğin dürtü için
bir zamanlayıcı başlar. Saniyeler geçtikçe puan birikir; dolduran her cycle
ekstra bonus verir. Sonunda **I Resisted** ya da **I gave in** dersin —
ikincisi puan kırmaz, streak'i sadece dondurur. Kazandığında anı toplulukla
paylaşabilirsin.

Gamification yok. Cezalandırma yok. Dignified bir ton.

## Stack

- **Expo SDK 54** · React Native 0.81 · React 19
- **expo-router 6** (file-based routing)
- **Reanimated 4** (worklets, UI thread animasyonları)
- **react-native-svg** (timer arc)
- **Supabase JS v2** (auth + Postgres + realtime + edge functions)
- **AsyncStorage** (offline cache + active session snapshot)
- **Anthropic SDK** (yardımcı chat — Supabase Edge Function proxy üzerinden)

## Kurulum

```bash
git clone https://github.com/YusufKoc97/crave.git
cd crave
npm install
cat > .env.local << 'EOF'
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
# İsteğe bağlı — AI asistan için (aşağıdaki migration + edge function bölümüne bak)
# EXPO_PUBLIC_ASSISTANT_URL=https://YOUR_PROJECT.supabase.co/functions/v1/assistant
EOF
npx expo start --web    # ya da --ios / --android
```

`.env.local` dosyası Supabase erişimi olmadan da uygulamayı çalıştırmak istersen
şu dev-only bayrağı kabul eder:

```bash
EXPO_PUBLIC_DEV_SKIP_AUTH=1
```

Bu auth ve username gate'lerini atlatır, orb ekranına doğrudan iniş yapar.
`__DEV__` ile korumalı — production bundle'larında derlenip çıkarılır.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm start` | Expo dev server |
| `npm run web` / `ios` / `android` | Platform-spesifik başlatma |
| `npm test` | Vitest unit test suite (CI-friendly, watch yok) |
| `npm run test:watch` | Vitest watch modu |
| `npm run typecheck` | `tsc --noEmit` |

Test scope sadece **pure logic** — puan formülü, streak kuralı, emoji arama,
Türkçe relative time. RN/Supabase/React bileşenleri Vitest'te yüklenmiyor;
component testi Maestro/Detox işi.

## Veritabanı Migrasyonları

Tüm migrasyonlar `supabase` SQL Editor'dan elle çalıştırılır. **Drop yok,
hep additive.**

### Başlangıç şeması

`profiles`, `addictions`, `craving_sessions`, `momentum_log`, `handle_new_user`
trigger ve RLS politikalarını oluşturan ilk SQL — repo'nun ilk commit'inde.

### Sonraki additive migrasyonlar

```sql
-- Community özelliği
CREATE TABLE IF NOT EXISTS forum_posts (...);
CREATE TABLE IF NOT EXISTS forum_likes (...);
-- forum_posts.like_count trigger'ı
-- profiles'a momentum + streak kolonları

-- Username uniqueness
ALTER TABLE profiles
  ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Post moderation (rapor mekanizması)
CREATE TABLE IF NOT EXISTS forum_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
ALTER TABLE forum_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporter_insert" ON forum_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reporter_read" ON forum_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());

-- forum_likes cascade on post delete (gerekirse)
ALTER TABLE forum_likes
  DROP CONSTRAINT forum_likes_post_id_fkey,
  ADD CONSTRAINT forum_likes_post_id_fkey
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE;

-- Custom addiction multi-device sync
ALTER TABLE addictions
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#10B981',
  ADD COLUMN IF NOT EXISTS sensitivity int NOT NULL DEFAULT 5;
ALTER TABLE addictions
  ALTER COLUMN max_duration_minutes DROP NOT NULL,
  ALTER COLUMN max_duration_minutes SET DEFAULT 9;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS hidden_defaults text[] NOT NULL DEFAULT '{}';
```

Hangisinin koştuğu hangisinin koşmadığı sende — `CREATE TABLE IF NOT EXISTS`
ve `ADD COLUMN IF NOT EXISTS` ile tekrar çalıştırmak güvenli.

## AI Yardımcı (İsteğe Bağlı)

`/assistant` ekranı, kullanıcı dürtü anında konuşabileceği Türkçe bir asistan
sunuyor. Anthropic API anahtarı **client'ta tutulamaz** — bir Supabase Edge
Function üzerinden proxy edilir.

`supabase/functions/assistant/index.ts`:

```ts
import Anthropic from 'npm:@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

Deno.serve(async (req) => {
  // verify JWT (verify-jwt=true on deploy)
  const { messages, system } = await req.json();
  const result = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system,
    messages,
  });
  const text = result.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return Response.json({ text });
});
```

Deploy:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy assistant   # verify-jwt=true varsayılan
```

`.env.local`'a `EXPO_PUBLIC_ASSISTANT_URL` ekle. Eklenmezse `/assistant` ekranı
"henüz ayarlı değil" empty state'i gösterir, çökmez.

## Realtime

Community feed Supabase realtime channel kullanıyor. Supabase dashboard →
**Database → Replication → `supabase_realtime` publication**'da `forum_posts`
için INSERT olayını enable etmek gerekiyor.

## Proje Hafızası

[`CLAUDE.md`](./CLAUDE.md) projenin "neden" sorularını kayıt altında tutuyor:
mimari kararlar, schema gotcha'ları, bekleyen işler, son zaman atılan
fix'ler. Yeni bir oturuma başlarken oradan başlamak en hızlı yol.

## Lisans

Henüz lisans dosyası yok. İhtiyaç olursa eklenecek.
