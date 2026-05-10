# CRAVE — Project Memory

> **Yeni Claude oturumuna not:** Bu dosya bu projedeki sürekliliği taşır. Yeni
> bir cihazda (Mac/Windows) açıldığında, *önce bu dosyayı oku, sonra
> codebase'e bak*, kullanıcıyla beraber bıraktığın yerden devam et. Kullanıcı
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
    community.tsx      ─ Feed: search, filter pills, post cards, FAB, auth gate
  active-session.tsx   ─ Timer (modal): Date.now-based, cycle bonus, share banner
  add-addiction.tsx    ─ Custom addiction modal (sensitivity 1-10, minimal)
  community-compose.tsx─ Yeni post modal (username step + addiction picker)

components/
  NeonRing.tsx         ─ Border-color trick + box-shadow neon glow

constants/
  theme.ts             ─ colors, spacing, radius, font
  addictions.ts        ─ DEFAULT_ADDICTIONS[], maxMinutesFor(s) 5-15dk

context/
  AuthContext.tsx      ─ Supabase session + signOut
  AddictionsContext.tsx─ Default + custom addictions, hidden defaults set
  SessionsContext.tsx  ─ Local cache + Supabase hydrate + profiles update

lib/
  supabase.ts          ─ Client + Database<T> tipi
  auth.ts              ─ translateAuthError() (EN→TR), isValidEmail()
  community.ts         ─ fetchPosts, createPost, toggleLike, relativeTime
  activeSession.ts     ─ AsyncStorage snapshot helpers
  onboarding.ts        ─ Onboarding completion tracker, calculateAge()
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
11. **Community**: forum_posts feed (search, addiction filter pills, like toggle with optimistic UI + DB trigger), compose modal with inline username step, FAB
12. **Resist share banner**: I Resisted sonrası "+X puan kazandın · Bunu paylaş" seçeneği → community-compose'a prefill ile gider
13. **Auth UI**: sign-in + sign-up ekranları, email/password, Türkçe error translation, eye toggle, loading state. DEV_MODE kaldırıldı, gerçek auth zorunlu.

## 🧠 Önemli Kararlar (UX/Mimari)

| Karar | Sebep |
|---|---|
| **Puanlar asla düşmez** | Recovery'de cezalandırma motivasyon kırar |
| **Streak kayıpta kırılmaz, donar** | Aynı sebep — dürüst paylaşımı teşvik et |
| **Custom addiction'lar community'e gitmez** | Kişisel isimler ("eski sevgili") feed'i bozar; preset 9 sabit |
| **Date.now anchor (setInterval counter değil)** | iOS background timer suspend eder; wall-clock immune |
| **Sensitivity 1-10 → maxMin 5-15** | İlk testlerde 60dk ceiling cezalandırıcı hissedildi |
| **Cycle reset + bonus** | 15dk'lık tek bir hedef yerine tekrar eden mini-zaferler |
| **Onboarding'de açık rıza** | KVKK Madde 9 sağlık verisi için "açık rıza" temeli |
| **Username ilk paylaşımda sorulur** | Onboarding'i şişirmez; ilgisiz kullanıcıyı rahatsız etmez |
| **DEV_MODE artık yok** | Auth zorunlu; community ve scoring server-only |

## 🗄️ DB Schema (Supabase)

### profiles
```
id (uuid PK, → auth.users) | username (text) | total_points (int) [LEGACY, kullanma]
momentum_score (int) [LEGACY] | momentum (int, default 50) [BUNU KULLAN]
streak (int, default 0) | onboarding_completed (bool) | created_at
```
> ⚠️ `total_points` ve `momentum_score` daha önceki migration'lardan kalma. Kod
> `momentum` ve `streak` kullanır. `total_points` SessionsContext tarafından
> sessions sayımıyla derive edilir.

### craving_sessions
```
id (uuid) | user_id (uuid → profiles) | addiction_id (text)
status ('active'|'completed'|'abandoned') | outcome ('resisted'|'gave_in'|null)
started_at | ended_at | duration_seconds (nullable while active)
points_earned (int) | sensitivity (1-10) | completed_cycles (int) | created_at

PARTIAL UNIQUE INDEX: (user_id) WHERE status='active'  -- bir aktif session/user
```

### forum_posts
```
id (uuid) | user_id (uuid → profiles) | addiction_id (TEXT preset only)
content (text, 1-500 char) | like_count (int, trigger-managed) | created_at

CHECK addiction_id IN ('impulse','nicotine','alcohol','caffeine',
                       'feed','substance','binge','urge','bet')
```

### forum_likes
```
post_id (uuid → forum_posts) | user_id (uuid → profiles) | created_at
PRIMARY KEY (post_id, user_id)

TRIGGER: AFTER INSERT/DELETE → forum_posts.like_count ± 1
```

### momentum_log (henüz kullanılmıyor)
```
id | user_id | value | created_at
```

## ⚠️ Schema Gotcha'ları

1. **profiles join'inde FK adı şart**: `forum_posts → profiles` arasında 2 yol
   var (auth.users hop + direct FK). Embed yaparken hep:
   ```ts
   .select('*, profiles!forum_posts_user_id_fkey(username)')
   ```
2. **addiction_id TEXT, UUID değil** — preset id'leri ('nicotine' vs)
   doğrudan saklanır. Custom addiction'lar `custom-{ts}-{rand}` formatında.
3. **handle_new_user trigger** auth.users INSERT → profiles INSERT yapar
   (security definer + RLS bypass). Email confirmation OFF olduğu için
   signUp anında session döner, profiles row'u trigger'la oluşur.

## 🔐 RLS Özeti

- **profiles**: owner select/update/insert, others nothing
- **craving_sessions**: owner all, others nothing
- **forum_posts/forum_likes**: authenticated read, owner write
- **addictions** (custom): owner all
- **momentum_log**: owner all

## 📦 Çalıştırılan Migration'lar

Hepsi `supabase/sql_editor`'dan elle çalıştırıldı (henüz tooling yok):

1. **Initial** — profiles, addictions, craving_sessions, momentum_log + RLS + handle_new_user trigger
2. **craving_sessions reset** — eski schema NOT NULL outcome/duration_seconds idi, in-flight 'active' satırlar için nullable yapıldı (drop + recreate)
3. **Community + profiles ALTER** — forum_posts/forum_likes + count trigger + RLS, profiles'a momentum/streak ADD COLUMN

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

| Önem | İş |
|---|---|
| ⭐ | **Push notifications** (expo-notifications) — daily reminder, "ring fills" celebration |
| ⭐ | **AI asistan** (Anthropic API) — sohbet desteği, taban için coping suggestions |
| ⭐ | **Apple/Google sign-in** — şu an sadece email/password |
| ⭐ | **Edit/delete own posts** (community) + report mechanism |
| ⭐ | **Realtime community feed** — supabase realtime ile yeni postlar canlı |
| 🔧 | **Onboarding'de username adımı?** — Şu an ilk post'ta soruluyor; consent ekranından sonra adım eklenebilir |
| 🔧 | **Bağımlılık edit** — Profile'daki "Bağımlılıklarım" satırına tap edip name/emoji/color/sensitivity güncellemek (şu an sadece silme var) |

### ✅ Yakın Zamanda Kapatılanlar

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
