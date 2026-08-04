import { authorizedFetch, signOut } from './auth'
import type { Page, User } from './admin'

/**
 * Kullanıcı detayının veri sözleşmesi.
 *
 * Bu tipler `GET /v1/admin/users/{userId}` yanıtının BİREBİR aynısıdır
 * (backend: internal/store/admin_user.go). İki taraftan birinde alan adı
 * değişirse ekran sessizce boşalır, o yüzden birlikte değişirler.
 *
 * Kapsam kararı (31 Tem 2026): kişi-bazlı okuma bilerek açık. Event altyapısı
 * belgesi "kişi-bazlı gözetleme ekranı yapma" diyordu; o kural büyüme paneli
 * için yazılmıştı ve orada geçerli, destek tarafı için kullanıcı kararıyla
 * revize edildi (afiet-mobile/docs/feature-list/event-altyapisi.md).
 */

// ── Profil ───────────────────────────────────────────────────────────────────

export type UserProfile = {
  userId: string
  email: string
  friendCode: string
  displayName: string | null
  emoji: string | null
  sex: string | null
  birthDate: string | null
  heightCm: number | null
  activityLevel: string | null
  sports: string[]
  createdAt: string
  updatedAt: string
  /** null ise tanışma akışı hiç bitmemiş; uygulama onboarding'e düşürür. */
  onboardedAt: string | null
  notificationsReadAt: string | null
}

/**
 * PATCH /v1/admin/users/{id} gövdesi.
 *
 * Verilmeyen alan "değişmez", BOŞ DİZE "temizle" demektir. Bu, uygulamanın
 * kendi profil ucundan bilerek farklı: orada bir alanı boşaltmanın yolu yok,
 * destek tarafında ise bir görünen adı geri alabilmek gerekiyor. Boy sayısal
 * olduğu için temizlenemez, yalnız değiştirilebilir. Arkadaş kodu sunucu
 * üretimidir; panel yalnız gösterir, yazamaz.
 */
export type UserProfilePatch = {
  displayName?: string
  emoji?: string
  email?: string
  sex?: string
  birthDate?: string
  activityLevel?: string
  heightCm?: number
  sports?: string[]
}

// ── Kullanım ve alışkanlık ───────────────────────────────────────────────────

export type UsageCounts = {
  mealCount: number
  customFoodCount: number
  measurementCount: number
  waterDays: number
  greetingsSent: number
  greetingsReceived: number
  afiyetDays: number
  afiyetWeeks: number
  /** Bugünden geriye kesintisiz afiyet günü; 0 ise seri kırık. */
  currentStreak: number
  longestStreak: number
  activeDays30: number
  lastActivityAt: string | null
}

export type DayCell = { date: string; meals: number; afiyet: boolean }
export type HourCount = { hour: number; count: number }
export type NamedCount = { key: string; label: string; count: number }
export type TopFood = { name: string; count: number; custom: boolean }
export type WaterDay = { date: string; glasses: number }
export type MeasurementPoint = { date: string; weightKg: number; waistCm: number | null }
export type RhythmWeek = { weekStart: string; days: number; goal: number }

export type UserHabits = {
  /** Son 12 hafta, pazartesi başlar; ısı haritasının hammaddesi. */
  days: DayCell[]
  mealsByHour: HourCount[]
  mealsByType: NamedCount[]
  groupCoverage: NamedCount[]
  topFoods: TopFood[]
  water: WaterDay[]
  measurements: MeasurementPoint[]
  rhythm: RhythmWeek[]
}

// ── Oturumlar (mobil telemetrisi) ────────────────────────────────────────────

export type SessionEvent = { name: string; at: string; props: Record<string, unknown> }
export type SessionRow = {
  id: string
  startedAt: string
  durationSec: number
  screens: number
  platform: string
  appVersion: string
  events: SessionEvent[]
}
export type ScreenStat = { screen: string; label: string; opens: number; avgSec: number }
export type SessionDay = { date: string; sessions: number; durationSec: number }

export type UserSessions = {
  summary: {
    total30d: number
    perWeek: number
    avgDurationSec: number
    medianScreens: number
    lastSessionAt: string | null
    /** Bildirimden açılan oturumların payı (0-1). */
    fromNotification: number
  }
  daily: SessionDay[]
  byHour: HourCount[]
  screens: ScreenStat[]
  recent: SessionRow[]
}

// ── Oyunlaştırma ─────────────────────────────────────────────────────────────

export type Progress = {
  level: number
  title: string
  totalXp: number
  xpIntoLevel: number
  xpForLevel: number
  xpToNext: number
  ratio: number
  levelsToNextTitle: number
}

export type XPEntry = { source: string; amount: number; occurredOn: string; dedupeKey: string; createdAt: string }
export type QuestState = {
  key: string
  title: string
  emoji: string
  target: number
  progress: number
  completedAt: string | null
  claimedAt: string | null
}
export type LeagueState = { tier: string; seat: number; points: number; rank: number; members: number; seasonStart: string } | null

export type UserGamification = {
  progress: Progress
  xpBySource: NamedCount[]
  recentXp: XPEntry[]
  quests: QuestState[]
  league: LeagueState
}

// ── Sosyal ve bildirim ───────────────────────────────────────────────────────

export type GroupMembership = {
  groupId: string
  name: string
  role: string
  members: number
  joinedAt: string
  sofraVisible: boolean
}

export type PushDeviceRow = {
  platform: string
  appVersion: string | null
  enabled: boolean
  lastSeenAt: string
}

/**
 * Saat alanları NULL olabilir ve bu bir eksiklik değil, bir anlam:
 * "kullanıcı kendi saatini seçmedi, panelden yönetilen genel ayarı izliyor".
 * Migration 000030 bu üç sütunu nullable yapıp mevcut satırları NULL'ladı.
 */
export type PushPreferences = {
  mealReminderEnabled: boolean
  mealReminderTime: string | null
  weekClosureEnabled: boolean
  socialEnabled: boolean
  timezone: string
  quietStart: string | null
  quietEnd: string | null
}

/**
 * One row of `push_deliveries`, which is a notification aimed at ONE device.
 *
 * The status set is the delivery one and it is spelled out rather than left as
 * `string`, because `push_events` has a different set that happens to overlap:
 * an event ends up `sent` or `failed`, a delivery never says `sent` at all.
 * The panel used to test a delivery for `'sent'`, so every row rendered as a
 * failure, delivered ones included, and only the dot beside it told the truth.
 */
export type DeliveryStatus = 'pending' | 'processing' | 'ticketed' | 'delivered' | 'failed'

export type DeliveryRow = { kind: string; title: string; status: DeliveryStatus; sentAt: string; error: string | null }

/** Delivery status as the panel says it. Severities are PrimeVue Tag values. */
export const deliveryStatusLabels: Record<DeliveryStatus, { label: string; severity: string }> = {
  pending: { label: 'kuyrukta', severity: 'secondary' },
  processing: { label: 'kuyrukta', severity: 'secondary' },
  ticketed: { label: 'yolda', severity: 'info' },
  delivered: { label: 'gitti', severity: 'success' },
  failed: { label: 'başarısız', severity: 'danger' },
}

/** Unknown status stays visible instead of rendering as a failure. */
export function deliveryStatusLabel(status: DeliveryStatus): { label: string; severity: string } {
  return deliveryStatusLabels[status] ?? { label: status, severity: 'secondary' }
}

export type UserSocial = { groups: GroupMembership[]; friends: number }
export type UserNotifications = {
  devices: PushDeviceRow[]
  preferences: PushPreferences | null
  recent: DeliveryRow[]
  sent30d: number
  failed30d: number
}

/** Panelden yapılan yazma işlemlerinin defteri; kim, neyi, ne zaman. */
export type AuditEntry = { at: string; actor: string; action: string; detail: string }

export type UserDetail = {
  profile: UserProfile
  usage: UsageCounts
  habits: UserHabits
  sessions: UserSessions
  gamification: UserGamification
  social: UserSocial
  notifications: UserNotifications
  audit: AuditEntry[]
}

/**
 * Bölümün kaynağı. Artık her bölüm canlı uçtan geliyor; tip, oturum
 * bölümünün özel durumu için duruyor: uç canlı olsa da mobil tarafta oturum
 * event'i göndermeyen bir sürüm kullanılıyorsa o bölüm boş gelir ve ekran
 * bunu "veri henüz akmıyor" diye söyler.
 */
export type Provenance = 'live' | 'demo'
export type UserDetailResult = {
  detail: UserDetail
  sources: Record<keyof UserDetail, Provenance>
}

// ── Etiketler ────────────────────────────────────────────────────────────────

export const MEAL_LABELS: Record<string, string> = {
  kahvalti: 'Kahvaltı', ogle: 'Öğle', aksam: 'Akşam', ara: 'Ara öğün',
}
export const GROUP_LABELS: Record<string, string> = {
  sebze: 'Sebze', meyve: 'Meyve', protein: 'Protein', tahil: 'Tahıl', sut: 'Süt',
  yag: 'Yağ', tatli: 'Tatlı', fastfood: 'Hazır yiyecek', bakliyat: 'Bakliyat',
  kuruyemis: 'Kuruyemiş', hamurisi: 'Hamur işi', icecek: 'İçecek',
}
export const XP_SOURCE_LABELS: Record<string, string> = {
  afiyet_day: 'Afiyet günü', afiyet_week: 'Afiyet haftası', meal_entry: 'Öğün kaydı',
  water_goal: 'Su hedefi', measurement: 'Ölçüm', greeting: 'Afiyet selamı',
  rainbow_week: 'Gökkuşağı haftası', milestone: 'Dönüm noktası', quest: 'Görev ödülü',
}
export const SEX_LABELS: Record<string, string> = { kadin: 'Kadın', erkek: 'Erkek' }
export const ACTIVITY_LABELS: Record<string, string> = {
  hareketsiz: 'Hareketsiz', az: 'Az hareketli', orta: 'Orta', aktif: 'Aktif', cok_aktif: 'Çok aktif',
}
export const TIER_LABELS: Record<string, string> = {
  tuz: 'Tuz', nane: 'Nane', kekik: 'Kekik', sumak: 'Sumak', safran: 'Safran',
}
/** Mobildeki SCREEN_TOKENS ile aynı küme (afiet-mobile/src/lib/session.ts). */
export const SCREEN_LABELS: Record<string, string> = {
  bugun: 'Bugün', beslenme: 'Beslenme', vucudum: 'Vücudum', grubum: 'Grubum',
  ekle: 'Öğün ekle', menum: 'Menüm', besinler: 'Besin rehberi', gorevlerim: 'Görevlerim',
  arkadaslarim: 'Arkadaşlarım', lig: 'Lig', profil: 'Profil', hesap: 'Hesap ayarları',
  bilgilerim: 'Bilgilerim', gorunum: 'Görünüm', veri: 'Veri', katil: 'Gruba katıl',
  onboarding: 'Tanışma', intro: 'Karşılama', login: 'Giriş',
}

export const label = {
  meal: (key: string) => MEAL_LABELS[key] ?? key,
  group: (key: string) => GROUP_LABELS[key] ?? key,
  xpSource: (key: string) => XP_SOURCE_LABELS[key] ?? key,
  sex: (key: string | null) => (key ? SEX_LABELS[key] ?? key : '—'),
  activity: (key: string | null) => (key ? ACTIVITY_LABELS[key] ?? key : '—'),
  tier: (key: string) => TIER_LABELS[key] ?? key,
  screen: (key: string) => SCREEN_LABELS[key] ?? key,
}

// ── Uç çağrıları ─────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authorizedFetch(path, init)
  if (response.status === 401) signOut()
  if (!response.ok) {
    let message = 'İşlem tamamlanamadı.'
    try {
      const body = await response.json()
      message = body?.error?.message || message
    } catch { /* boş gövde */ }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

/**
 * Panelin bildiği kullanıcı durumları. Son hareket tarihinden türetilir ve
 * istemcide hesaplanır: "aktif" tanımını sunucuya taşımak, aynı cümlenin iki
 * yerde yaşaması demek olurdu.
 */
export type UserStatus = 'yeni' | 'aktif' | 'yavaslayan' | 'sessiz' | 'hic'

/** Liste satırı ve detay yanıtı aynı alanları taşır; ikisi de buraya girer. */
export type StatusInput = {
  mealCount: number
  measurementCount: number
  lastActivityAt: string | null
  createdAt: string
}

export function statusOf(user: StatusInput, now = new Date()): UserStatus {
  const days = (value: string | null) =>
    value ? Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000) : Infinity
  if (user.mealCount === 0 && user.measurementCount === 0) return 'hic'
  const since = days(user.lastActivityAt)
  if (since <= 7) return days(user.createdAt) <= 7 ? 'yeni' : 'aktif'
  if (since <= 30) return 'yavaslayan'
  return 'sessiz'
}

export const STATUS_META: Record<UserStatus, { label: string; severity: string; hint: string }> = {
  yeni: { label: 'Yeni', severity: 'info', hint: 'Son 7 günde katıldı ve kayıt tutuyor' },
  aktif: { label: 'Aktif', severity: 'success', hint: 'Son 7 gün içinde hareket var' },
  yavaslayan: { label: 'Yavaşlayan', severity: 'warn', hint: '7-30 gündür hareket yok' },
  sessiz: { label: 'Sessiz', severity: 'danger', hint: '30 günden uzun süredir hareket yok' },
  hic: { label: 'Hiç kaydı yok', severity: 'secondary', hint: 'Profil açılmış ama tek bir kayıt bile yok' },
}

// ── Kişi sayfası ─────────────────────────────────────────────────────────────

/**
 * Damıtıcının bu kişi hakkında yazdığı bölümlerden biri.
 *
 * `updatedBy` cümlenin kimin sesi olduğunu söylüyor: 'agent' damıtıcı,
 * 'staff' bir insan, 'system' tohumlama. Panelde ayırt edilmezse sayfa
 * "sistem ne anladı" sorusunu cevaplayamaz hale gelir.
 */
export type PageSection = {
  sectionKey: string
  contentMd: string
  revision: number
  updatedBy: 'agent' | 'staff' | 'system'
  updatedAt: string
}

/** Kişinin damıtma döngüsünde nerede durduğu. */
export type PageStatus = {
  /** null ise kuyrukta değil: son koşu temizledi ve o gün bugün bir şey olmadı. */
  dueAt: string | null
  /** Sıfırdan büyükse damıtıcı bu kişide özellikle geri çekiliyor. */
  attempts: number
  lastRunAt: string | null
  /**
   * Öğrenilmiş ama sayfaya işlenmemiş notlar. Kaybolmuş veri DEĞİL: bunlar
   * asistanlara delta katmanı olarak zaten gidiyor. Sayfanın asistanların ne
   * kadar gerisinde kaldığını söyler.
   */
  pendingCandidates: number
}

export type UserPage = {
  sections: PageSection[]
  status: PageStatus
  /** Okuma sırası sunucudan gelir; panel kendi kopyasını tutmaz. */
  order: string[]
}

// ── Sohbet üstverisi ─────────────────────────────────────────────────────────

/** Bir konuşma, alıntılanmadan tarif edilmiş hali. */
export type ChatSessionSummary = {
  sessionId: string
  assistant: string
  startedAt: string
  lastTurnAt: string
  turns: number
  /** Yayını ortada kesilen turlar: kişinin gördüğü kesik cevap. */
  partialTurns: number
  /** İki tarafın yazdığı karakter. "Açıp bıraktı" ile "bir saat kullandı"yı ayırır. */
  chars: number
  /** Bu oturumun ürettiği hafıza adayı. Turlar var ama bu sıfırsa çıkarıcı durmuş. */
  candidates: number
}

export type ChatConsent = {
  consentKey: string
  textVersion: string
  acceptedAt: string
  revokedAt: string | null
}

/**
 * Damıtıcının uygulama için ürettiği yapılandırılmış görüş. Asistanların
 * okuduğu sayfadan ayrı: buradaki her alan kodun dallanabileceği bir şey.
 */
export type ProductProfile = {
  logsAround?: string
  skippedMeal?: string
  motivationTone?: string
  driftRisk?: string
  nudge?: string
}

export type UserChat = {
  sessions: ChatSessionSummary[] | null
  consents: ChatConsent[] | null
  productProfile: ProductProfile
  /** Yürürlükteki onay metni sürümü; eskiye verilmiş onayı ayırt etmek için. */
  currentConsentVersion: string
}

export type PageRevision = {
  revision: number
  contentMd: string
  editorType: 'agent' | 'staff' | 'system'
  /** Yazan çağrının kimliği ya da personelin e-postası; tohumlamada boş. */
  editorRef: string
  createdAt: string
}

export const usersApi = {
  list: (params: { page: number; pageSize: number; query?: string }) => {
    const search = new URLSearchParams()
    search.set('page', String(params.page))
    search.set('pageSize', String(params.pageSize))
    if (params.query) search.set('query', params.query)
    return request<Page<User>>(`/v1/admin/users?${search.toString()}`)
  },

  /**
   * Tek kullanıcının tüm detayı; tek istek.
   *
   * `sources` bugün tek bir şeyi ayırt ediyor: oturum bölümü boşsa mobil
   * telemetrisi o kullanıcıdan henüz akmıyor demektir ve ekran bunu söyler.
   */
  async detail(userId: string): Promise<UserDetailResult> {
    const detail = await request<UserDetail>(`/v1/admin/users/${userId}`)
    const live: Provenance = 'live'
    return {
      detail,
      sources: {
        profile: live, usage: live, habits: live, gamification: live,
        social: live, notifications: live, audit: live,
        sessions: detail.sessions.summary.total30d > 0 ? live : 'demo',
      },
    }
  },

  updateProfile: (userId: string, patch: UserProfilePatch) =>
    request<UserProfile>(`/v1/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  resetOnboarding: (userId: string) =>
    request<void>(`/v1/admin/users/${userId}/onboarding-reset`, { method: 'POST' }),

  /** Silme, hesabın kendi e-postasını gövdede tekrar ister: yanlış satırda
      tıklanan bir silme geri alınamaz. */
  deleteUser: (userId: string, email: string) =>
    request<void>(`/v1/admin/users/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ email }),
    }),

  adjustXp: (userId: string, amount: number, reason: string) =>
    request<Progress>(`/v1/admin/users/${userId}/xp`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    }),

  completeQuest: (userId: string, key: string) =>
    request<void>(`/v1/admin/users/${userId}/quests/${encodeURIComponent(key)}/complete`, {
      method: 'POST',
    }),

  /**
   * Sohbet ÜSTVERİSİ. Yazışma metni YOK ve bu bir eksik değil.
   *
   * Onay ekranı "cihaz değiştirsen de kaybolmasın diye saklanıyor" diyor,
   * "ekibimiz okuyabilir" demiyor. Metni panele taşımak eklenmemiş bir
   * özellik değil, verilmemiş bir izin.
   */
  chat: (userId: string) => request<UserChat>(`/v1/admin/users/${userId}/chat`),

  /** Kişi sayfası: damıtıcının yazdıkları + damıtma döngüsündeki durum. */
  page: (userId: string) => request<UserPage>(`/v1/admin/users/${userId}/page`),

  pageRevisions: (userId: string, sectionKey: string) =>
    request<{ items: PageRevision[] | null }>(
      `/v1/admin/users/${userId}/page/sections/${encodeURIComponent(sectionKey)}/revisions`,
    ),

  /**
   * Ekip notu, sayfanın insan yazabildiği TEK bölümü.
   *
   * Bölüm adı yolun sabit parçası, gövdenin alanı değil: panelin
   * kurabileceği hiçbir istek başka bir bölüme ulaşmıyor.
   */
  writeTeamNote: (userId: string, contentMd: string) =>
    request<{ sections: PageSection[] }>(`/v1/admin/users/${userId}/page/ekip-notu`, {
      method: 'PUT',
      body: JSON.stringify({ contentMd }),
    }),
}

