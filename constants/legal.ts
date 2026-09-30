import type { LangCode } from '@/lib/i18nCore';

/**
 * Privacy Policy + Terms of Use, rendered by app/legal.tsx.
 *
 * Kept out of i18n/*.json on purpose: these are long structured documents,
 * not UI strings, and they must be reviewed as whole documents. English is
 * the source of truth; every language must carry both documents.
 *
 * The text describes what the app actually does — keep it in step with the
 * code. If a new kind of data starts being collected (analytics, crash
 * reporting, payments…), this file changes in the same commit.
 */

export type LegalDocId = 'privacy' | 'terms';

export type LegalDoc = {
  title: string;
  updated: string;
  sections: readonly { heading: string; body: readonly string[] }[];
};

const LAST_UPDATED = { en: '30 September 2026', tr: '30 Eylül 2026' };

const EN: Record<LegalDocId, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updated: `Last updated: ${LAST_UPDATED.en}`,
    sections: [
      {
        heading: 'The short version',
        body: [
          'Crave helps you resist cravings. To do that it stores a record of your cravings and progress. We do not sell your data, we do not show ads, and we do not track you across other apps or websites.',
        ],
      },
      {
        heading: 'What we collect',
        body: [
          'Account: an anonymous account identifier created when you first open the app. If you choose to save your progress, the email address you enter.',
          'Health-related usage data: the habits you choose to track, and for each craving session its start and end time, duration, outcome (resisted or gave in), and — only if you add them — an intensity rating and trigger tags. Also your points, ranks, streak, which techniques you used and how they felt.',
          'Feedback you send us through "Report a problem", together with the app version and platform (iOS or Android).',
          'On your device only (never sent to us): your confirmation that you are 18 or older and the time you gave consent during setup, your language and vibration settings.',
          'We do not collect your location, contacts, photos or advertising identifiers.',
        ],
      },
      {
        heading: 'Why we use it',
        body: [
          'To run the app: count your resisted cravings, calculate points, ranks and streaks, and show your patterns (for example which triggers come up most).',
          'To fix problems you report.',
          'The data about your cravings is health-related. We process it only with the explicit consent you give during setup.',
        ],
      },
      {
        heading: 'Where it is stored',
        body: [
          'Your data is stored with our database and authentication provider, Supabase, on servers in the European Union (Ireland). Access is restricted so that each account can only read its own data.',
          'If you buy Premium, the payment is handled by Apple or Google. We never receive your card details.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'As long as your account exists. When you delete your account, your craving history, scores and account are erased from our servers.',
        ],
      },
      {
        heading: 'Your choices and rights',
        body: [
          'You can delete your account and all of its data at any time: Profile → Delete account. This also withdraws your consent.',
          'You can ask us to access or correct your data, or ask any question about this policy, through Profile → Report a problem.',
        ],
      },
      {
        heading: 'Age',
        body: ['Crave is for adults aged 18 and over.'],
      },
      {
        heading: 'Changes',
        body: [
          'If this policy changes, we will update this page and the date at the top.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: `Last updated: ${LAST_UPDATED.en}`,
    sections: [
      {
        heading: 'Not medical care',
        body: [
          'Crave is a self-help tool. It is not medical advice, diagnosis or treatment, and it does not replace a doctor, therapist or addiction service.',
          'If you are in danger, thinking about harming yourself, or experiencing a medical emergency, contact your local emergency number right away.',
        ],
      },
      {
        heading: 'Who can use Crave',
        body: ['You must be 18 or older to use Crave.'],
      },
      {
        heading: 'Your account',
        body: [
          'Crave creates an anonymous account the first time you open it. Until you save your progress with an email address, your progress is tied to this device: deleting the app or changing phones can lose it.',
          'Keep your email and password safe. You are responsible for activity on your account.',
        ],
      },
      {
        heading: 'Premium',
        body: [
          'Some features require a Premium subscription, sold through the App Store or Google Play. Subscriptions renew automatically until you cancel them in your store account settings. Refunds are handled by Apple or Google under their policies.',
        ],
      },
      {
        heading: 'Fair use',
        body: [
          "Do not misuse the app: no attempts to access other people's data, to manipulate points or ranks, to overload our services, or to reverse engineer the app.",
          'We may suspend accounts that break these rules.',
        ],
      },
      {
        heading: 'No guarantee',
        body: [
          'We work to keep Crave useful and available, but it is provided "as is" without guarantees of any particular result. To the extent the law allows, we are not liable for indirect losses from using the app.',
        ],
      },
      {
        heading: 'Ending',
        body: [
          'You can stop using Crave and delete your account at any time from Profile → Delete account.',
        ],
      },
      {
        heading: 'Changes',
        body: [
          'We may update these terms. If we do, we will update this page and the date at the top. Continuing to use Crave means you accept the updated terms.',
        ],
      },
    ],
  },
};

const TR: Record<LegalDocId, LegalDoc> = {
  privacy: {
    title: 'Gizlilik Politikası',
    updated: `Son güncelleme: ${LAST_UPDATED.tr}`,
    sections: [
      {
        heading: 'Kısaca',
        body: [
          'Crave dürtülere direnmene yardım eder. Bunun için dürtülerinin ve ilerlemenin kaydını tutar. Verini satmayız, reklam göstermeyiz ve seni başka uygulamalarda ya da sitelerde takip etmeyiz.',
        ],
      },
      {
        heading: 'Ne topluyoruz',
        body: [
          'Hesap: uygulamayı ilk açtığında oluşturulan anonim bir hesap kimliği. İlerlemeni kaydetmeyi seçersen, girdiğin e-posta adresi.',
          'Sağlıkla ilgili kullanım verisi: takip etmeyi seçtiğin alışkanlıklar ve her dürtü seansının başlangıç ve bitiş zamanı, süresi, sonucu (direndin ya da pes ettin) ve — yalnızca sen eklersen — yoğunluk puanı ile tetikleyici etiketleri. Ayrıca puanların, rütbelerin, serin, hangi teknikleri kullandığın ve nasıl hissettirdikleri.',
          '"Sorun bildir" ile bize gönderdiğin geri bildirimler, uygulama sürümü ve platform (iOS veya Android) bilgisiyle birlikte.',
          'Yalnızca cihazında (bize hiç gönderilmez): kurulumda 18 yaşında veya büyük olduğunu onaylaman ve onay verdiğin zaman, dil ve titreşim ayarların.',
          'Konumunu, rehberini, fotoğraflarını veya reklam kimliğini toplamayız.',
        ],
      },
      {
        heading: 'Neden kullanıyoruz',
        body: [
          'Uygulamayı çalıştırmak için: direndiğin dürtüleri saymak, puan, rütbe ve serini hesaplamak ve örüntülerini göstermek (örneğin en sık hangi tetikleyicilerin çıktığı).',
          'Bildirdiğin sorunları düzeltmek için.',
          'Dürtülerinle ilgili veriler sağlıkla ilgilidir. Bunları yalnızca kurulum sırasında verdiğin açık rızaya dayanarak işleriz.',
        ],
      },
      {
        heading: 'Nerede saklanıyor',
        body: [
          "Verilerin, veritabanı ve kimlik doğrulama sağlayıcımız Supabase'de, Avrupa Birliği'ndeki (İrlanda) sunucularda saklanır. Erişim, her hesabın yalnızca kendi verisini okuyabileceği şekilde sınırlandırılmıştır.",
          'Premium satın alırsan ödemeyi Apple veya Google işler. Kart bilgilerini asla almayız.',
        ],
      },
      {
        heading: 'Ne kadar süre tutuyoruz',
        body: [
          'Hesabın var olduğu sürece. Hesabını sildiğinde dürtü geçmişin, puanların ve hesabın sunucularımızdan silinir.',
        ],
      },
      {
        heading: 'Seçimlerin ve hakların',
        body: [
          'Hesabını ve tüm verilerini istediğin zaman silebilirsin: Profil → Hesabı sil. Bu aynı zamanda rızanı geri çeker.',
          'Verine erişmek, onu düzeltmek ya da bu politika hakkında soru sormak için Profil → Sorun bildir üzerinden bize yazabilirsin.',
        ],
      },
      {
        heading: 'Yaş',
        body: ['Crave 18 yaş ve üzeri yetişkinler içindir.'],
      },
      {
        heading: 'Değişiklikler',
        body: [
          'Bu politika değişirse bu sayfayı ve en üstteki tarihi güncelleriz.',
        ],
      },
    ],
  },
  terms: {
    title: 'Kullanım Şartları',
    updated: `Son güncelleme: ${LAST_UPDATED.tr}`,
    sections: [
      {
        heading: 'Tıbbi bakım değildir',
        body: [
          'Crave bir kendi kendine yardım aracıdır. Tıbbi tavsiye, teşhis veya tedavi değildir; doktor, terapist ya da bağımlılık hizmetlerinin yerini tutmaz.',
          "Tehlikedeysen, kendine zarar vermeyi düşünüyorsan ya da tıbbi bir acil durum yaşıyorsan hemen 112'yi (ya da bulunduğun yerdeki acil numarayı) ara.",
        ],
      },
      {
        heading: 'Kimler kullanabilir',
        body: ["Crave'i kullanmak için 18 yaşında veya daha büyük olmalısın."],
      },
      {
        heading: 'Hesabın',
        body: [
          'Crave, uygulamayı ilk açtığında anonim bir hesap oluşturur. İlerlemeni bir e-posta adresiyle kaydedene kadar ilerlemen bu cihaza bağlıdır: uygulamayı silmek ya da telefon değiştirmek onu kaybettirebilir.',
          'E-postanı ve şifreni güvende tut. Hesabındaki etkinlikten sen sorumlusun.',
        ],
      },
      {
        heading: 'Premium',
        body: [
          'Bazı özellikler, App Store veya Google Play üzerinden satılan Premium aboneliği gerektirir. Abonelikler, mağaza hesabı ayarlarından iptal edene kadar otomatik olarak yenilenir. İadeler Apple veya Google tarafından kendi politikalarına göre yapılır.',
        ],
      },
      {
        heading: 'Adil kullanım',
        body: [
          'Uygulamayı kötüye kullanma: başkalarının verisine erişmeye, puan veya rütbeleri manipüle etmeye, hizmetlerimizi aşırı yüklemeye ya da uygulamayı tersine mühendislikle çözmeye çalışma.',
          'Bu kurallara uymayan hesapları askıya alabiliriz.',
        ],
      },
      {
        heading: 'Garanti yok',
        body: [
          'Crave\'i faydalı ve erişilebilir tutmak için çalışırız, ancak uygulama belirli bir sonucu garanti etmeden "olduğu gibi" sunulur. Yasaların izin verdiği ölçüde, uygulamanın kullanımından doğan dolaylı kayıplardan sorumlu değiliz.',
        ],
      },
      {
        heading: 'Sona erme',
        body: [
          "Crave'i kullanmayı istediğin zaman bırakabilir ve hesabını Profil → Hesabı sil üzerinden silebilirsin.",
        ],
      },
      {
        heading: 'Değişiklikler',
        body: [
          "Bu şartları güncelleyebiliriz. Güncellersek bu sayfayı ve en üstteki tarihi değiştiririz. Crave'i kullanmaya devam etmen güncel şartları kabul ettiğin anlamına gelir.",
        ],
      },
    ],
  },
};

const DOCS: Record<LangCode, Record<LegalDocId, LegalDoc>> = { en: EN, tr: TR };

export function legalDoc(id: LegalDocId, lang: LangCode): LegalDoc {
  return (DOCS[lang] ?? EN)[id];
}
