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
  active-session.tsx   ─ Timer (modal): Date.now-based, cycle bonus, share banner,
                          intensity + failure modals wired (Faz 5)
  add-addiction.tsx    ─ Catalog picker (10 sabit, kategorilere göre gruplu)
  setup-username.tsx   ─ Handle capture (opsiyonel, "Şimdilik atla" ile)

components/
  NeonRing.tsx         ─ Border-color trick + box-shadow neon glow

constants/
  theme.ts             ─ colors, spacing, radius, font
  addictions.ts        ─ ADDICTION_CATALOG (10 fixed) + toAddiction() +
                          FREE_ACTIVE_LIMIT / PREMIUM_ACTIVE_LIMIT + maxMinutesFor()
  rankLadder.ts        ─ 9-rank i18n wrapper over shared/ranks.ts
  triggerCatalog.ts    ─ Faz 5: 8 common + 79 addiction-specific triggers
  toolkitCatalog.ts    ─ 6 egzersiz + feedback + techniquesForAddiction()
                          (egzersizin hangi bağımlılıklara açık olduğu tek filtre)
                          ⚠️ v1.0 KAPANDI — yeni egzersiz EKLEME (ASLA YAPMA #11)
  presence.ts          ─ Faz 7: threshold + poll interval + active window
  heatmap.ts           ─ Faz 8a: grid dims, DAY_KEYS, PERIOD_ORDER, 5-color
                          ramp + heatmapColor() + sparse/full thresholds
  insights.ts          ─ Faz 8b: category → Ionicons name map (UI only —
                          rules live in shared/insightRules.ts)
  designSystem.ts      ─ Polish phase: dsColors + dsSpacing + dsRadius
                          + dsFont + dsCardStyles + hexAlpha() helper

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
  triggerSessions.ts   ─ Faz 5: insert/replace/fetch on craving_session_triggers
  techniqueUses.ts     ─ Faz 6: logTechniqueStart / logTechniqueEnd
  premium.ts           ─ Faz 8a: app-wide useIsPremium() hook (single knob)
  queryClient.ts       ─ Faz 8a: React Query singleton + invalidateTriggerMaps()
  triggerMap.ts        ─ Faz 8a: useTriggerMap(addictionId, period) + types
  overallRank.ts       ─ Polish: totalPoints → shared/ranks projection
  userStats.ts         ─ Polish: useUserStats React Query hook
                          (cravings / streak / success / techniques)
  onboarding.ts        ─ Onboarding completion tracker, calculateAge()
  devBypass.ts         ─ EXPO_PUBLIC_DEV_SKIP_AUTH flag

shared/
  scoring.ts           ─ Cross-runtime scoring — Vitest + Deno import same file
  catalog.ts           ─ id → sensitivity whitelist (Edge Function cross-check)
  ranks.ts             ─ 9-rank ladder + unlock diff (Vitest + Deno)
  insightRules.ts      ─ Faz 8b: 6-rule insights engine + evaluateInsights()
                          (Deno + Vitest import same file; MAX_INSIGHTS=3)

components/
  JourneyBar.tsx           ─ Horizontal compact + vertical ladder for Module 1
  RankUnlockModal.tsx      ─ Full-screen celebration, queue support, particle burst
  IntensityModal.tsx       ─ Faz 5: 5-emoji ladder + Skip (post-resist)
  TriggerCaptureModal.tsx  ─ Faz 5 REVERSAL: post-resolve trigger picker (min-1)
  ToolkitGrid.tsx          ─ 2×2 grid (Info + active picker) — addiction'a göre filtreli
  ToolkitPickerModal.tsx   ─ bottom-sheet picker for active-session
  ExerciseRunner.tsx       ─ TÜM egzersizlerin kabuğu (eski adı
                             TechniqueRunnerModal — registry'ye çevrildi, 37b4011)
  PresenceIndicator.tsx    ─ 10s polling "you're not alone" line
                             ⚠️ sayaç hep 0 — "Bilinen Bozuk"a bak
  technique/               ─ one file per guided scene
    Breathing478Screen.tsx
    UrgeSurfingScreen.tsx
    Grounding54321Screen.tsx
    BodyScanScreen.tsx
    RideTheWaveScreen.tsx  ─ 5. egzersiz (madde bağımlılıkları)
    FakeFeedScreen.tsx     ─ 6. egzersiz (doomscroll) — 10 kartlık sonlu
                             feed + fakeFeedCards/Motion/Number.ts saf math
    ExerciseAtmosphere.tsx ─ runner'ın SVG gökyüzü/nebula/yıldız katmanı
    sceneRegistry.ts       ─ type → sahne; total Record (eksikse derleme kırılır)
    types.ts               ─ SceneProps kontratı (TechniqueScreenProps alias'ı kaldı)
  toolkit/                 ─ Toolkit sekmesi: carousel + kart + aurora + preview'lar
  comparison/              ─ Modül 4 (Pulse / Distribution / Standing / Patterns)
  profile/                 ─ LifetimePanel ("Aurora Veil") vb.
  triggerMap/              ─ Faz 8a: Modül 3 root + sub-components
    TriggersPane.tsx       ─ Root — progressive disclosure (zero/sparse/full)
    PeriodFilter.tsx       ─ 3-pill segmented (7d / 30d / all)
    FreeTierGate.tsx       ─ Blur + upgrade overlay for non-premium
    EmptyStates.tsx        ─ 'zero' + 'sparse' variants
    HeatmapGrid.tsx        ─ SVG 7×24 grid + intensity dots + Pressable overlay
    PeakHoursList.tsx      ─ Top-3 rank rows (server-sorted)
    TriggerDistribution.tsx─ Horizontal bar chart + "Mostly {level}"
    CellDetailSheet.tsx    ─ @gorhom/bottom-sheet, imperative open()
    InsightSection.tsx     ─ Faz 8b: Personal insights container + accordion
    InsightCard.tsx        ─ Faz 8b: icon + msg + LayoutAnimation detail + action
  ui/                      ─ Polish phase primitives (design system)
    AmbientGlow.tsx        ─ SVG RadialGradient + Reanimated pulse
    SurfaceCard.tsx        ─ default + elevated variants on dsColors

context/
  AddictionScoresContext.tsx ─ Per-addiction score + unlocks hydration

app/(tabs)/info/
  _layout.tsx          ─ Nested stack for Info tab
  index.tsx            ─ Main list: TRACKING / ALL ADDICTIONS sections
  [addictionId].tsx    ─ Landing page with 4 sub-tabs (Journey implemented)

supabase/
  migrations/003_backend_scoring.sql        ─ Faz 3 SQL (enum rename + views + tables)
  migrations/004_rank_ladder.sql            ─ Faz 4 user_unlocked_ranks table
  migrations/005_craving_session_triggers.sql ─ Faz 5 client-owned trigger capture
  migrations/006_technique_uses.sql           ─ Faz 6 toolkit invocation log
  functions/resolve-craving/index.ts        ─ Server-authoritative resolve endpoint
                                              (Faz 4: rank unlocks + Faz 5: intensity)
  functions/active-presence/index.ts        ─ Faz 7: count(*) other active sessions
  functions/trigger-map-data/index.ts       ─ Faz 8a heatmap/peaks/triggers +
                                              Faz 8b insights (last 14d slice)
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
15. **Faz 4 Modül 1 — Direniş Yolculuğu**: 3. tab (**Info**, compass
    icon, sağda) eklendi. 10 addiction için ayrı landing page
    (`/info/[addictionId]`), 4 sub-tab: Journey (implemented) +
    Toolkit / Triggers / Comparison ("Coming soon"). Journey =
    horizontal compact özet üstte + vertical rank ladder detay altta.
    9-rank ladder (`shared/ranks.ts` + `constants/rankLadder.ts` i18n
    wrapper): traveler → first_step → steady → persistent →
    disciplined → aware → master → expert → free (thresholds:
    0/100/400/1000/2500/6000/15000/35000/75000 — tuning knobs).
    Yeni tablo: `user_unlocked_ranks` (SELECT-only RLS, service role
    INSERT). `resolve-craving` her başarılı 'resisted' sonrası score
    diff'ini `newlyUnlockedRanks()` ile hesaplayıp UPSERT eder,
    response'ta `newly_unlocked_ranks: string[]` döner. Client
    (`app/active-session.tsx`) bunu `RankUnlockModal` queue'suna
    verir — full-screen celebration, Reanimated particle burst,
    heavy haptic, sırayla dismiss. **Regression semantik**:
    `currentRankFromUnlocks()` her zaman en yüksek unlock'ı döner
    (score düşerse rank kaybedilmez). Tab bar pill genişliği artık
    `TAB_ORDER.length * 56 + padding` — 4. tab için hazır. Yeni
    context: `AddictionScoresContext` (per-addiction score +
    unlocks hydrate, `refresh()` active-session'dan çağrılıyor).
16. **Faz 5 Craving Akışı**: Orb → addiction tap artık doğrudan
    timer'a atlamıyor, önce yeni modal ekran
    (`/craving-start`) — chosen addiction chip + Common (8) +
    addiction-specific trigger chip'leri. Min 1 trigger zorunlu.
    Start → `/active-session`'a triggers comma-joined param olarak
    geçer. Timer mount olduğunda `craving_sessions` INSERT + arka
    planda `craving_session_triggers` INSERT (best-effort, timer
    beklemez). Post-resist: **IntensityModal** (5 emoji ladder
    Mild → Unbearable + Skip = null). Post-fail:
    **FailureConfirmModal** (pre-selected chips + "Looks right" /
    "Edit and save" + × cancel → session `active` kalır). Shame-free
    "This is data too. See you next craving." mesajı. Trigger
    catalog client-only (`constants/triggerCatalog.ts` — 8 common
    - 79 addiction-specific = 87 total; no shared/, no DB CHECK).
      Trigger persist tamamen client (`lib/triggerSessions.ts` —
      insert/replace/fetch, RLS scoped by session ownership).
      resolve-craving Edge Function sadece `intensity` alanını
      handle eder — trigger'lara dokunmaz.
17. **Faz 6 Craving Toolkit (Modül 2)**: 4 guided technique
    (breathing_478 / urge_surfing / grounding_54321 / body_scan)
    aynı `TechniqueRunnerModal` içinde çalışıyor. İki entry:
    (a) Info Toolkit sub-tab `ToolkitGrid` (öğrenme), (b)
    active-session'ın "Try a technique" secondary CTA'sı →
    `ToolkitPickerModal` bottom sheet (kriz anı yardımı) — her
    ikisi de aynı 4 kartı gösteriyor, aynı runner'a yönlendiriyor.
    Runner phase-based: `guiding` (teknik-özel screen —
    Breathing478Screen scale animasyonlu circle, UrgeSurfingScreen
    SVG wave + narrative timeline, Grounding54321Screen 5-4-3-2-1
    checklist, BodyScanScreen 8 region segmented bar +
    tap-forward-to-skip) → `feedback` (4 emoji Much better/Better/
    Same/Worse + Skip). RN `<Modal>` overlay — Stack.Screen değil
    ki active-session timer altta çalışmaya devam etsin (Faz 6
    karar #1). AppState foreground → in-place restart (`resetSeed`
    remount, karar #6). Two-write DB lifecycle:
    `logTechniqueStart` INSERT'te row id, `logTechniqueEnd` UPDATE
    ile `completed` + `feedback`. `context` = 'active_craving' |
    'info_tab' + nullable `addiction_id` (Modül 3 cross-analysis
    için, karar #7). Client-only writes, Edge Function
    `technique_uses`'a dokunmaz.
18. **Faz 7 Live Presence Counter**: active-session mount olunca
    `<PresenceIndicator>` (quote alt / buttons üst konumunda)
    `active-presence` Edge Function'a 10s polling yapıyor. Server
    `user_id != auth.uid()` filter'ı ile başkalarını sayıyor
    (karar #1, race koruması). `count >= 5` → "You and X others
    are resisting right now"; `0 < count < 5` → "You're among
    those resisting"; `count = 0` veya fetch fail → sessizce
    gizlenir (asla "0 kişi" gösterme). AppState background →
    polling durur (batarya), foreground → immediate fetch +
    interval yeniden başlar (karar #2). Stale sessions >2h
    filtreleniyor server-side. Tuning knob'lar
    `constants/presence.ts`'te (threshold, interval, window).
    DB migration yok — mevcut `craving_sessions` tablosuna aggregate
    okuma.
19. **Faz 8a Trigger Map (Modül 3, Section 2/3/4)**: Info tab 3. sub-tab
    (Triggers) artık placeholder değil — full pipeline. Edge Function
    `trigger-map-data` (JWT, service-role privileged read) tek
    çağrıda `craving_sessions` + `craving_session_triggers` join'ini
    period-filtered (7d / 30d / all) çekiyor, sunucu tarafında
    aggregate ediyor: `heatmap[7][24]` (Mon=0 shift), `intensity_map`
    (avg rounded per cell), `peak_hours` (top-3 flat cells desc),
    `triggers` (percentage + `most_common_intensity` mode). `insights`
    field response'ta var ama Faz 8a'da `[]` — kural motoru 8b'de.
    Client (`useTriggerMap` React Query hook, 5min stale) →
    `TriggersPane` progressive disclosure:
    `count=0` → EmptyState zero;
    `count 1-5` → Heatmap + sparse nudge (peak/dist gizli);
    `count 6+` → Heatmap + PeakHoursList + TriggerDistribution.
    HeatmapGrid = react-native-svg 7×24 (`CELL_SIZE=12`,
    5-color indigo ramp `heatmap.ts`), avg intensity ≥ 4 hücrelerde
    beyaz dot marker, invisible Pressable overlay (SVG onPress
    web'de flaky). Cell tap → `CellDetailSheet` (@gorhom/bottom-sheet
    imperative `open()` ref, 30% snap) → day/hour + count + avg
    intensity label. Free-tier (default): `FreeTierGate` blur veil
    - Upgrade CTA content üzerine binder (web: `filter/backdropFilter`
      blur, native: opacity + `rgba(2,8,16,0.55)` veil). Premium hook
      (`lib/premium.ts`) app-wide extract edildi — AddictionsContext
      limit hesabı da bu hook'u kullanıyor. React Query provider root
      layout'ta (`app/_layout.tsx`), `GestureHandlerRootView` bottom
      sheet gesture'ları için root'a taşındı. active-session
      resolve sonrası `invalidateTriggerMaps()` çağrılıyor →
      Info tab bir sonraki açılışta fresh data. Yeni migration
      yok — mevcut Faz 5 tablolarını okur. Tests: 12 yeni case
      (`tests/heatmap.test.ts`) — grid dims, DAY_KEYS order,
      period order/default, stale time, heatmapColor bucket
      thresholds (0/1/2/3-4/5+), ramp monotonicity.
20. **Faz 8b Personal Insights (Modül 3, Section 1)**: Modül 3 kapandı.
    Triggers sub-tab'ın en üstünde artık kural motorlu insight kartları
    var. Kurallar `shared/insightRules.ts`'te — Deno + Vitest aynı
    dosyayı import eder (scoring/ranks pattern'i). 6 rule v0:
    `dominant_trigger` (P90), `peak_hour` (P85), `effective_technique`
    (P80), `rising_resistance` (P75), `weekend_concentration` (P70),
    `silence_check` (P60). Her rule kendi minCravings gate'ini +
    kendi zaman penceresini tanımlar. `evaluateInsights()` top-3
    priority desc döner, deterministic tiebreak `rule_id` lex sırası.
    Sabit pencere (karar #2) — period picker (7d/30d/all) SADECE
    heatmap/peaks/distribution'a uygulanır, insights her zaman son
    14 gün (trend rules için) + all-history (silence check için)
    bakar. Bu sayede kullanıcı 7d seçse bile `rising_resistance`
    çalışabilir. Edge Function (`trigger-map-data`) yeni sorgular:
    `craving_sessions` last-14d ayrı slice, `technique_uses`
    completed rows (used_at ≥ cutoff, feedback dahil), same-slice
    `craving_session_triggers` join. `evaluateInsights(data)`
    çağrısı response'un `insights` field'ini doldurur (Faz 8a'nın
    `[]` slot'unun yerine geçer). Client (`useTriggerMap`) tipi
    genişledi — `TriggerMapInsight = InsightOutput` re-export.
    `InsightSection` (accordion state) + `InsightCard`
    (LayoutAnimation smooth detail toggle, karar #8) Triggers pane'in
    en üstüne mount edildi — FreeTierGate hâlâ tüm pane'i sarıyor
    (karar #3). Trigger + technique ID'leri raw gelir, client
    i18n resolve eder (karar #4) — `resolveTriggerLabel` fallback:
    common → addiction-specific → raw ID pass-through. Action:
    `open_toolkit` → parent'a callback (`onNavigateSubTab`) →
    subTab='toolkit', pre-selection yok (karar #6). Icons:
    `@expo/vector-icons` Ionicons (time/flash/construct/trending-up)
    kategori bazlı (karar #6). Empty state: 1 satır dimmed italik
    ("Insights appear as you build history"), kart yok. Tests: 23
    yeni case (`tests/insightRules.test.ts`) — 6 rule için matcher
    - gate + edge-case coverage + evaluator (empty, MAX_INSIGHTS
      cap, minCravings gate, deterministic tie-break). Full suite
      172/172 green. DB migration yok — mevcut Faz 5 + Faz 6
      tablolarını okur. Deploy tek adım:
      `supabase functions deploy trigger-map-data`.
21. **Design Polish Phase (Info / Detail / Profile / Active Session)**:
    Üç ekran + design-system foundation, 8 milestone commit ile
    çıkarıldı (Faz 6/8 pattern'i). Amaç: birleşik dark-navy palette
    ve ortak primitive'ler — home/onboarding/auth eski `theme.ts`
    üzerinde kalır (scope dışı, gelecek pass'lerde alınır).
    **M0 (foundation)**: `constants/designSystem.ts` (dsColors,
    dsSpacing 4pt grid, dsRadius, dsFont, dsCardStyles, hexAlpha),
    `components/ui/AmbientGlow.tsx` (react-native-svg
    RadialGradient + Reanimated opacity pulse, 3 intensity bucket
    max %25 opacity, karar #2), `components/ui/SurfaceCard.tsx`
    (default + elevated variants, legacy Card component korunur —
    karar #8), `lib/overallRank.ts` (totalPoints → shared/ranks
    ladder projection, karar #3, yeni schema yok).
    **M1 (Info tab)**: TRACKING 88pt "Send Money" kartlar
    (accent-color emoji chip, rank inline), ALL ADDICTIONS 56pt
    "Habit Tracker" kartlar (%60 opacity surface, "Not tracked"
    trailing label), 34pt bold "Info" başlığı, dsSectionHeaderStyle.
    **M2 (detail screen)**: Full atmospheric background — iki
    AmbientGlow katmanı (blue anchor + addiction-color accent),
    Header 44×44 back button + white centered title, SubTabBar
    48pt yüksek + 14pt semibold + accent-color underline (karar
    #6 — SubTabBar dahil restyle).
    **M3 (Journey pane)**: Hero rank card (SurfaceCard elevated,
    28pt bold rank name accent-color, 48pt bold tabular-nums
    score, 6pt animated progress bar 800ms ease-out cubic),
    64pt ladder rows (24pt filled/outline circle marker, current
    row accent-color border + %8 fill tint, future rows %55
    opacity), 9-dot progress row silindi (ladder already shows
    same info).
    **M4 (Profile tab)**: Full rewrite — hero rank card
    (80pt avatar accentBlue border+glow, ambient blue glow
    layer, OVERALL RANK kicker + 28pt rank name blue
    text-shadow), 2×2 stats grid (Cravings resisted / Longest
    streak / Success rate / Techniques used — useUserStats
    React Query hook), Your addictions grouped list (56pt row
    per tracked addiction, score desc sort → Info landing),
    Settings grouped list (Language / Upgrade Premium / Sign out
    / Delete account — placeholder Alert + signOut, karar #7 —
    real delete_user RPC ayrı fazda). WeeklyChart + won/lost/
    momentum stats düştü (grid aynı soruyu daha az yer ile
    yanıtlıyor; SessionsContext hâlâ expose ediyor).
    **M5 (Active Session)**: Sadece visual patch (karar #5,
    modal queue / cycle bonus / rank unlock / presence indicator
    dokunulmadı). Background bgBase + iki AmbientGlow layer,
    timer 56pt light → 72pt bold + blue text-shadow glow, MM/
    colon/SS split + colonOpacity shared value ile 1s heartbeat
    pulse, +2 pts label 20pt semibold. Resist button = filled
    accent-color + white 17pt semibold + accent glow shadow
    (was outlined). Fail button = transparent + borderAccent +
    secondary text. Toolkit "Try a technique" = blue-tinted
    (accentBlue @ 10% bg, 30% border, accentBlue label).
    **M6 (stats hook)**: `lib/userStats.ts` — React Query hook
    (staleTime 5min), technique_uses DISTINCT technique_id where
    completed=true (yarım kalan uses sayılmaz), rest derives
    from SessionsContext + shared/ranks.
    **M7 (tests + docs + commit)**: 5 yeni case
    `tests/overallRank.test.ts` — ladder floor, mid-band
    progress, threshold-crossing jump, ceiling saturation,
    clamp bounds. Full suite 177/177 green; tsc + eslint clean.
    Yeni bağımlılık yok, expo-linear-gradient reddedildi (karar
    #2 react-native-svg zaten yeter). DB migration yok, Edge
    Function değişmedi.
22. **Faz 5 REVERSAL — Post-resolve trigger capture**: Faz 5'in
    pre-flight trigger seçim paradigması ters çevrildi. Orb →
    addiction tap artık `/craving-start` üzerinden geçmez, direkt
    `/active-session`'a atar. Timer bitince trigger seçimi çıkar.
    Sebep: kullanıcı craving'i tanımlarken düşünme kapasitesi
    minimum; atlattıktan sonra çok daha net cevap veriyor. Ayrıca
    friction: pre-flight seçim, "aslında ben sadece bakıcaktım"
    diyen kullanıcıyı geri çevirir.
    **Yeni resist akışı**: Timer → I Resisted → IntensityModal →
    seç → TriggerCaptureModal → seç → Resolve (tek atomik call).
    **Yeni fail akışı**: Timer → I Failed → TriggerCaptureModal →
    seç → Resolve (intensity yok — sadece resist için).
    **Client-only timer**: Mount'ta artık DB INSERT yok. Client
    UUID (`uuid` npm paketi) generate eder, AsyncStorage snapshot
    (`ActiveSnapshot v2`) tutar. Kill+relaunch'ta snapshot restore
    kaynağı — `active` DB row'una bakılmaz. Resolve anında Edge
    Function tek call ile INSERT (session row + score UPSERT +
    trigger rows + rank unlocks + momentum/streak update).
    Idempotency: session UUID PK conflict = replay path (aynı
    response). `pending_finish_v3` blob resolve invoke mid-flight
    network drop'ında ActiveSessionRestorer tarafından next
    launch'ta replay edilir.
    **TriggerCaptureModal** (`components/TriggerCaptureModal.tsx`):
    Bottom-sheet Modal, min-1 trigger zorunlu (Modül 3 verisi
    kritik), Skip yok. Cancel × timer'ı canlı tutar
    (side-effect yok). Common + addiction-specific chip grid,
    Save disabled with hint until min-1 seçilir. Copy tone farkı:
    resist için "Nice work — one more thing", fail için "It
    happens — one quick note" (aynı modal, farklı başlık).
    Silinen: `/craving-start` route + `components/FailureConfirmModal`
    (post-fail preselection modal'ı — post-resolve akışında
    pre-selection zaten yok). `lib/triggerSessions.ts` referanssız
    ama silinmedi (RLS fetch helper Modül 3 için gerekebilir).
    **Yeni Edge Function schema** (`resolve-craving`): payload
    genişledi — `session_id` (client UUID), `addiction_id`,
    `started_at`, `ended_at`, `sensitivity`, `outcome`,
    `intensity` (nullable), `trigger_ids[]` (min-1 server-side
    validate). Response şeması değişmedi. Deploy tek adım:
    `supabase functions deploy resolve-craving`.
    **Yan etki (Faz 7 presence)**: `active-presence` Edge
    Function `status='active'` rows saydığı için artık mid-flight
    kullanıcılar 0 sayılır (client-only timer). Kabul edilen
    trade-off; heartbeat tablosu ileride eklenirse presence
    geri gelir.
    **Yeni bağımlılık**: `uuid` (runtime) + `@types/uuid` (dev).
    DB migration yok (schema aynı, sadece INSERT timing değişti).

## 🏔️ Rütbe Merdiveni (9 rütbe)

Tanım: `shared/ranks.ts` (cross-runtime, Edge Function da okur) →
`constants/rankLadder.ts` (client sarmalayıcı). Görünen adlar
`i18n/en.json` → `ranks.<id>.name`.

| #   | **id (kodda)** | **Görünen ad** | Eşik (puan) |
| --- | -------------- | -------------- | ----------- |
| 1   | `traveler`     | **Base**       | 0           |
| 2   | `first_step`   | First Step     | 100         |
| 3   | `steady`       | Steady         | 400         |
| 4   | `persistent`   | **Ridge**      | 1.000       |
| 5   | `disciplined`  | **Foothold**   | 2.500       |
| 6   | `aware`        | **Vantage**    | 6.000       |
| 7   | `master`       | **Peak**       | 15.000      |
| 8   | `expert`       | **Horizon**    | 35.000      |
| 9   | `free`         | **Free**       | 75.000      |

> ⚠️ **TUZAK: id'ler ile görünen adlar uyuşmuyor.** İsimler "tırmanış
> anlatısı"na çevrildi (`a4aa3fd`) ama **id'ler kasten değişmedi** —
> `user_unlocked_ranks` satırları ve 004'ün eşikleri bu id'lere bağlı.
> `persistent` → "Ridge", `master` → "Peak" görürsen şaşırma; id'i
> yeniden adlandırmak kullanıcıların kazanılmış rütbelerini düşürür.

Her rütbenin bir ambleminin olduğu bir amblem sistemi var
(`bc62920`, `266b243`, `dc31621`) — Profile, Journey ve rütbe
gösterilen her yüzey aynı amblemi çeker.

## 🎨 Tasarım Turu (2026-07-21 → 08-05)

Bir ay boyunca uygulamanın **tamamı** yeniden tasarlandı. Ortak dil:
tek koyu lacivert zemin, bağımlılığın kendi rengi accent, programatik
SVG + Reanimated (görsel dosya yok, blur/gradient kütüphanesi yok).

| Yüzey                    | Ne oldu                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tema**                 | Üç ana sekme tek koyu lacivert zeminde birleşti (`22cca66`, `ad28bf9`); Info'nun dört modülü tek nötr tona bağlandı (`c821151`)                              |
| **Info**                 | İkon-only alt sekmeler + cross-fade geçiş (`0203add`); sekmeler arası yatay pager swipe (`32a4cd9`)                                                          |
| **Journey**              | Omurga dolgusu puanı yansıtıyor + neon (`ed7f197`); yıldız titremesi grup başına tek düğüme indirildi (perf, `ad28bf9`)                                      |
| **Toolkit**              | Kart carousel + ExerciseRunner iskeleti (aşağıda ayrı bölüm)                                                                                                 |
| **Triggers (Modül 3)**   | Baştan tasarım: hero insight'lar + radial saat + yatay heatmap (`dacacfa`, `ba4febd`); bağımlılığın rengine bağlandı (`f334e05`)                             |
| **Comparison (Modül 4)** | Sıfırdan 4 milestone: Pulse → Distribution/Standing (bell curve) → patterns + launch/low-data + premium gate (`4ff6037`→`03ae990`)                           |
| **Profile**              | "The Core" tasarımı (`01d7d78`), componentize (`3e56c40`), Core hero amblem sistemine geçti (`a6966a0`), Lifetime kartı "Aurora Veil" (`37d452e`, `900cad0`) |
| **Craving capture**      | Yoğunluk sayfası 1-10 kadranı (`6f8b3e9`), tetikleyici sayfası yeniden tasarlandı (`7982b7f`)                                                                |
| **Active session**       | Uygulama temasına uyum (`f4bd9fd`), kritik an için nefes alan neon çerçeve (`c061d0f`, `96b181e`)                                                            |
| **Picker**               | "Socket loadout" tasarımı (`b86cccf`) + neon materialize yerleşme (`f599640`)                                                                                |

**Kütüphane kısıtı:** `expo-blur`, `expo-linear-gradient`,
`@react-native-masked-view` **kurulu değil**. Blur taklidi çok duraklı
SVG radial gradient ile; web'de ek olarak `Platform.select({ web:
{ filter: 'blur(Npx)' } })`. Yeni tasarımda bunu varsay.

## 🧰 Toolkit / Egzersiz Mimarisi

- **`components/ExerciseRunner.tsx`** — tüm egzersizlerin kabuğu:
  Modal, faz akışı (guiding → feedback), `technique_uses` yazımı,
  `ExerciseAtmosphere` (SVG gökyüzü/nebula/yıldız katmanı), haptics
  ve `reducedMotion` enjeksiyonu. **Hiçbir egzersizi tanımaz.**
- **`components/technique/sceneRegistry.ts`** — `Record<TechniqueType,
ExerciseScene>`. Total record olduğu için yeni bir `TechniqueType`
  eklerken sahne kaydetmezsen **derleme kırılır** (eski `switch`'in
  `never` guard'ının yerini aldı).
  - `ownsProgress`: sahne kendi sayacını mı çiziyor
  - `foregroundGraceMs`: arka plandan dönünce kaç ms'ye kadar
    sıfırlamasın (Ride the Wave: 12s — **keyfi tahmin, cihazda ayarla**)
- **Sahne kontratı** (`components/technique/types.ts` → `SceneProps`):
  `onComplete()` tam bir kez, her an unmount'a hazır, `onProgress`,
  `haptics`, `reducedMotion`, `addictionId` (opsiyonel).

### Ride the Wave (5. egzersiz)

- 240s tek dalga: hızlı yükseliş → tepede yavaşlama (durmuyor) → uzun
  sönüm. Zaman `useFrameCallback` ile **sadece ön planda** ilerler.
- Geometri sabit, **zaman** TAU/TV keyframe'leriyle büküyor (`warp`).
- `intensity()`'nin iki yarısı da tepeye **sıfır eğimle** varmalı —
  aksi halde SVG ne kadar smooth olursa olsun tepede köşe kalır.
- **Sadece madde bağımlılıklarında**: `nicotine`, `alcohol`, `vape`,
  `pmo` (`RIDE_THE_WAVE_ADDICTIONS`). Filtre tek yerde:
  `techniquesForAddiction()`.
- Metin per-bağımlılık: `ride_the_wave.by_addiction.<id>.<phase>`,
  yoksa ortak satıra düşer. PMO metni **klinik ve nötr** — ekranda
  bağımlılık adı geçmez.

## 🔒 Güvenlik Denetimi (2026-07-31, migration 009)

Rate-limit/anti-spam denetiminde bulunan istismar yüzeyleri kapatıldı:

1. `user_total_score` view'ını **herkes** okuyabiliyordu → `security_invoker`
2. `anon` rolünün **her tabloda** INSERT/UPDATE/DELETE/TRUNCATE yetkisi vardı → geri alındı
3. `craving_sessions` client'a `FOR ALL` açıktı → kullanıcı çözülmüş satırı
   tekrar tekrar puanlatabiliyordu; UPDATE/DELETE kaldırıldı
4. `profiles` UPDATE kolon kapsamsızdı → sadece `username` kolonuna izin;
   ayrıca 3-24 karakter + `^[a-zA-Z0-9_-]+$` CHECK ve `lower(username)`
   üzerinde case-insensitive unique index (handle kapatma)
5. Serbest metin kolonlarına uzunluk sınırı
6. **Atomik rate limit**: eski limiter SELECT→hesapla→UPSERT yapıyordu
   (yarış koşulu). Yerine `bump_rate_limit()` SECURITY DEFINER fonksiyonu;
   client ne çağırabilir ne de kendi kovasını sıfırlayabilir
7. Migration sonunda verifier — yarım uygulanırsa yüksek sesle patlar

### Puan tavanları (`shared/scoring.ts` — hepsi server-side)

| Sabit                            | Değer | Niçin                                                                             |
| -------------------------------- | ----- | --------------------------------------------------------------------------------- |
| `MAX_SCORED_MINUTES`             | 240   | Tek ödülü ~2.600 puanla sınırlar; eski tavanda 5 çağrı en üst rütbeyi süpürüyordu |
| `MAX_DAILY_POINTS_PER_ADDICTION` | 5.000 | Günlük tavan                                                                      |
| `RATE_LIMIT_MAX_PER_HOUR`        | 20    | Saatlik çağrı tavanı                                                              |
| `MAX_SESSION_MINUTES`            | 1.440 | 24s üstü seans reddedilir                                                         |
| `FAILURE_PENALTY_MAX`            | 200   | Ceza skorun %5'i, 200'de kapanır                                                  |

> **Puanlama asla client'ta hesaplanmaz.** `resolve-craving` Edge
> Function tek otorite; client sadece ham girdiyi (süre, yoğunluk,
> sonuç) yollar.

## ⚡ Edge Functions (`supabase/functions/`)

Deploy: `supabase functions deploy <ad>` (CLI kurulu ve yetkili).

| Fonksiyon          | Ne yapar                                                                                                                                                                                                                                                                                                         | Durum                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `resolve-craving`  | **Puanlamanın tek otoritesi.** Süre/yoğunluk/sonuç alır, `shared/scoring.ts` ile hesaplar, `craving_sessions`'a `status='resolved'` yazar, skor + rütbe unlock'larını günceller. `session_id` üzerinden idempotent (PK çakışması eski cevabı döndürür)                                                           | canlı                                           |
| `trigger-map-data` | Modül 3 verisi: heatmap + peak hours + trigger dağılımı + insight'lar                                                                                                                                                                                                                                            | canlı                                           |
| `delete-account`   | **Gerçek hesap silme.** `auth.admin.deleteUser` service-role gerektirdiği için client'ta olamaz. Önce tüm kullanıcı tablolarını (craving_session_triggers, craving_sessions, technique_uses, user_addictions, scores…) siler, sonra `profiles`, en son auth kullanıcısını. Kısmi silmede yüksek sesle hata verir | **canlı, deploy edildi** (`6e5cef2`)            |
| `active-presence`  | Aynı anda craving yaşayan _diğer_ kullanıcı sayısı. JWT zorunlu, çağıranı sayımdan çıkarır                                                                                                                                                                                                                       | ⚠️ **her zaman 0 döndürüyor** — "Bilinen Bozuk" |

## 🧠 Önemli Kararlar (UX/Mimari)

| Karar                                            | Sebep                                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Puanlar asla düşmez**                          | Recovery'de cezalandırma motivasyon kırar                                                 |
| **Streak kayıpta kırılmaz, donar**               | Aynı sebep — dürüst paylaşımı teşvik et                                                   |
| **Date.now anchor (setInterval counter değil)**  | iOS background timer suspend eder; wall-clock immune                                      |
| **Sensitivity 1-10 → maxMin 5-15**               | İlk testlerde 60dk ceiling cezalandırıcı hissedildi                                       |
| **Cycle reset + bonus**                          | 15dk'lık tek bir hedef yerine tekrar eden mini-zaferler                                   |
| **Onboarding'de açık rıza**                      | KVKK Madde 9 sağlık verisi için "açık rıza" temeli                                        |
| **Handle opsiyonel**                             | Community kalktıktan sonra artık post-auth zorunlu değil                                  |
| **DEV_MODE artık yok**                           | Auth zorunlu; scoring server-only                                                         |
| **Egzersiz kabuğu egzersizi tanımaz**            | `ExerciseRunner` + `SCENE_REGISTRY`: yeni egzersiz eklemek runner'a dokunmaz              |
| **Ride the Wave sadece madde bağımlılıklarında** | Dalga eğrisi yükselen/tepe/sönen madde dürtüsü için yazıldı; davranışsal olanlara uymuyor |
| **Rütbe id'leri sabit, adlar i18n'de**           | İsim değişse de kazanılmış rütbe düşmesin                                                 |
| **Görsel katman programatik**                    | blur/gradient kütüphanesi yok; SVG + Reanimated ile çözülür                               |
| **Mock/demo veri işaretli**                      | `TEMP-*` marker'ları ile; backend gelince tek çağrı yeri değişsin                         |

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

### technique_uses

```
id | user_id | technique_id | addiction_id | context | feedback | used_at
```

- `technique_id` bir CHECK ile sınırlı (009 + 010): `breathing_478`,
  `urge_surfing`, `grounding_54321`, `body_scan`, `ride_the_wave`.
  **Yeni egzersiz eklerken bu CHECK'i genişletmezsen INSERT 23514 ile
  patlar ve egzersiz sessizce sayılmaz.**
- `context`: `active_craving` | `info_tab` — Modül 3 "önleyici mi,
  tepkisel mi" analizini bununla diliyor.

> **`momentum_log` YOK.** Migration 007 ile CASCADE drop edildi (ölü
> tablo, okuyanı yoktu — `13d111c`). Eski dokümanlarda görürsen inanma.

## ⚠️ Schema Gotcha'ları

1. **addiction_id TEXT, UUID değil** — preset id'leri ('nicotine' vs)
   doğrudan saklanır. Custom addiction'lar `custom-{ts}-{rand}` formatında.
2. **handle_new_user trigger** auth.users INSERT → profiles INSERT yapar
   (security definer + RLS bypass). Sadece `(id, onboarding_completed)`
   yazar; diğer tüm kolonlar DEFAULT'una düşer.
3. **`profiles.username` nullable ve DEFAULT'suz olmalı.** Bir zamanlar
   `NOT NULL DEFAULT ''` + UNIQUE idi → ilk kayıt boş string'i kapıyor,
   **ikinci kayıttan itibaren her signup 500 veriyordu.** 008 düzeltti.
   Detay için "Çözülmüş Bug'lar".
4. **`profiles.momentum` / `streak` NOT NULL ama DEFAULT'lu** (50 / 0).
   Kasıtlı: server-authoritative, client yazmaz (003 §5).
5. **`craving_sessions`'ta 'active' satır YOK.** Faz 5 REVERSAL'dan beri
   in-flight craving'in tek kaynağı AsyncStorage snapshot'ı; DB'ye
   sadece resolve anında `status='resolved'` yazılır. Bu, presence
   sayacını bozan sessiz varsayım — "Bilinen Bozuk"a bak.

## 🔐 RLS Özeti (009 abuse-lockdown sonrası)

- **profiles**: owner select/insert; UPDATE **sadece `username` kolonunda**
  (`grant update (username)`) — puan/streak'i client yazamaz
- **craving_sessions**: owner select/insert; **UPDATE/DELETE yok** (eskiden
  `FOR ALL` idi → kullanıcı kendi satırını sınırsız yeniden puanlatabiliyordu)
- **addictions** (custom): owner all
- **user_addiction_scores**: `force row level security`, client yazamaz
- **user_total_score** (view): `security_invoker = true` — eskiden **herkes**
  herkesin skorunu okuyabiliyordu
- **rate_limits**: RLS var, hiçbir policy yok → sadece service_role
- **anon rolü**: her tablodaki INSERT/UPDATE/DELETE/TRUNCATE yetkisi geri alındı

## 📦 Migration'lar

Dosyalar `supabase/migrations/`. **Supabase CLI kurulu ve yetkili** —
`supabase db query --linked --file x.sql` ile prod'a uygulanır
(dashboard SQL editor'a gerek yok).

| #   | Ne yaptı                                                                   | Durum                  |
| --- | -------------------------------------------------------------------------- | ---------------------- |
| 003 | backend scoring, rate_limits tablosu, momentum/streak server-authoritative | uygulandı              |
| 004 | rank ladder + `user_unlocked_ranks`                                        | uygulandı              |
| 005 | `craving_session_triggers`                                                 | uygulandı              |
| 006 | `technique_uses`                                                           | uygulandı              |
| 007 | hesap silme CASCADE'leri + `momentum_log` DROP                             | uygulandı              |
| 008 | **signup fix** — `profiles.username` nullable + DEFAULT kaldırıldı         | uygulandı              |
| 009 | **abuse lockdown** — RLS/grant sıkılaştırma + `bump_rate_limit()`          | uygulandı              |
| 010 | `technique_uses` CHECK'ine `ride_the_wave` eklendi                         | uygulandı (2026-08-03) |

> Additive yaz (`ADD COLUMN IF NOT EXISTS`), idempotent olsun, sonunda
> `do $$ ... raise exception ... $$` ile kendini doğrulasın. Reset yok.

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

## 🐛 Çözülmüş Bug'lar (kök nedeniyle — tekrar etmesin)

| Bug                                                      | Kök neden                                                                                                                                                                                                                                       | Çözüm                                                                                                                                                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Her yeni kayıt 500 veriyordu**                         | `profiles.username` `NOT NULL DEFAULT ''` + UNIQUE. `handle_new_user` username yazmaz → herkes DEFAULT `''`'e düşüyordu. İlk kayıt boş string'i kaptı, **sonraki her signup unique çakışmasına girdi**. Yeni kullanıcı kazanımı tamamen kırıktı | Migration **008**: kolon nullable + DEFAULT kaldırıldı, boş satır NULL'landı. Postgres UNIQUE NULL'ları eşit saymaz → sınırsız NULL sorun değil. **2026-08-05'te prod'da E2E doğrulandı: gerçek signup 200 döndü** |
| **Comparison açılışta çökme**                            | Worklet içinden JS fonksiyonu çağrılıyordu                                                                                                                                                                                                      | `ed859b6`                                                                                                                                                                                                          |
| **Craving ekranı iOS'ta açılmıyordu**                    | İki ayrı çökme; biri `uuid` v4'ün `crypto.getRandomValues` olmadan patlaması                                                                                                                                                                    | `e38a070` + root layout'ta `react-native-get-random-values` en üstte side-effect import                                                                                                                            |
| **CellDetailSheet web'de kendiliğinden açılıyordu**      | `a5208f1`                                                                                                                                                                                                                                       |                                                                                                                                                                                                                    |
| **Saat kartında yüzde iki kez yazılıyordu**              | `40af4b1`                                                                                                                                                                                                                                       |                                                                                                                                                                                                                    |
| **Sessizce yutulan promise hataları**                    | Hatalar yüzeye çıkarıldı                                                                                                                                                                                                                        | `b641c68`                                                                                                                                                                                                          |
| **iOS'ta neon çerçeve farklı görünüyordu**               | `96b181e`                                                                                                                                                                                                                                       |                                                                                                                                                                                                                    |
| **Heatmap hücreleri etiketlerle hizasızdı**              | Hücre geometrisi `useMemo`'sunun bağımlılıklarında `cellSize` yoktu → ölçüm gelince hücreler eski placeholder adımında kalıyordu                                                                                                                | `2eac1fa`                                                                                                                                                                                                          |
| **Ride the Wave tepesi köşeliydi**                       | Matematik: yükseliş tepeye eğim 0 ile varırken iniş eğim −1.5 ile başlıyordu. Path smoothing bunu gizleyemez                                                                                                                                    | İniş kendi smoothstep'inden geçirildi → iki yarı da düz varıyor (`3b6f0fc`)                                                                                                                                        |
| **Egzersiz metninde tire satır sonunda asılı kalıyordu** | Em-dash satır kenarına düşebilir; nbsp yaması sorunu bir alt satırın başına taşıdı                                                                                                                                                              | Tire metinden çıkarıldı (`3b6f0fc`)                                                                                                                                                                                |

## 🔴 Bilinen Bozuk

- **Presence sayacı her zaman 0 döner.** `active-presence` Edge Function
  `craving_sessions`'ta `status='active'` satırları sayıyor. Ama **Faz 5
  REVERSAL'dan beri kimse 'active' satır yazmıyor** — in-flight craving'in
  tek kaynağı AsyncStorage snapshot'ı, DB'ye sadece `resolve-craving`
  yazıyor ve o da `status:'resolved'` yazıyor. Yani sorgu hiçbir zaman
  eşleşmiyor. Sayaç 0 iken UI **hiçbir şey göstermiyor** (kasıtlı), o
  yüzden sessizce ölü. Düzeltmek için ya presence'ı ayrı bir tabloya/
  heartbeat'e taşımak ya da active satırı geri getirmek gerekir — ikisi de
  karar gerektirir, tek satırlık yama değil.

## 🚫 ASLA YAPMA

1. **`profiles.username`'e DEFAULT geri koyma / NOT NULL yapma.** Bu bug
   iki kez çıktı. Signup'ı tamamen kırar.
2. **Puanı client'ta hesaplama / DB'ye yazdırma.** Tek otorite
   `resolve-craving`. `profiles` UPDATE'i bilerek sadece `username`.
3. **`anon` rolüne yazma yetkisi verme**, RLS'i gevşetme, `FOR ALL`
   policy yazma. 009 bunları kapattı.
4. **Yeni egzersiz eklerken `technique_uses` CHECK'ini unutma** (010
   örnek). Unutursan egzersiz çalışır ama hiç sayılmaz.
5. **Rütbe id'lerini yeniden adlandırma.** Görünen adlar i18n'de değişir;
   id `user_unlocked_ranks`'e yazılıdır, değiştirirsen kazanılmış
   rütbeler düşer.
6. **Kullanıcının istemediği UI'ı silme.** "Geliştir" ≠ "yeniden yaz";
   sadece o eleman için açıkça "kaldır/sil" dendiğinde sil.
7. **8081 portunu işgal etme.** Kullanıcının `npx expo start`'ı orada;
   telefonu ona bağlı. Kendi preview'ını **8082/8083**'te aç, işin bitince
   kapat.
8. **Demo/mock veriyi commit'e sokma.** Sadece preview klonunda kalsın;
   geçici dev route'ları (`app/dev-*.tsx`) teslimden önce sil.
9. **Görsel işi "tamamlandı" diye teslim etme.** Kendi preview'ında
   screenshot alıp gözünle doğrula; doğrulamadıysan bunu açıkça söyle.
   Test sayısı görsel kanıt değildir.
10. **Prod DB'de yıkıcı işlemi teşhis etmeden yapma.** Önce canlı duruma
    karşı doğrula — eski bir teşhis bugünkü şemaya uymayabilir.
11. **Launch öncesi toolkit'e yeni egzersiz EKLEME.** Toolkit genişletmesi
    **v1.0 için KAPANDI**: 4 evrensel egzersiz (breathing / urge_surfing /
    grounding_54321 / body_scan) + **Ride the Wave** (nikotin/alkol/vape/pmo)
    - **Fake Feed** (doomscroll) = 6, bu kadar. Play It Forward, PMO redirect,
      Cloud Chase, Pour It Out vb. özel egzersizler **BİLİNÇLİ olarak v1.1'e
      ertelendi** — launch sonrası gerçek kullanıcı verisiyle önceliklendirilecek
      (hangi bağımlılık, hangi egzersizi gerçekten istiyor). Kullanıcı açıkça
      "v1.1'i aç / şu egzersizi ekle" demeden yeni sahne/registry girişi/katalog
      kaydı ekleme.

## 📋 Bekleyen / Sıradaki İşler

| Önem | İş                                                                                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴   | **Presence sayacı** — yukarıdaki kök nedene bir karar ver                                                                                                                   |
| ⭐   | **Ride the Wave dışındaki 4 egzersizin görsel turu** — hâlâ eski iskelette                                                                                                  |
| ⭐   | **Push notifications** (expo-notifications) — günlük hatırlatma                                                                                                             |
| ⭐   | **Apple/Google sign-in** — şu an sadece email/password                                                                                                                      |
| ◽   | Comparison verisi gerçek backend'e bağlanacak (şu an `TEMP-COMPARISON-MOCK-DATA`)                                                                                           |
| ◽   | Premium gate yazıldı ama mount edilmiyor (`TEMP-PREMIUM-GATE-DISABLED`)                                                                                                     |
| ◽   | Yaş + rıza kapıları geçici kapalı (`TEMP-AGE-GATE-DISABLED`, `b071c87`) — geri gelecek                                                                                      |
| ⏸️   | **v1.1 — özel egzersizler** (Play It Forward, PMO redirect, Cloud Chase, Pour It Out vb.) — launch sonrası kullanıcı verisiyle önceliklendir; şimdi EKLEME (ASLA YAPMA #11) |

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
7. **Supabase CLI kurulu ve yetkili** (eski not "kurulu değil" diyordu, yanlış).
   Prod'a SQL: `supabase db query --linked --file x.sql`, fonksiyon deploy:
   `supabase functions deploy <ad>`. `\echo` gibi psql meta komutları
   çalışmaz — saf SQL yaz.
8. **Kendi preview'ını 8082/8083'te aç** (`npx expo start --web --port 8082`),
   8081 kullanıcının. Görsel değişikliği ekran görüntüsüyle kendin doğrula.
9. Web preview boştayken `requestAnimationFrame` durur → Reanimated'ın
   **SVG `animatedProps` animasyonları akmaz**. Kompozisyon/renk/geometri
   web'de doğrulanır; sürekli hareket **cihazda** doğrulanmalı.
10. Gerçek repo `~/Desktop/Mobile/crave` (telefon buna bağlanır).
    `~/crave` ayrı bir kopya — düzeltmeyi yanlış yere yazma.
