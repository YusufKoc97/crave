# CRAVE — Project Memory

> **Yeni Claude oturumuna not:** Bu dosya bu projedeki sürekliliği taşır. Yeni
> bir cihazda (Mac/Windows) açıldığında, _önce bu dosyayı oku, sonra
> codebase'e bak_, kullanıcıyla beraber bıraktığın yerden devam et. Kullanıcı
> Türkçe konuşuyor, kararlarda buna saygı göster.

---

## 🎯 Uygulama Nedir

CRAVE, bağımlılık dürtüleriyle başa çıkmaya yardımcı olan bir mobil recovery
uygulaması. Türk kullanıcı odaklı (KVKK uyumlu), recovery topluluğu için
ciddi/tasarımlı bir ton — gamification yok, dignified.

Temel akış:

1. Kullanıcı bir dürtü hissediyor → ana ekrandaki RESIST orb'una basıyor
2. Bağımlılık seçici çıkıyor (9 preset + custom eklenebilir)
3. Bir bağımlılığa tıklayınca timer ekranı açılıyor
4. Timer sayar, kullanıcı "I Resisted" veya "I gave in" basıyor
5. Resist'te puan/momentum/streak kazanılıyor + topluluğa paylaşma seçeneği

## 📱 Tech Stack

- **Expo SDK 54** + React Native 0.81 + React 19
- **expo-router 6** (file-based routing)
- **Reanimated 4** (animasyonlar, worklets)
- **react-native-svg 15** (timer arc, neon ring spinner)
- **@expo/vector-icons** (Ionicons + MaterialCommunityIcons)
- **Supabase JS v2** (auth + DB)
- **AsyncStorage** (active session snapshot, onboarding flag)

## 📂 Dosya Yapısı

```
app/
  _layout.tsx          ─ Root Stack, AuthProvider, Active session restorer
  index.tsx            ─ Yönlendirici: onboarding → auth → tabs
  (onboarding)/
    _layout.tsx
    index.tsx          ─ 18+ yaş gate (DOB 3-input, age hesaplama)
    consent.tsx        ─ KVKK consent (terms + sağlık verisi açık rıza)
  (auth)/
    _layout.tsx
    sign-in.tsx        ─ Email + password, Türkçe error mesajları
    sign-up.tsx        ─ Aynı + email confirmation info banner
  (tabs)/
    _layout.tsx        ─ Custom pill tab bar (Ionicons), session-loss guard
    index.tsx          ─ Ana ekran: orb + neon ring + 9 addiction + wiggle
    profile.tsx        ─ Stats (Total/Won/Lost/Momentum/Streak) + sign-out
  active-session.tsx   ─ Timer (modal): Date.now-based, cycle bonus, share banner
  add-addiction.tsx    ─ Catalog picker (10 sabit, kategorilere göre gruplu)
  setup-username.tsx   ─ Handle capture (opsiyonel, "Şimdilik atla" ile)

components/
  NeonRing.tsx         ─ Border-color trick + box-shadow neon glow

constants/
  theme.ts             ─ colors, spacing, radius, font
  addictions.ts        ─ ADDICTION_CATALOG (10 fixed) + toAddiction() +
                          FREE_ACTIVE_LIMIT / PREMIUM_ACTIVE_LIMIT + maxMinutesFor()

i18n/
  en.json              ─ Single-language dictionary (Faz 2: EN only)

context/
  AuthContext.tsx      ─ Supabase session + signOut
  AddictionsContext.tsx─ Default + custom addictions, hidden defaults set
  SessionsContext.tsx  ─ Local cache + Supabase hydrate + profiles update

lib/
  supabase.ts          ─ Client + Database<T> tipi
  auth.ts              ─ translateAuthError() (EN→TR), isValidEmail()
  profile.ts           ─ getUsername / setUsername (handle for Modül 4)
  i18n.ts              ─ Tiny t(key, params) helper — Faz 2 EN-only
  relativeTime.ts      ─ Pure ISO→"5dk önce" Turkish formatter
  scoring.ts           ─ Re-exports shared/scoring + weeklyResistCounts
  activeSession.ts     ─ AsyncStorage snapshot + pending finish replay
  addictionsApi.ts     ─ user_addictions CRUD (activate / deactivate / fetch)
  onboarding.ts        ─ Onboarding completion tracker, calculateAge()
  devBypass.ts         ─ EXPO_PUBLIC_DEV_SKIP_AUTH flag

shared/
  scoring.ts           ─ Cross-runtime scoring — Vitest + Deno import same file
  catalog.ts           ─ id → sensitivity whitelist (Edge Function cross-check)

supabase/
  migrations/003_backend_scoring.sql   ─ Faz 3 SQL (enum rename + views + tables)
  functions/resolve-craving/index.ts   ─ Server-authoritative resolve endpoint
```

## ✅ Yapılan Özellikler (Kronolojik)

1. **Proje iskelesi** + theme + 9 default addiction (Impulse/Nicotine/Alcohol/Caffeine/The Feed/Substance/Binge/Urge/The Bet)
2. **Ana ekran orb**: Reanimated tabanlı orb + 3-katmanlı ambient circles + neon iki-halka spinner (CW outer + CCW inner, box-shadow glow)
3. **Selecting state**: Orb 0.5x'e küçülür, 9 addiction circular layout'ta açılır (staggered entry, ease-out-expo curve)
4. **iOS-style wiggle**: Long-press (350ms) → tüm tile'lar ±2.2° rocking + sağ-üst X delete badge → tap exit
5. **Active session timer**: `Date.now() - startedAt` tabanlı (background-safe), AppState listener resync, sensitivity 1-10 × elapsed minutes formula
6. **Cycle completion**: Ring her dolduğunda halo bloom + `+X` floating bonus + ring reset (cycle×sensitivity×5 puan bonus)
7. **Loss-friendly scoring**: "I gave in" puan kırmaz, momentum/streak donar (kırılmaz). "I Resisted" base + ceiling bonus + momentum +1-25
8. **SessionsContext + Supabase persistence**: craving_sessions row INSERT on mount (status: active) → UPDATE on finish (completed/abandoned), AsyncStorage snapshot ile cold-launch restore
9. **Sensitivity 1-10**: Compose form, 10-button row, minimalist horizontal-scroll color/emoji picker
10. **Onboarding**: 18+ yaş gate (DOB picker + rejection mesajı) + KVKK 2-checkbox consent
11. **Auth UI**: sign-in + sign-up ekranları, email/password, Türkçe error translation, eye toggle, loading state. DEV_MODE kaldırıldı, gerçek auth zorunlu.
12. **Faz 1 Cleanup**: Community feed, AI asistan, reflection journal
    tamamen kaldırıldı. `lib/profile.ts` handle CRUD'u için yeni ana kapı;
    `lib/community.ts` (feed + handle karışık) sil, handle mantığı
    yeni dosyaya taşındı. Setup-username artık opsiyonel ("Şimdilik atla"
    linki). Yerine Bilgi sekmesi + 4-modül sistemi gelecek (Faz 4).
13. **Faz 2 Katalog**: Custom addiction yaratma tamamen kaldırıldı.
    10 sabit katalog (`constants/addictions.ts` içinde
    `ADDICTION_CATALOG`) — nicotine, alcohol, caffeine, vape, gambling,
    junk_food, shopping, pmo, doomscroll, gaming. Kullanıcı sadece
    picker'dan seçer (`app/add-addiction.tsx` artık picker). Free 1 /
    Premium 5 aktif limit. Soft-delete: `user_addictions.is_active =
false` + craving_sessions history saklanır → re-add kaldığı yerden
    devam eder. Tüm görünür metin `t()` üzerinden (`lib/i18n.ts` tiny
    helper, `i18n/en.json` sözlük). Kullanıcı sensitivity görmez.
14. **Faz 3 Backend Puan**: Puan/momentum/streak hesabı client'tan
    Supabase Edge Function'a (`resolve-craving`) taşındı. `shared/`
    modülü Vitest + Deno ikisinden import edilebilen pure scoring —
    kural değişince tek dosya. Client mevcut formulü sadece
    **optimistic estimate** için kullanıyor (banner anında görünsün
    diye); server response ile sessizce reconcile. Enum rename:
    `completed → resolved`, `gave_in → failed`. Kolon rename:
    `points_earned → points_delta` (signed). Yeni tablolar:
    `user_addiction_scores` (per-addiction, SELECT-only RLS),
    `rate_limits` (log-only, Faz X'te enforce). Yeni view:
    `user_total_score` (SUM). Edge Function idempotent
    (session_id-based) — network flake retry-safe. Duration server-side
    hesaplanır (started_at diff'i), client-reported süre kabul
    edilmez.

## 🧠 Önemli Kararlar (UX/Mimari)

| Karar                                           | Sebep                                                    |
| ----------------------------------------------- | -------------------------------------------------------- |
| **Puanlar asla düşmez**                         | Recovery'de cezalandırma motivasyon kırar                |
| **Streak kayıpta kırılmaz, donar**              | Aynı sebep — dürüst paylaşımı teşvik et                  |
| **Date.now anchor (setInterval counter değil)** | iOS background timer suspend eder; wall-clock immune     |
| **Sensitivity 1-10 → maxMin 5-15**              | İlk testlerde 60dk ceiling cezalandırıcı hissedildi      |
| **Cycle reset + bonus**                         | 15dk'lık tek bir hedef yerine tekrar eden mini-zaferler  |
| **Onboarding'de açık rıza**                     | KVKK Madde 9 sağlık verisi için "açık rıza" temeli       |
| **Handle opsiyonel**                            | Community kalktıktan sonra artık post-auth zorunlu değil |
| **DEV_MODE artık yok**                          | Auth zorunlu; scoring server-only                        |

## 🗄️ DB Schema (Supabase)

### profiles

```
id (uuid PK, → auth.users) | username (text) UNIQUE | total_points (int) [LEGACY]
momentum_score (int) [LEGACY] | momentum (int, default 50) [BUNU KULLAN]
streak (int, default 0) | onboarding_completed (bool)
hidden_defaults (text[], default '{}') | created_at
```

> ⚠️ `total_points` ve `momentum_score` daha önceki migration'lardan kalma. Kod
> `momentum` ve `streak` kullanır. `total_points` SessionsContext tarafından
> sessions sayımıyla derive edilir.
>
> **Pending migration**: `username`'in UNIQUE olması gerekiyor — şu an constraint yok,
> setup-username `23505` (unique_violation) yakalıyor ama önce DB'ye eklenmeli:
>
> ```sql
> ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
> ```

### craving_sessions

```
id (uuid) | user_id (uuid → profiles) | addiction_id (text)
status ('active'|'completed'|'abandoned') | outcome ('resisted'|'gave_in'|null)
started_at | ended_at | duration_seconds (nullable while active)
points_earned (int) | sensitivity (1-10) | completed_cycles (int) | created_at

PARTIAL UNIQUE INDEX: (user_id) WHERE status='active'  -- bir aktif session/user
```

> **Faz 1 cleanup notu**: Aşağıdaki tablolar (`forum_posts`, `forum_likes`,
> `forum_reports`, `reflections`) kod tarafında kaldırıldı ve DB'de DROP
> edilecek. Bu bölüm docs geçmişi olarak kalıyor ama şema aktif değil.

### addictions (custom)

```
id (uuid PK) | user_id (uuid → profiles) | name (text) | emoji (text)
color (text, hex) | sensitivity (int 1-10)
max_duration_minutes (int) [LEGACY, derive sensitivity'den] | created_at
```

> AddictionsContext bunu Supabase'le sync eder (lib/addictionsApi.ts).
> AsyncStorage offline cache'i; server source of truth.

### momentum_log (henüz kullanılmıyor)

```
id | user_id | value | created_at
```

## ⚠️ Schema Gotcha'ları

1. **addiction_id TEXT, UUID değil** — preset id'leri ('nicotine' vs)
   doğrudan saklanır. Custom addiction'lar `custom-{ts}-{rand}` formatında.
   (Faz 2'de custom kaldırılıp 20 sabit katalog gelecek.)
2. **handle_new_user trigger** auth.users INSERT → profiles INSERT yapar
   (security definer + RLS bypass). Email confirmation OFF olduğu için
   signUp anında session döner, profiles row'u trigger'la oluşur.

## 🔐 RLS Özeti

- **profiles**: owner select/update/insert, others nothing
- **craving_sessions**: owner all, others nothing
- **addictions** (custom): owner all
- **momentum_log**: owner all

## 📦 Çalıştırılan Migration'lar

Hepsi `supabase/sql_editor`'dan elle çalıştırıldı (henüz tooling yok):

1. **Initial** — profiles, addictions, craving_sessions, momentum_log + RLS + handle_new_user trigger
2. **craving_sessions reset** — eski schema NOT NULL outcome/duration_seconds idi, in-flight 'active' satırlar için nullable yapıldı (drop + recreate)
3. **Community + profiles ALTER** — forum_posts/forum_likes + count trigger + RLS, profiles'a momentum/streak ADD COLUMN
4. **Faz 1 DROP** — forum_posts, forum_likes, forum_reports, reflections tablolarının CASCADE drop'u (bu commit ile birlikte kullanıcıya SQL verildi)

> Yeni feature DB ihtiyacı duyduğunda: `ALTER TABLE ADD COLUMN IF NOT EXISTS`
> veya `CREATE TABLE IF NOT EXISTS` ile additive migration yaz, kullanıcıya
> ver, çalıştırsın. Bir daha reset yok.

## 🎨 Tema / Konvansiyon

```
bg:           #020810  (root)
ambient:      #060F1E / #091525 / #0D1E35  (3 katman)
card:         #0A1628
border:       #1A2A45
borderStrong: #1E3050
accent blue:  #3B82F6  (primary action)
accent text:  #7DC3FF  (button text on accent bg)
text primary: #F1F5F9
text secondary: #94A3B8
text muted:   #6B8BA4
text dim:     #3D5470
error:        #EF4444
success:      #10B981
```

UI dili karması:

- **İngilizce**: Brand (RESIST), action butonları (I Resisted/I gave in)
- **Türkçe**: Auth, onboarding, share banner, community, hata mesajları, sensitivity labels

## 🧪 Test Hesabı (DEV — gerçek üretim değil)

```
email: crave-auth-1777624817088@example.com
password: TestPass123!
username: test_resister
```

Email confirmation Supabase dashboard'dan OFF.

## 📋 Bekleyen / Sıradaki İşler

| Önem | İş                                                                                     |
| ---- | -------------------------------------------------------------------------------------- |
| ⭐   | **Push notifications** (expo-notifications) — daily reminder, "ring fills" celebration |
| ⭐   | **Apple/Google sign-in** — şu an sadece email/password                                 |

### ✅ Yakın Zamanda Kapatılanlar

> ⚠️ Aşağıdaki geçmiş listedeki **community, AI asistan ve reflection
> journal** özellikleri Faz 1 cleanup ile kaldırıldı. Kayıt tarihi
> olarak burada duruyor ama kod, DB tablo ve env değişkenleri artık yok.

- **AI asistan v1** [FAZ 1'DE KALDIRILDI]: `/assistant` modal ekranı — Profile'dan erişiliyor. Anthropic API'ye Supabase Edge Function üzerinden proxy. Türkçe sistem promptu (recovery-aware, no therapy substitute, akut risk için 182/112). v1: no streaming, no persistence. Edge function deploy commit `[hash]` mesajında. `EXPO_PUBLIC_ASSISTANT_URL` env yoksa setup empty state gösteriyor
- **Report mechanism**: Post kartlarında flag butonu (own değilse) → bottom sheet 5 reason. `reportPost` API'si, `forum_reports` tablosu (additive migration commit `[hash]` mesajında). Duplicate report sessizce success. Moderator UI scope dışı
- **Realtime community feed**: `subscribeToNewPosts` (Supabase realtime channel) → community.tsx pending buffer + "N yeni gönderi" floating pill. Filter/search değişince buffer temizleniyor; local create sonrası feed'e zaten gelmiş post'lar dedupe ediliyor. Scroll position korunuyor (auto-prepend yok)
- **Username post-auth gate**: `/setup-username` ekranı + `app/index.tsx`'de username probe. Sign-in/up `router.replace('/')` ile artık root'a iniyor; root username'i boşsa setup'a, doluysa (tabs)'e. Compose ekranındaki `needsUsername` fork'u kalktı, ~150 satır azaldı
- **Edit/delete own posts** (community): PostCard'da kendi post'larında pencil + trash mini-butonlar. Compose ekranı `?editId` param'ıyla edit moduna giriyor; addiction picker kilitleniyor (kategori değişikliği feed'i bozar). `lib/community.ts`'e `updatePost`, `deletePost`, `fetchPost` eklendi. Delete optimistic + rollback
- **Custom addiction edit**: `AddictionsContext.updateAddiction(id, patch)` + `add-addiction.tsx`'de `?id` param desteği. Profile satırına tap → modal edit modunda açılıyor (custom only; default'lar read-only). × delete butonu için web'de stopPropagation guard
- **Forgot password flow**: `/(auth)/forgot-password` ekranı + sign-in'den link. `supabase.auth.resetPasswordForEmail`. Reset link'i Supabase hosted recovery sayfası açıyor — native deep-link handling şimdilik scope dışı
- **Profile "Bağımlılıklarım" listesi**: Profile ekranında stats ile email/sign-out arasında inline liste. Her satırda × ile silme; default → `hiddenDefaults`, custom → diziden çıkar. + Ekle pill'i `/add-addiction`'a yönlendiriyor
- **Sign-in/up redirect bug**: AuthContext'e `applySession()` eklendi. Auth ekranları, `router.replace`'ten önce session'ı imperatif olarak React state'e basıyor — `onAuthStateChange` callback'inin geç gelişi (tabs) guard'ını yanıltmıyor
- **Pagination community** (commit `4621750`): `onEndReached` → `fetchPosts({before})`, dedupe, hasMore terminator footer
- **Streak daily reset** (commit `21cfcf8`): "consecutive days with ≥1 resist" semantiği, local sessions cache'den türetiyor — DB schema değişikliği yok. 8/8 senaryo testte yeşil
- **Web focus ring** (commit `bb82b65`): Tarayıcı default amber outline → brand mavi (`#3B82F6` 2px). Tek style enjeksiyonu, native no-op
- **Custom craving picker redesign** (commit `1c263a4`): Color/Icon kompakt buton + flex-wrap grid, char counter, 24 renk + ~150 kategorili emoji

## 🌐 Repo

- **GitHub**: https://github.com/YusufKoc97/crave
- **Owner**: YusufKoc97
- **Branch**: main
- **Supabase project**: `scdedlhpbcddoqphauxo` (region: West EU - Ireland)

## 🚀 Yeni Cihazda İlk Kurulum

```bash
git clone https://github.com/YusufKoc97/crave.git
cd crave
npm install
cat > .env.local << 'EOF'
EXPO_PUBLIC_SUPABASE_URL=https://scdedlhpbcddoqphauxo.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_4v94vGO6IF0HArKzvFVLiw_20wLl1Aq
EOF
npx expo start --web   # veya --ios
```

## 💬 Yeni Claude Oturumuna Tavsiye

1. Bu CLAUDE.md'yi oku → genel resmi al
2. `app/(tabs)/index.tsx`, `app/active-session.tsx`, `context/SessionsContext.tsx`'e bak — uygulamanın kalbi
3. Kullanıcı Türkçe yazıyor; sen de cevapları Türkçe ver, kod yorumları İngilizce kalsın
4. Yeni feature'da migration gerekiyorsa **additive yaz** (`ALTER ADD COLUMN IF NOT EXISTS`), reset yok
5. RN Web'de TextInput'a programmatic değer girerken `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` setter'ını kullan + `dispatchEvent('input')` — yoksa React state sync olmaz
6. Pressable'a programmatic click için: walk up to `tabIndex=0` ancestor, sonra `pointerdown + pointerup + click` MouseEvent dispatch
7. Schema değişikliklerinde Supabase dashboard'dan SQL Editor'la çalıştırılır — `supabase` CLI kurulu değil
