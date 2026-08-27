// Hedef listesi mobildeki src/features/push/push-target.ts ile aynı kümeyi taşır.
// Yeni ekran eklenince İKİ dosya birlikte güncellenir; mobilde karşılığı olmayan
// bir hedef gönderilirse bildirime dokunmak hiçbir şey yapmaz.
//
// İki tür hedef var: duyuru formunun sunduğu EKRAN hedefleri ve otomatik
// tetikleyicilerin kendi ürettiği ANLAMSAL hedefler (meal, week_closure,
// notifications, friend_requests, friends). İkisi de mobildeki aynı union'da
// yaşar; duyuru gönderimi yalnız ekran hedeflerini kabul eder.

export type PushScreenTarget =
  | 'bugun' | 'beslenme' | 'vucudum' | 'grubum'
  | 'arkadaslarim' | 'besinler' | 'menum' | 'ekle'
  | 'profil' | 'hesap' | 'bilgilerim' | 'gorunum' | 'veri'

export type PushSemanticTarget =
  | 'meal' | 'week_closure' | 'notifications' | 'friend_requests' | 'friends'

export type PushTarget = PushScreenTarget | PushSemanticTarget

export type PushTargetOption = { value: PushTarget; label: string }
export type PushTargetGroup = { label: string; items: PushTargetOption[] }

export const pushTargetGroups: PushTargetGroup[] = [
  {
    label: 'Sekmeler',
    items: [
      { value: 'bugun', label: 'Bugün' },
      { value: 'beslenme', label: 'Beslenme' },
      { value: 'vucudum', label: 'Vücudum' },
      { value: 'grubum', label: 'Grubum' },
    ],
  },
  {
    label: 'Diğer ekranlar',
    items: [
      { value: 'ekle', label: 'Öğün ekle' },
      { value: 'menum', label: 'Menüm' },
      { value: 'besinler', label: 'Besinler' },
      { value: 'arkadaslarim', label: 'Arkadaşlarım' },
      { value: 'profil', label: 'Profil' },
      { value: 'hesap', label: 'Hesap ayarları' },
      { value: 'bilgilerim', label: 'Bilgilerim' },
      { value: 'gorunum', label: 'Görünüm' },
      { value: 'veri', label: 'Veri' },
    ],
  },
]

/** Tetikleyici düzenlemesinde ekran hedeflerine ek olarak sunulan grup. */
export const pushTriggerTargetGroups: PushTargetGroup[] = [
  {
    label: 'Bildirimin kendi ekranı',
    items: [
      { value: 'meal', label: 'Öğün ekleme akışı' },
      { value: 'week_closure', label: 'Hafta kutlaması' },
      { value: 'notifications', label: 'Bildirim merkezi' },
      { value: 'friend_requests', label: 'Arkadaşlık istekleri' },
      { value: 'friends', label: 'Arkadaş listesi' },
    ],
  },
  ...pushTargetGroups,
]

const targetLabels = new Map(
  pushTriggerTargetGroups.flatMap((group) => group.items).map((item) => [item.value, item.label]),
)
export const pushTargetLabel = (value: string) => targetLabels.get(value as PushTarget) ?? value

export type PushAudience = { kind: 'all' } | { kind: 'user'; identifier: string }

export type PushBroadcastInput = {
  title: string
  body: string
  target: PushTarget
  audience: PushAudience
  /** ISO 8601; null ise hemen sıraya girer. */
  scheduledAt: string | null
  ignoreQuietHours: boolean
}

export type PushBroadcastStatus = 'scheduled' | 'sending' | 'sent' | 'cancelled'

export type PushBroadcast = {
  id: string
  title: string
  body: string
  target: PushTarget
  audience: PushAudience
  scheduledAt: string | null
  createdAt: string
  status: PushBroadcastStatus
  /**
   * KİŞİ sayısı. Duyuru kurulurken kitledeki her kullanıcı için bir
   * `push_events` satırı açılıyor ve `recipient_count` o INSERT'ün satır
   * sayısı oluyor (store/push_broadcast.go, CreatePushBroadcast).
   */
  recipientCount: number
  /**
   * CİHAZ sayısı, ve "ulaşan" değil "yola çıkan": sorgu
   * `status IN ('ticketed','delivered')` sayıyor, yani Expo'nun kabul ettiği
   * teslimatları. `ticketed` makbuz beklerken de buraya girer, sonradan
   * `failed` olabilir.
   *
   * Birim `recipientCount` ile AYNI DEĞİL: iki cihazlı tek kullanıcıda
   * 2/1 gibi bir oran çıkar. Panelde bu ikisi asla bölünmez, ikisi de
   * birimiyle yazılır.
   */
  deliveredCount: number
  ignoreQuietHours: boolean
}

/**
 * Gönder'e basmadan önceki kitle ölçüsü. İki AYRI birim:
 * `recipientCount` kaç KİŞİ, `deviceCount` o kişilerin kaç KAYITLI CİHAZI.
 * Cihaz kaydı olmak bildirimin ulaşacağı anlamına gelmez, yalnız kuyruğa
 * gireceği anlamına gelir.
 */
export type PushAudiencePreview = { recipientCount: number; deviceCount: number }

/**
 * Duyurunun durumu sunucuda türetiliyor: iptal varsa iptal, bekleyen
 * `push_events` varsa zamanlandı/gönderiliyor, hiç bekleyen kalmadıysa son
 * durum.
 *
 * BACKEND İŞİ: o son durum teslimatların başarılı olup olmadığına bakmıyor,
 * yalnız kuyruğun boşaldığına bakıyor. Tüm teslimatları `failed` olan bir
 * duyuru da buraya düşüyor. Bu yüzden etiket "Gönderildi" değil
 * "Kuyruk bitti": panelin söyleyebileceği doğru cümle bu. Ayrı bir
 * `failed` durumu sunucuda türetilene kadar geçmiş satırındaki sayılar
 * (yola çıkan / kişi) gerçeği anlatan tek yer.
 */
export const pushStatusLabels: Record<PushBroadcastStatus, { label: string; severity: string }> = {
  scheduled: { label: 'Zamanlandı', severity: 'info' },
  sending: { label: 'Gönderiliyor', severity: 'warn' },
  sent: { label: 'Kuyruk bitti', severity: 'success' },
  cancelled: { label: 'İptal edildi', severity: 'secondary' },
}

export const PUSH_TITLE_MAX = 60
export const PUSH_BODY_MAX = 160

// ---------------------------------------------------------------------------
// Aktif bildirimler: otomatik tetikleyiciler
// ---------------------------------------------------------------------------
// Kind kümesi push_events.kind CHECK kısıtıyla, store/push.go'daki üretici
// sorgularla ve ClaimPushDeliveries'teki kanal CASE'iyle aynı listedir. Dördü
// birlikte güncellenmezse istemci sessizce yanlış kanala düşer.

export type PushTriggerKind =
  | 'meal_reminder' | 'week_closure' | 'week_summary'
  | 'streak_3' | 'first_measurement' | 'meal_10' | 'first_custom_food'
  | 'quest_reward'
  | 'welcome_day1' | 'welcome_day3' | 'welcome_day7' | 'comeback'
  | 'greeting' | 'friend_request' | 'friend_accepted' | 'social_digest'
  | 'group_invite' | 'group_invite_accepted'
  | 'admin_broadcast'

/** Kullanıcının uygulamadan kapatabildiği tercih alanı. */
export type PushPreferenceKey =
  | 'mealReminderEnabled' | 'weekClosureEnabled' | 'socialEnabled'
  | 'invitationsEnabled' | 'announcementsEnabled'

export type PushTrigger = {
  kind: PushTriggerKind
  /** Panel anahtarı. Kapalıyken bu tür hiç kuyruğa girmez. */
  enabled: boolean
  title: string
  body: string
  target: PushTarget
  /**
   * HH:MM. meal_reminder'da kullanıcı uygulamadan kendi saatini seçmediyse
   * geçerli olan varsayılan; week_closure'da herkes için sabit gönderim saati.
   * Saat kavramı olmayan tetikleyicilerde null.
   */
  time: string | null
  /** ISO haftanın günü, 1 = Pazartesi. Yalnız week_closure'da dolu. */
  weekday: number | null
  /**
   * Ton başına gövde. Damıtıcı kişinin tonunu üretiyor, gönderim anında
   * karşılık gelen cümle seçiliyor. Yazılmamış ton `body`'ye düşer, yani
   * boş bırakmak "bu tetikleyicide ton ayrımı yok" demek.
   *
   * Metni model YAZMIYOR, aralarından SEÇİYOR: giden her cümleyi burada bir
   * insan yazmış oluyor.
   *
   * ŞEKİL İKİ TÜRLÜ VE BU BİLEREK BÖYLE. Bir ton ya tek cümledir ya da
   * sırayla dönen cümleler dizisi:
   *
   *   week_closure   → "tek cümle"
   *   meal_reminder  → ["üç", "ayrı", "cümle"]   (aynı akşam sözleri iki kez
   *                                               duyulmasın diye sırayla döner)
   *
   * İkisini gönderim tarafında AYRI sorgular okuyor, o yüzden şekil bir
   * tutarsızlık değil hangi sorgunun okuduğuna bağlı bir tercih. Panel şekli
   * KORUR: aldığını geri gönderir. Diziye çevrilen bir kapanış cümlesi
   * bildirimde ham JSON olarak görünürdü, cümleye indirgenen bir hatırlatma
   * dizisi ise varyantı hiç kullanmayıp varsayılan gövdeye düşerdi.
   */
  bodyVariants: Partial<Record<PushTone, string | string[]>>
  preferenceKey: PushPreferenceKey
  /** Bu kategoriyi açık tutan, kayıtlı cihazı olan kullanıcı sayısı. */
  optedIn: number
  /**
   * Son 7 gün. Sözlük için aşağıdaki PUSH_METRIC_GLOSSARY'ye bak: `sent7d`
   * KUYRUĞA GİREN teslimat satırlarının tamamı, `delivered7d` yalnız makbuzu
   * onaylananlar. `sent7d` adı sunucudan geliyor ve "gönderildi" demek DEĞİL.
   */
  sent7d: number
  delivered7d: number
  failed7d: number
  updatedAt: string | null
  updatedBy: string
}

export type PushTriggerPatch = Partial<
  Pick<PushTrigger, 'enabled' | 'title' | 'body' | 'target' | 'time' | 'weekday' | 'bodyVariants'>
>

/**
 * Damıtıcının üretebildiği ton kümesi. Sunucu aynı listeyi doğruluyor;
 * dördüncü bir ton yazabilmek, hiçbir zaman seçilmeyecek bir metin yazmak
 * olurdu.
 */
export const PUSH_TONES = ['sakin', 'doğrudan', 'oyunlu'] as const
export type PushTone = (typeof PUSH_TONES)[number]

export const PUSH_TONE_META: Record<PushTone, { label: string; hint: string }> = {
  sakin: { label: 'Sakin', hint: 'Sessiz, iddiasız; teşviği yumuşak alan kişiler' },
  'doğrudan': { label: 'Doğrudan', hint: 'Kısa ve net; süslemesiz olanı tercih edenler' },
  oyunlu: { label: 'Oyunlu', hint: 'Hafif, esprili; oyunla ilerleyen kişiler' },
}

/** Sessiz saatler ve ana anahtar; ikisi de tüm tetikleyicileri kapsar. */
export type PushGlobalSettings = {
  /**
   * Panelden anında susturma. Deploy gerektiren PUSH_ENABLED ile VE'lenir:
   * ikisi de açık olmadan hiçbir gönderim başlamaz.
   */
  masterEnabled: boolean
  /** Ortam değişkeni PUSH_ENABLED, salt okunur. */
  envEnabled: boolean
  /** HH:MM. Bu aralığa denk gelen sosyal bildirimler sabaha ertelenir. */
  quietStart: string
  quietEnd: string
}

export type PushOverview = PushGlobalSettings & {
  /** `permitted`: en az bir kayıtlı cihazı olan kullanıcı sayısı. */
  users: { total: number; permitted: number }
  /**
   * `ios`/`android`: `push_devices WHERE enabled` satır sayısı. Bu KAYITLI
   * cihaz demek, "aktif" ya da "bildirim alabilen" demek DEĞİL: kayıt
   * duruyor ve token'ı henüz ölü sayılmamış, o kadar. Panelde bu sayı
   * yıllarca 4 gösterirken hiçbirine tek bildirim ulaşmamış olabilir,
   * dev'de tam olarak bu oldu.
   *
   * `disabled7d`: son 7 günde `enabled = false` çevrilmiş kayıt sayısı. Bu
   * bayrağı tek çeviren yer store/push.go'daki MarkPushReceipt: Expo/APNs
   * kalıcı token hatası döndüğünde cihaz emekliye ayrılıyor. Yani bu sayı
   * "uygulamayı silen" ya da "izni kapatan" cihazları ÖLÇEMEZ:
   *   - uygulamayı silen / çıkış yapan cihazın satırı DELETE ediliyor,
   *     geriye sayılacak bir şey kalmıyor;
   *   - işletim sistemi ayarından izni kapatan mobil tarafta hiç
   *     algılanmıyor, satır `enabled` kalmaya devam ediyor.
   * Panelde bu yüzden "emekliye ayrılan cihaz" diye anılıyor.
   */
  devices: { ios: number; android: number; disabled7d: number }
  /**
   * Son 7 günün teslimat sayaçları. `sent` KUYRUĞA GİREN satırların tamamı:
   * `SELECT count(*) FROM push_deliveries WHERE created_at >= now() - 7d`,
   * yani pending/processing/ticketed de içinde. "Gönderilen" değil.
   * `delivered` yalnız makbuzu onaylananlar, `failed` kalıcı hatalar.
   * Üçünün toplamı `sent`'ten küçük olabilir: aradaki fark hâlâ yolda
   * olanlardır.
   */
  delivery7d: { sent: number; delivered: number; failed: number }
  triggers: PushTrigger[]
  /** Henüz gönderilmemiş, zamanlanmış duyurular. */
  scheduled: PushBroadcast[]
}

/**
 * PANELİN BİLDİRİM SÖZLÜĞÜ. Yeni bir bildirim etiketi yazarken buradaki dört
 * kelimeden birini seç; "gönderim" kelimesini KULLANMA.
 *
 *   kuyruğa giren  push_deliveries satırı açıldı. Tüm durumlar dahil
 *                  (pending, processing, ticketed, delivered, failed).
 *                  Hiçbir şeyin gittiğini söylemez.
 *   yola çıkan     status IN ('ticketed','delivered'). Expo teslimatı kabul
 *                  etti; ticketed olan sonradan failed'e düşebilir.
 *   ulaşan         status = 'delivered'. Makbuz onayladı, cihaza gerçekten
 *                  ulaştı. Panelde yüzde hep bunun üzerinden hesaplanır.
 *   başarısız      status = 'failed'. Kalıcı token hatasında cihaz da
 *                  emekliye ayrılır (store/push.go, MarkPushReceipt).
 *
 * Bu düzeltmeden önce panelde üç ayrı "gönderim" dolaşıyordu: bildirimler
 * sayfası TÜM teslimat satırlarını, kullanıcı detayı ticketed+delivered'ı,
 * duyuru geçmişi yine ticketed+delivered'ı aynı kelimeyle yazıyordu.
 *
 * BACKEND İŞİ: alan adları (`sent`, `sent7d`, `sent30d`) hâlâ üç ayrı şeyi
 * "sent" diye adlandırıyor ve ikisi bu sözlükte "gönderim" bile değil.
 * Sözleşme yenilenene kadar doğru kelimeyi UI koyuyor.
 */

export type PushGlobalPatch = Partial<Pick<PushGlobalSettings, 'masterEnabled' | 'quietStart' | 'quietEnd'>>

/**
 * Sunum tarafı: etiket, ikon, koşul cümlesi ve hangi alanların düzenlenebildiği.
 * API'den gelmez, panelde yaşar. `readOnlyNote` panelden değiştirilemeyen ama
 * bilinmesi gereken kod sabitlerini anlatır.
 */
export type PushTriggerMeta = {
  label: string
  icon: string
  tone: 'green' | 'amber' | 'coral' | 'blue'
  /** Kullanıcının bunu neyle kapattığını anlatan cümle. */
  optOut: string
  fields: { time: boolean; weekday: boolean; body: boolean; target: boolean }
  readOnlyNote?: string
  /** Metin alanları düzenlenemiyorsa (duyurular her gönderimde yazılır). */
  composeOnly?: boolean
}

export const pushTriggerMeta: Record<PushTriggerKind, PushTriggerMeta> = {
  meal_reminder: {
    label: 'Öğün hatırlatması',
    icon: 'pi pi-clock',
    tone: 'green',
    optOut: 'Bildirimler ayarındaki “Öğün hatırlatması” anahtarı',
    fields: { time: true, weekday: false, body: true, target: true },
    readOnlyNote: 'Kullanıcı uygulamadan kendi saatini seçebilir. Buradaki saat yalnız hiç seçmemiş olanlarda geçerlidir.',
  },
  week_summary: {
    label: 'Geçen haftan',
    icon: 'pi pi-calendar',
    tone: 'amber',
    optOut: 'Bildirimler ayarındaki “Kutlamalar” anahtarı',
    fields: { time: true, weekday: true, body: true, target: true },
    readOnlyNote: 'Pazartesi sabahı, geçen hafta en az bir gün kayıt tutulduysa. Hiçbir şey yazılmamış hafta bildirim üretmez: o hafta hakkında dürüst bir olumlu cümle yok.',
  },
  streak_3: {
    label: 'Üç gün üst üste',
    icon: 'pi pi-bolt',
    tone: 'amber',
    optOut: 'Bildirimler ayarındaki “Kutlamalar” anahtarı',
    fields: { time: false, weekday: false, body: true, target: true },
    readOnlyNote: 'Üçüncü ardışık kayıt gününde. Eşik ürün kodunda sabittir.',
  },
  first_measurement: {
    label: 'İlk ölçüm',
    icon: 'pi pi-chart-line',
    tone: 'amber',
    optOut: 'Bildirimler ayarındaki “Kutlamalar” anahtarı',
    fields: { time: false, weekday: false, body: true, target: true },
    readOnlyNote: 'Kişi ilk ölçümünü girdiğinde, bir kez.',
  },
  meal_10: {
    label: 'Onuncu kayıt',
    icon: 'pi pi-check-circle',
    tone: 'amber',
    optOut: 'Bildirimler ayarındaki “Kutlamalar” anahtarı',
    fields: { time: false, weekday: false, body: true, target: true },
    readOnlyNote: 'Onuncu öğün kaydında, bir kez.',
  },
  first_custom_food: {
    label: 'İlk kendi besini',
    icon: 'pi pi-plus-circle',
    tone: 'amber',
    optOut: 'Bildirimler ayarındaki “Kutlamalar” anahtarı',
    fields: { time: false, weekday: false, body: true, target: true },
    readOnlyNote: 'Kişi kataloğa kendi besinini eklediğinde, bir kez.',
  },
  quest_reward: {
    label: 'Alınmamış görev ödülü',
    icon: 'pi pi-gift',
    tone: 'amber',
    optOut: 'Bildirimler ayarındaki “Kutlamalar” anahtarı',
    fields: { time: true, weekday: false, body: true, target: true },
    readOnlyNote: 'Tamamlanmış ama ödülü alınmamış görev varsa, günün belirlenen saatinde. Saat şart: alınmamış ödül gün boyu doğrudur, saatsiz bırakılırsa tikin denk geldiği ana göre gece de gidebilir.',
  },
  welcome_day1: {
    label: 'Hoş geldin · ikinci gün',
    icon: 'pi pi-sun',
    tone: 'green',
    optOut: 'Bildirimler ayarındaki “Davetler” anahtarı',
    fields: { time: true, weekday: false, body: true, target: true },
    readOnlyNote: 'Kayıttan sonraki gün. Yapılmamış bir şeyi söylemez, ikinci günü davet eder.',
  },
  welcome_day3: {
    label: 'Hoş geldin · ölçüm daveti',
    icon: 'pi pi-compass',
    tone: 'green',
    optOut: 'Bildirimler ayarındaki “Davetler” anahtarı',
    fields: { time: true, weekday: false, body: true, target: true },
    readOnlyNote: 'Üçüncü gün. Kişi ölçümünü zaten girdiyse bu adım tümden atlanır.',
  },
  welcome_day7: {
    label: 'Hoş geldin · ilk hafta',
    icon: 'pi pi-flag',
    tone: 'green',
    optOut: 'Bildirimler ayarındaki “Davetler” anahtarı',
    fields: { time: true, weekday: false, body: true, target: true },
    readOnlyNote: 'Yedinci gün, ilk haftada ne olduğunu bildirir. {sayi} gönderim anında kayıt günü sayısına dönüşür.',
  },
  comeback: {
    label: 'Geri dönüş daveti',
    icon: 'pi pi-undo',
    tone: 'coral',
    optOut: 'Bildirimler ayarındaki “Davetler” anahtarı',
    fields: { time: true, weekday: false, body: true, target: true },
    readOnlyNote: 'Uzaklaşmış kademedekilerin duyduğu tek şey. Sayı söylemez ve bir şey istemez: üç hafta önce ayrılan birine ne kadar olduğunu hatırlatmak değil, kapının açık olduğunu göstermek gerekir.',
  },
  week_closure: {
    label: 'Afiyet haftası kutlaması',
    icon: 'pi pi-star',
    tone: 'amber',
    optOut: 'Bildirimler ayarındaki “Hafta kapanışı” anahtarı',
    fields: { time: true, weekday: true, body: true, target: true },
    readOnlyNote: 'Hafta eşiği 5 afiyet günü. Bu sayı ürünün ritim vaadidir, kodda tek sabit olarak durur (store/rhythm.go).',
  },
  greeting: {
    label: 'Sofra selamı',
    icon: 'pi pi-heart-fill',
    tone: 'coral',
    optOut: 'Bildirimler ayarındaki “Sofra ve arkadaşlar” anahtarı',
    fields: { time: false, weekday: false, body: true, target: true },
    readOnlyNote: 'Grup üyesi selam gönderdiği anda kuyruğa girer. Sessiz saatlere denk gelirse sabaha ertelenir.',
  },
  friend_request: {
    label: 'Arkadaşlık isteği',
    icon: 'pi pi-user-plus',
    tone: 'blue',
    optOut: 'Bildirimler ayarındaki “Sofra ve arkadaşlar” anahtarı',
    fields: { time: false, weekday: false, body: true, target: true },
    readOnlyNote: 'İstek gönderildiği anda kuyruğa girer. Sessiz saatlere denk gelirse sabaha ertelenir.',
  },
  friend_accepted: {
    label: 'İstek kabul edildi',
    icon: 'pi pi-check-circle',
    tone: 'blue',
    optOut: 'Bildirimler ayarındaki “Sofra ve arkadaşlar” anahtarı',
    fields: { time: false, weekday: false, body: true, target: true },
    readOnlyNote: 'İstek kabul edildiği anda kuyruğa girer. Sessiz saatlere denk gelirse sabaha ertelenir.',
  },
  social_digest: {
    label: 'Sofra özeti',
    icon: 'pi pi-inbox',
    tone: 'blue',
    optOut: 'Bildirimler ayarındaki “Sofra ve arkadaşlar” anahtarı',
    fields: { time: false, weekday: false, body: true, target: true },
    readOnlyNote: 'Sosyal kova taşınca fazlası düşmez, bekler ve tek özet olarak çıkar. {sayi} birleşen bildirim sayısına dönüşür.',
  },
  group_invite: {
    label: 'Sofra daveti',
    icon: 'pi pi-users',
    tone: 'blue',
    optOut: 'Bildirimler ayarındaki “Sofra ve arkadaşlar” anahtarı',
    fields: { time: false, weekday: false, body: true, target: true },
    readOnlyNote: 'Birisi gruba davet ettiği anda kuyruğa girer.',
  },
  group_invite_accepted: {
    label: 'Davet kabul edildi',
    icon: 'pi pi-user-plus',
    tone: 'blue',
    optOut: 'Bildirimler ayarındaki “Sofra ve arkadaşlar” anahtarı',
    fields: { time: false, weekday: false, body: true, target: true },
    readOnlyNote: 'Gönderdiğin davet kabul edildiğinde kuyruğa girer.',
  },
  admin_broadcast: {
    label: 'Duyuru',
    icon: 'pi pi-megaphone',
    tone: 'green',
    optOut: 'Bildirimler ayarındaki “Duyurular” anahtarı',
    fields: { time: false, weekday: false, body: false, target: false },
    composeOnly: true,
    readOnlyNote: 'Metni her gönderimde Gönder sekmesinde yazılır. Buradaki anahtar tüm duyuruları topluca durdurur.',
  },
}

/**
 * Tür → insan dili. Bir bildirimin adı GEÇTİĞİ HER YERDE buradan okunur:
 * akış satırı, kişi sayfası, tetikleyici kartı. Tek sözlük var çünkü iki
 * sözlük er geç birbirinden ayrı düşer.
 *
 * Sözlük backend'deki `store.PushTriggerKinds` ile birebir aynıdır ve onunla
 * BİRLİKTE büyür. Eksik kalırsa panel ham kod gösterir: kişi sayfasındaki
 * "meal_10 · Bekliyor" satırları tam olarak buydu, panel altı tür tanırken
 * sunucu on dokuz tür üretiyordu. Tanınmayan tür ham koduyla görünür;
 * sessizce boş kalmasından iyidir.
 */
export const pushKindLabel = (kind: string): string =>
  pushTriggerMeta[kind as PushTriggerKind]?.label ?? kind

/**
 * Saat alanları HH:MM metni olarak taşınır, Date'e çevrilmez. PrimeVue
 * DatePicker'ın timeOnly + 24 saat kipinde elle yazılan saati modele HİÇ
 * işlemediği (populateTime, ampm undefined iken patlıyor ve onInput hatayı
 * yutuyor) görüldü: girdi 20:15 gösterirken eski değer kaydediliyordu.
 * Maskeli metin alanı bu sessiz kaybı ortadan kaldırıyor.
 */
export const PUSH_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
export const isValidPushTime = (value: string | null | undefined): value is string =>
  typeof value === 'string' && PUSH_TIME_PATTERN.test(value)

export const pushWeekdays = [
  { value: 1, label: 'Pazartesi' },
  { value: 2, label: 'Salı' },
  { value: 3, label: 'Çarşamba' },
  { value: 4, label: 'Perşembe' },
  { value: 5, label: 'Cuma' },
  { value: 6, label: 'Cumartesi' },
  { value: 7, label: 'Pazar' },
]

const weekdayLabels = new Map(pushWeekdays.map((day) => [day.value, day.label]))

/** Kartın üstündeki tek satırlık koşul cümlesi. */
export function pushTriggerCondition(trigger: PushTrigger): string {
  switch (trigger.kind) {
    case 'meal_reminder':
      return `Her gün ${trigger.time}, o güne hiç öğün eklenmemişse`
    case 'week_closure':
      return `${weekdayLabels.get(trigger.weekday ?? 1)} ${trigger.time}, geçen hafta 5 afiyet günü dolduysa`
    case 'week_summary':
      return `${weekdayLabels.get(trigger.weekday ?? 1)} ${trigger.time}, geçen hafta en az bir gün yazıldıysa`
    case 'streak_3':
      return 'Üçüncü ardışık kayıt gününde'
    case 'first_measurement':
      return 'İlk ölçüm girildiğinde, bir kez'
    case 'meal_10':
      return 'Onuncu öğün kaydında, bir kez'
    case 'first_custom_food':
      return 'Kataloğa ilk kendi besini eklendiğinde, bir kez'
    case 'quest_reward':
      return `Her gün ${trigger.time}, alınmamış bir görev ödülü varsa`
    case 'welcome_day1':
      return `Kayıttan sonraki gün ${trigger.time}`
    case 'welcome_day3':
      return `Üçüncü gün ${trigger.time}, ölçüm henüz girilmediyse`
    case 'welcome_day7':
      return `Yedinci gün ${trigger.time}`
    case 'comeback':
      return `Uzaklaşmış kademedeyken ${trigger.time}`
    case 'greeting':
      return 'Bir grup üyesi sofra selamı gönderdiğinde'
    case 'friend_request':
      return 'Birisi arkadaşlık isteği gönderdiğinde'
    case 'friend_accepted':
      return 'Gönderdiğin istek kabul edildiğinde'
    case 'social_digest':
      return 'Sosyal kova taştığında, günde bir kez'
    case 'group_invite':
      return 'Birisi sofrasına davet ettiğinde'
    case 'group_invite_accepted':
      return 'Gönderdiğin davet kabul edildiğinde'
    case 'admin_broadcast':
      return 'Gönder sekmesinden elle gönderildiğinde'
  }
}


/* ------------------------------------------------------------------ *
 * Neden susuyor: tek bir kişi için kapının verdiği kararların okunuşu.
 * ------------------------------------------------------------------ */

export interface PushPersonKind {
  kind: string
  consecutiveUnopened: number
  daysSinceLast: number
  damped: boolean
}

export interface PushPersonDecision {
  kind: string
  status: 'pending' | 'promoted' | 'dropped' | 'merged'
  reason?: string
  createdAt: string
  decidedAt: string | null
}

export interface PushPersonEvent {
  kind: string
  title: string
  variant?: string
  status: string
  sentAt: string
  openedAt: string | null
}

export interface PushPerson {
  stage: string
  tenure: { daysSinceFirstLog: number; daysSinceLastLog: number; loggingDaysLast7: number }
  allowance: {
    daily: number
    social: number
    weekly: number
    windowDays: number
    remindersAllowed: boolean
    weeklyReminderCap: number
  }
  spend: { today: number; last7: number; last30: number; remindersLast7: number }
  devices: number
  measuring: boolean
  kinds: PushPersonKind[]
  decisions: PushPersonDecision[]
  events: PushPersonEvent[]
}

/** Kademe adları. Boş dize "hiç kayıt yapmamış" demek, bir kademe değil. */
export const stageLabels: Record<string, string> = {
  '': 'Henüz başlamamış',
  yeni: 'Yeni',
  aliskanlik: 'Alışkanlık kuruyor',
  duzenli: 'Düzenli',
  suruklenen: 'Sürükleniyor',
  kayip: 'Uzaklaşmış',
}

/**
 * Düşme sebepleri kapıdan makine kodu olarak geliyor; Türkçesi burada.
 * Teslimat durumlarında yaşanan karışıklığın tekrarlanmaması için sözlük
 * eksiksiz: karşılığı olmayan bir kod ham haliyle gösterilir, sessizce
 * "başarısız" ya da boş görünmez.
 */
export const dropReasonLabels: Record<string, string> = {
  daily_cap: 'Günlük tavan doluydu',
  social_cap: 'Sosyal kova doluydu',
  digest_used: 'O günün özeti zaten gitmişti',
  digest_off: 'Özet tetikleyicisi kapalı',
  tone_balance: 'Son bildirimler zaten hatırlatma ağırlıklıydı',
  stage_closed: 'Bu kademede bu tür kapalı',
  stage_cap: 'Kademenin haftalık hakkı doluydu',
  reminder_cap: 'Haftalık hatırlatma hakkı doluydu',
  damped: 'Bu tür dinlenmede (üst üste açılmadı)',
  opened_app: 'Zilde bekliyordu, kişi uygulamayı açtı',
  no_device: 'Bildirime izin verilmemiş (zilde duruyor)',
  muted: 'Kutlamalar kapalı (zilde duruyor)',
}

export function dropReasonLabel(reason?: string): string {
  if (!reason) return ''
  return dropReasonLabels[reason] ?? reason
}

export const decisionStatusLabels: Record<PushPersonDecision['status'], string> = {
  pending: 'Bekliyor',
  promoted: 'Gönderildi',
  dropped: 'Düştü',
  merged: 'Özete katıldı',
}

/* ------------------------------------------------------------------ *
 * Akış: kime ne gitti, ne gitmedi.
 * ------------------------------------------------------------------ */

/**
 * Bir satırın başına gelen. Sıra "iyiden kötüye" değil, CEVABIN NETLİĞİ:
 * en tepedekiler kesin bir şey söyler, aşağıya inildikçe cümle zayıflar.
 *
 *   acildi     kişi bildirime dokundu (push_events.opened_at dolu). Panelin
 *              elindeki tek gerçek etkileşim kanıtı budur.
 *   ulasti     en az bir cihazda makbuz onaylandı (delivery = 'delivered').
 *   yolaCikti  Expo teslimatı kabul etti ama makbuz henüz gelmedi
 *              ('ticketed'). Sonradan başarısıza düşebilir.
 *   kuyrukta   push_events satırı açıldı, henüz yola çıkmadı.
 *   ulasmadi   kalıcı hata; cihaz emekliye ayrılmış olabilir.
 *   gitmedi    kapı reddetti, hiç bildirim üretilmedi. `reason` neden söyler.
 *   ozete      sosyal kova taştı, tek tek gitmek yerine özete katıldı.
 *
 * BU SÖZLÜKTE "gönderim" KELİMESİ YOK; yukarıdaki bildirim sözlüğünün aynı
 * kuralı burada da geçerli.
 */
export type PushFeedOutcome =
  | 'acildi' | 'ulasti' | 'yolaCikti' | 'kuyrukta' | 'ulasmadi' | 'gitmedi' | 'ozete'

export const pushOutcomeMeta: Record<PushFeedOutcome, { label: string; severity: string }> = {
  acildi: { label: 'açtı', severity: 'success' },
  ulasti: { label: 'ulaştı', severity: 'info' },
  yolaCikti: { label: 'yola çıktı', severity: 'info' },
  kuyrukta: { label: 'kuyrukta', severity: 'secondary' },
  ulasmadi: { label: 'ulaşmadı', severity: 'danger' },
  gitmedi: { label: 'gitmedi', severity: 'warn' },
  ozete: { label: 'özete katıldı', severity: 'secondary' },
}

/** Akışın hangi yarısı: varsayılan yalnız gerçekten çıkanlar. */
export type PushFeedScope = 'giden' | 'gitmeyen' | 'hepsi'

export const pushFeedScopes: { value: PushFeedScope; label: string }[] = [
  { value: 'giden', label: 'Gidenler' },
  { value: 'gitmeyen', label: 'Gitmeyenler' },
  { value: 'hepsi', label: 'Hepsi' },
]

/**
 * Akıştaki tek satır: BİR KİŞİYE giden (ya da gitmeyen) BİR bildirim.
 *
 * Duyurular da tek tek satır olur. "Herkese gitti" cümlesi kimin aldığını
 * söylemiyordu; kaydı kişi düzeyinde tutmayan bir panel "bu kişiye ne gitti"
 * sorusuna hiçbir zaman cevap veremez.
 */
export type PushFeedRow = {
  /** push_events.id ya da push_proposals.id; ikisi de UUID, çakışmaz. */
  id: string
  userId: string
  email: string
  displayName: string | null
  emoji: string | null
  kind: string
  /** Gerçekten gönderilen başlık ve gövde; tetikleyicinin şablonu değil. */
  title: string
  body: string
  /** Seçilen ton varyantı; boş ise gövde tek başına durmuş. */
  variant: string
  outcome: PushFeedOutcome
  /** Yalnız 'gitmedi'de dolu: kapının yazdığı ham sebep kodu. */
  reason: string
  /** Satırın doğduğu an (teklif ya da olay). */
  createdAt: string
  /** Kuyruktan çıktığı an; kuyrukta ve gitmeyenlerde null. */
  sentAt: string | null
  openedAt: string | null
  /** Cihaz kırılımı. Kişi başına birden çok cihaz olabilir. */
  devices: { total: number; delivered: number; failed: number }
}

/**
 * Son 7 günün özeti. `openRate` YALNIZ ulaşanların paydasıyla hesaplanır:
 * ulaşmamış bir bildirimin açılmamış olması kişi hakkında hiçbir şey söylemez,
 * paydaya katılırsa oranı sessizce aşağı çeker. Ulaşan yoksa null döner,
 * "%0" değil.
 */
export type PushFeedSummary = {
  giden: number
  ulasan: number
  acilan: number
  gitmeyen: number
  openRate: number | null
}

export type PushFeed = {
  items: PushFeedRow[]
  total: number
  page: number
  pageSize: number
  summary: PushFeedSummary
  /** Akışta gerçekten geçen türler; filtre listesi buradan kurulur. */
  kinds: string[]
}

export type PushFeedQuery = {
  page: number
  pageSize: number
  scope: PushFeedScope
  kind?: string
  /** E-posta ya da görünen ad içinde arar. */
  q?: string
}
