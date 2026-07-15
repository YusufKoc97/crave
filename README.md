# CRAVE

Türkçe konuşulan, dürüstlüğe dayalı bir bağımlılık geri kazanım uygulaması.
Bir dürtü hissettiğinde **RESIST** orb'una basarsın; tetiklediğin dürtü için
bir zamanlayıcı başlar. Saniyeler geçtikçe puan birikir; dolduran her cycle
ekstra bonus verir. Sonunda **I Resisted** ya da **I gave in** dersin —
ikincisi puan kırmaz, streak'i sadece dondurur.

Gamification yok. Cezalandırma yok. Dignified bir ton.

## Stack

- **Expo SDK 54** · React Native 0.81 · React 19
- **expo-router 6** (file-based routing)
- **Reanimated 4** (worklets, UI thread animasyonları)
- **react-native-svg** (timer arc)
- **Supabase JS v2** (auth + Postgres + edge functions)
- **AsyncStorage** (offline cache + active session snapshot)

## Kurulum

```bash
git clone https://github.com/YusufKoc97/crave.git
cd crave
npm install
cat > .env.local << 'EOF'
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
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

| Komut                             | Ne yapar                                        |
| --------------------------------- | ----------------------------------------------- |
| `npm start`                       | Expo dev server                                 |
| `npm run web` / `ios` / `android` | Platform-spesifik başlatma                      |
| `npm test`                        | Vitest unit test suite (CI-friendly, watch yok) |
| `npm run test:watch`              | Vitest watch modu                               |
| `npm run typecheck`               | `tsc --noEmit`                                  |

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
-- profiles'a momentum + streak kolonları
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS momentum int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS streak int NOT NULL DEFAULT 0;

-- Username uniqueness (handle, Modül 4 için saklanıyor)
ALTER TABLE profiles
  ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Custom addiction multi-device sync
-- (Faz 2'de 20 sabit katalog gelecek, bu tablo o zaman revize edilecek.)
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

### Faz 1 cleanup DROP

Community feed, reflection journal ve AI asistan Faz 1'de kaldırıldı.
DB'de kalan tablolar aşağıdaki SQL ile bırakılır:

```sql
DROP TABLE IF EXISTS forum_reports CASCADE;
DROP TABLE IF EXISTS forum_likes   CASCADE;
DROP TABLE IF EXISTS forum_posts   CASCADE;
DROP TABLE IF EXISTS reflections   CASCADE;
-- profiles.username kolonu Modül 4 için tutuluyor (handle bilgisi).
```

### Faz 5 craving-session triggers migration

Adds `craving_session_triggers` for Modül 3's future heatmap. Runs
in the SQL Editor top-to-bottom:

```
supabase/migrations/005_craving_session_triggers.sql
```

Client-owned RLS (INSERT + DELETE + SELECT policies scoped by
session ownership); the Edge Function does not touch this table.

Then re-deploy the Edge Function — Faz 5 adds intensity persistence
to the `craving_sessions` UPDATE:

```bash
supabase functions deploy resolve-craving
```

### Faz 4 rank ladder migration

Adds the `user_unlocked_ranks` table for Module 1 (Resistance Journey).
SQL lives at
[`supabase/migrations/004_rank_ladder.sql`](supabase/migrations/004_rank_ladder.sql).
Run it top-to-bottom in the SQL Editor, then re-deploy the updated
Edge Function (it now writes unlock rows and returns
`newly_unlocked_ranks` in the response):

```bash
supabase functions deploy resolve-craving
```

No env var setup needed — same secrets as Faz 3.

### Faz 3 backend scoring migration

Enum rename (`completed → resolved`, `gave_in → failed`), column
rename (`points_earned → points_delta`), and the per-addiction score
storage. Full SQL lives at
[`supabase/migrations/003_backend_scoring.sql`](supabase/migrations/003_backend_scoring.sql)
— open it in the SQL Editor and run top-to-bottom.

After the migration lands, deploy the resolve-craving Edge Function:

```bash
# One-time login (skip if already authenticated).
supabase login

# Link the CLI to the project (skip if `supabase/config.toml` exists).
supabase link --project-ref scdedlhpbcddoqphauxo

# Deploy — the shared/ directory is imported by the function, so
# `--no-verify-jwt=false` (the default) is what we want; users must
# be authenticated to call resolve-craving.
supabase functions deploy resolve-craving
```

No env vars need setting beyond the defaults — the Edge Function
reads `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` from Supabase's built-in secrets.

### Faz 2 katalog migration

10 sabit katalog + soft-delete tracking tablosu. Custom addictions
kalktığı için `addictions` tablosu ve `profiles.hidden_defaults`
kolonu da drop. Dev'de gerçek kullanıcı verisi yok — hepsi TRUNCATE
edilir.

```sql
-- Dev-only clean slate: test verisi + eski custom addictions.
TRUNCATE craving_sessions RESTART IDENTITY CASCADE;
TRUNCATE addictions       RESTART IDENTITY CASCADE;
UPDATE profiles SET momentum = 50, streak = 0;

-- Legacy custom-addictions tablosu ve hidden_defaults kolonu artık
-- kullanılmıyor. is_active soft-delete tam ikame.
DROP TABLE  IF EXISTS addictions               CASCADE;
ALTER TABLE profiles DROP COLUMN IF EXISTS hidden_defaults;

-- Yeni user_addictions tablosu — hangi katalog id'leri user takip
-- ediyor + soft-delete. addiction_id CHECK constraint ile
-- katalog dışına kilitlenmiş.
CREATE TABLE IF NOT EXISTS user_addictions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addiction_id text NOT NULL
    CHECK (addiction_id IN (
      'nicotine','alcohol','caffeine','vape','gambling',
      'junk_food','shopping','pmo','doomscroll','gaming'
    )),
  added_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, addiction_id)
);
ALTER TABLE user_addictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON user_addictions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

## Proje Hafızası

[`CLAUDE.md`](./CLAUDE.md) projenin "neden" sorularını kayıt altında tutuyor:
mimari kararlar, schema gotcha'ları, bekleyen işler, son zaman atılan
fix'ler. Yeni bir oturuma başlarken oradan başlamak en hızlı yol.

## Lisans

Henüz lisans dosyası yok. İhtiyaç olursa eklenecek.
