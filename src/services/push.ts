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
  recipientCount: number
  deliveredCount: number
  ignoreQuietHours: boolean
}

/** Gönder'e basmadan önce kaç cihaza gideceğini gösterir. */
export type PushAudiencePreview = { recipientCount: number; deviceCount: number }

export const pushStatusLabels: Record<PushBroadcastStatus, { label: string; severity: string }> = {
  scheduled: { label: 'Zamanlandı', severity: 'info' },
  sending: { label: 'Gönderiliyor', severity: 'warn' },
  sent: { label: 'Gönderildi', severity: 'success' },
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
  | 'meal_reminder' | 'week_closure' | 'greeting'
  | 'friend_request' | 'friend_accepted' | 'admin_broadcast'

/** Kullanıcının uygulamadan kapatabildiği tercih alanı. */
export type PushPreferenceKey =
  | 'mealReminderEnabled' | 'weekClosureEnabled' | 'socialEnabled' | 'announcementsEnabled'

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
  preferenceKey: PushPreferenceKey
  /** Bu kategoriyi açık tutan, bildirim izni vermiş kullanıcı sayısı. */
  optedIn: number
  /** Son 7 gün: kuyruğa giren bildirim, ulaşan, başarısız. */
  sent7d: number
  delivered7d: number
  failed7d: number
  updatedAt: string | null
  updatedBy: string
}

export type PushTriggerPatch = Partial<
  Pick<PushTrigger, 'enabled' | 'title' | 'body' | 'target' | 'time' | 'weekday'>
>

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
  users: { total: number; permitted: number }
  devices: { ios: number; android: number; disabled7d: number }
  delivery7d: { sent: number; delivered: number; failed: number }
  triggers: PushTrigger[]
  /** Henüz gönderilmemiş, zamanlanmış duyurular. */
  scheduled: PushBroadcast[]
}

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
  admin_broadcast: {
    label: 'Duyurular',
    icon: 'pi pi-megaphone',
    tone: 'green',
    optOut: 'Bildirimler ayarındaki “Duyurular” anahtarı',
    fields: { time: false, weekday: false, body: false, target: false },
    composeOnly: true,
    readOnlyNote: 'Metni her gönderimde Gönder sekmesinde yazılır. Buradaki anahtar tüm duyuruları topluca durdurur.',
  },
}

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
    case 'greeting':
      return 'Bir grup üyesi sofra selamı gönderdiğinde'
    case 'friend_request':
      return 'Birisi arkadaşlık isteği gönderdiğinde'
    case 'friend_accepted':
      return 'Gönderdiğin istek kabul edildiğinde'
    case 'admin_broadcast':
      return 'Gönder sekmesinden elle gönderildiğinde'
  }
}
