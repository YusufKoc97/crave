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

## Proje Hafızası

[`CLAUDE.md`](./CLAUDE.md) projenin "neden" sorularını kayıt altında tutuyor:
mimari kararlar, schema gotcha'ları, bekleyen işler, son zaman atılan
fix'ler. Yeni bir oturuma başlarken oradan başlamak en hızlı yol.

## Lisans

Henüz lisans dosyası yok. İhtiyaç olursa eklenecek.
