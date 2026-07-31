import { authorizedFetch, signOut } from './auth'
import type { Page, User } from './admin'

/**
 * Kullanıcı detayının veri sözleşmesi.
 *
 * Bu tipler `GET /v1/admin/users/{userId}` ucunun YAZILACAĞI şekildir. Uç
 * henüz yok; panelin bu ekranı onaylanana kadar `demoUserDetail()` aynı şekli
 * üretir ve her bölüm kaynağını (`live` / `demo`) kendisi söyler. Uç açıldığı
 * gün tek değişiklik `userDetail()` içindeki dalın düşmesidir, ekranlar aynen
 * kalır.
 *
 * Kapsam kararı (31 Tem 2026): kişi-bazlı okuma bilerek açılıyor. Event
 * altyapısı belgesi (afiet-mobile/docs/feature-list/event-altyapisi.md)
 * "kişi-bazlı gözetleme ekranı yapma" diyordu; o kural kohort okuması için
 * yazılmıştı ve destek/inceleme ihtiyacı doğduğunda kullanıcı kararıyla
 * revize edildi. Belge bu iş kapsamında güncellenir.
 */

// ── Profil ───────────────────────────────────────────────────────────────────

export type UserProfile = {
  userId: string
  email: string
  username: string | null
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

/** PATCH /v1/admin/users/{id} gövdesi; verilmeyen alan değişmez demektir. */
export type UserProfilePatch = Partial<
  Pick<UserProfile, 'displayName' | 'emoji' | 'username' | 'email' | 'sex' | 'birthDate' | 'heightCm' | 'activityLevel'>
> & { sports?: string[] }

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

export type PushPreferences = {
  mealReminderEnabled: boolean
  mealReminderTime: string
  weekClosureEnabled: boolean
  socialEnabled: boolean
  timezone: string
  quietStart: string
  quietEnd: string
}

export type DeliveryRow = { kind: string; title: string; status: string; sentAt: string; error: string | null }

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

/** Bölümün canlı uçtan mı yoksa demo üreticiden mi geldiği. */
export type Provenance = 'live' | 'demo'
export type UserDetailResult = {
  detail: UserDetail
  /** Bölüm adı → kaynak. Ekranda rozet olarak görünür. */
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
export const SCREEN_LABELS: Record<string, string> = {
  bugun: 'Bugün', beslenme: 'Beslenme', vucudum: 'Vücudum', grubum: 'Grubum',
  ekle: 'Öğün ekle', menum: 'Menüm', besinler: 'Besin rehberi', gorevlerim: 'Görevlerim',
  profil: 'Profil', arkadaslarim: 'Arkadaşlarım', bildirimler: 'Bildirimler',
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

/** Panelin bildiği kullanıcı durumları; sunucu filtresi Faz 2'de gelir. */
export type UserStatus = 'yeni' | 'aktif' | 'yavaslayan' | 'sessiz' | 'hic'

export function statusOf(user: User, now = new Date()): UserStatus {
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

export const usersApi = {
  /**
   * Tek kullanıcıyı kimliğinden bulur.
   *
   * Uçta kimliğe göre okuma YOK (arama yalnız e-posta/ad üzerinde çalışır), o
   * yüzden sayfa çekilip içinden bulunuyor. Beta ölçeğinde tek istek yetiyor;
   * `GET /v1/admin/users/{id}` açıldığı gün bu fonksiyon tek satıra iner.
   */
  async byId(userId: string): Promise<User | null> {
    const result = await request<Page<User>>(`/v1/admin/users?page=1&pageSize=500`)
    return result.items.find((item) => item.userId === userId) ?? null
  },

  list: (params: { page: number; pageSize: number; query?: string }) => {
    const search = new URLSearchParams()
    search.set('page', String(params.page))
    search.set('pageSize', String(params.pageSize))
    if (params.query) search.set('query', params.query)
    return request<Page<User>>(`/v1/admin/users?${search.toString()}`)
  },

  /**
   * Tek kullanıcının tüm detayı.
   *
   * Bugün yalnız oyunlaştırma bölümü canlı: `/v1/admin/progress/{id}` zaten
   * var. Ötekiler ucu bekliyor ve demo üreticiden geliyor; her bölümün
   * kaynağı `sources` içinde döner, ekran bunu rozetle söyler.
   */
  async detail(user: User): Promise<UserDetailResult> {
    const demo = demoUserDetail(user)
    const sources: Record<keyof UserDetail, Provenance> = {
      profile: 'demo', usage: 'live', habits: 'demo', sessions: 'demo',
      gamification: 'demo', social: 'demo', notifications: 'demo', audit: 'demo',
    }
    // Listeden gelen sayaçlar gerçek; demo bunları ezmez.
    demo.usage.mealCount = user.mealCount
    demo.usage.customFoodCount = user.customFoodCount
    demo.usage.measurementCount = user.measurementCount
    demo.usage.lastActivityAt = user.lastActivityAt
    demo.profile.email = user.email
    demo.profile.displayName = user.displayName
    demo.profile.emoji = user.emoji
    demo.profile.createdAt = user.createdAt
    demo.profile.updatedAt = user.updatedAt

    try {
      const progress = await request<{ userId: string; username: string | null; progress: Progress; recent: XPEntry[] }>(
        `/v1/admin/progress/${user.userId}`,
      )
      demo.gamification.progress = progress.progress
      demo.gamification.recentXp = progress.recent
      demo.gamification.xpBySource = tally(progress.recent)
      demo.profile.username = progress.username
      sources.gamification = 'live'
    } catch {
      // Uç kapalıysa (ör. XP defteri boş) demo değerler kalır; rozet 'demo' der.
    }
    return { detail: demo, sources }
  },
}

function tally(entries: XPEntry[]): NamedCount[] {
  const map = new Map<string, number>()
  entries.forEach((entry) => map.set(entry.source, (map.get(entry.source) ?? 0) + entry.amount))
  return [...map.entries()]
    .map(([key, count]) => ({ key, label: label.xpSource(key), count }))
    .sort((a, b) => b.count - a.count)
}

// ── Demo üretici ─────────────────────────────────────────────────────────────
//
// Faz 1'in tek amacı ekranı görmek. Üretici userId'den tohumlanır: aynı
// kullanıcı her açılışta aynı grafiği verir, ekran arasında gezinmek sayıları
// zıplatmaz. Uç açılınca bu bölümün tamamı silinir.

function seedFrom(text: string): () => number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash += 0x6d2b79f5
    let value = Math.imul(hash ^ (hash >>> 15), 1 | hash)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (date: Date) => date.toISOString().slice(0, 10)
const shift = (days: number) => {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date
}

function demoUserDetail(user: User): UserDetail {
  const random = seedFrom(user.userId)
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)]
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))

  // Kullanıcının "sıkılığı": ısı haritasından oturum sayısına kadar her şeyi
  // tek bir mizaç belirler ki ekran tutarlı bir insan gibi okunsun.
  const density = 0.25 + random() * 0.6

  const days: DayCell[] = []
  for (let i = 83; i >= 0; i -= 1) {
    const weekday = shift(i).getDay()
    const weekendDrop = weekday === 0 || weekday === 6 ? 0.55 : 1
    const meals = random() < density * weekendDrop ? between(1, 4) : 0
    days.push({ date: iso(shift(i)), meals, afiyet: meals > 0 })
  }

  const mealsByHour: HourCount[] = Array.from({ length: 24 }, (_, hour) => {
    const peak = [8, 13, 20].reduce((best, center) => Math.max(best, 1 - Math.abs(hour - center) / 4), 0)
    return { hour, count: Math.max(0, Math.round(peak * between(4, 18) * density)) }
  })

  const mealsByType: NamedCount[] = ['kahvalti', 'ogle', 'aksam', 'ara'].map((key) => ({
    key, label: label.meal(key), count: between(4, 60),
  }))

  const groupCoverage: NamedCount[] = Object.keys(GROUP_LABELS).map((key) => ({
    key, label: label.group(key), count: between(0, 45),
  })).sort((a, b) => b.count - a.count)

  const foodNames = ['Yumurta', 'Beyaz peynir', 'Tam buğday ekmek', 'Zeytin', 'Çay', 'Mercimek çorbası',
    'Tavuk göğsü', 'Yoğurt', 'Domates', 'Salatalık', 'Muz', 'Bulgur pilavı', 'Kuru fasulye', 'Ceviz']
  const topFoods: TopFood[] = foodNames
    .map((name) => ({ name, count: between(2, 48), custom: random() < 0.2 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const water: WaterDay[] = Array.from({ length: 30 }, (_, i) => ({
    date: iso(shift(29 - i)),
    glasses: random() < density ? between(2, 10) : 0,
  }))

  const startWeight = 60 + between(0, 35)
  const measurements: MeasurementPoint[] = Array.from({ length: 10 }, (_, i) => ({
    date: iso(shift((9 - i) * 7 + between(0, 2))),
    weightKg: Number((startWeight - i * (random() * 0.4)).toFixed(1)),
    waistCm: random() < 0.6 ? 70 + between(0, 30) : null,
  }))

  const rhythm: RhythmWeek[] = Array.from({ length: 12 }, (_, i) => ({
    weekStart: iso(shift((11 - i) * 7 + shift((11 - i) * 7).getDay())),
    days: Math.min(7, Math.round(density * 7 + (random() - 0.5) * 2)),
    goal: 5,
  }))

  const screens: ScreenStat[] = ['bugun', 'ekle', 'beslenme', 'grubum', 'vucudum', 'menum', 'besinler', 'gorevlerim']
    .map((screen) => ({
      screen, label: label.screen(screen),
      opens: Math.round(between(3, 90) * density),
      avgSec: between(8, 95),
    }))
    .sort((a, b) => b.opens - a.opens)

  const daily: SessionDay[] = Array.from({ length: 30 }, (_, i) => {
    const sessions = random() < density * 1.2 ? between(1, 5) : 0
    return { date: iso(shift(29 - i)), sessions, durationSec: sessions * between(35, 240) }
  })

  const total30d = daily.reduce((sum, day) => sum + day.sessions, 0)
  const totalSec = daily.reduce((sum, day) => sum + day.durationSec, 0)

  const eventNames = ['app_open', 'screen_view', 'meal_logged', 'water_logged', 'balance_viewed',
    'afiyet_day_completed', 'week_summary_opened', 'afi_assist_used', 'nudge_acted']
  const recent: SessionRow[] = Array.from({ length: 8 }, (_, i): SessionRow => {
    const started = shift(i * (random() < 0.5 ? 1 : 2))
    started.setHours(between(7, 22), between(0, 59), 0, 0)
    const count = between(2, 9)
    return {
      id: `demo-${user.userId.slice(0, 8)}-${i}`,
      startedAt: started.toISOString(),
      durationSec: between(25, 420),
      screens: between(1, 6),
      platform: pick(['ios', 'android']),
      appVersion: pick(['0.8.4', '0.8.3', '0.9.0']),
      events: Array.from({ length: count }, (_, k) => {
        const at = new Date(started.getTime() + k * between(4, 60) * 1000)
        const name = k === 0 ? 'app_open' : pick(eventNames)
        return {
          name,
          at: at.toISOString(),
          props: name === 'screen_view' ? { screen: pick(Object.keys(SCREEN_LABELS)) } : {},
        }
      }),
    }
  }).sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  const questTitles: [string, string, string, number][] = [
    ['ilk-afiyet-gunu', 'İlk afiyet günü', '🌱', 1],
    ['yedi-afiyet-gunu', 'Yedi afiyet günü', '📅', 7],
    ['on-farkli-besin', 'Sofranda on farklı besin', '🥗', 10],
    ['ilk-grup', 'İlk grubun', '🤝', 1],
    ['on-selam', 'On afiyet selamı', '👋', 10],
    ['bes-yemek-ogret', 'Beş yemek öğret', '🍲', 5],
  ]
  const quests: QuestState[] = questTitles.map(([key, title, emoji, target]) => {
    const progress = Math.min(target, Math.round(random() * target * 1.3))
    const done = progress >= target
    return {
      key, title, emoji, target, progress,
      completedAt: done ? shift(between(1, 40)).toISOString() : null,
      claimedAt: done && random() < 0.7 ? shift(between(0, 30)).toISOString() : null,
    }
  })

  const totalXp = between(40, 2600)
  const level = Math.max(1, Math.floor(Math.sqrt(totalXp / 40)))

  return {
    profile: {
      userId: user.userId,
      email: user.email,
      username: user.displayName ? user.displayName.toLocaleLowerCase('tr').replace(/\s+/g, '') : null,
      displayName: user.displayName,
      emoji: user.emoji,
      sex: pick(['kadin', 'erkek', null]),
      birthDate: `${String(1970 + between(0, 35))}-${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}`,
      heightCm: 155 + between(0, 35),
      activityLevel: pick(['hareketsiz', 'az', 'orta', 'aktif', 'cok_aktif']),
      sports: random() < 0.5 ? [pick(['yuruyus', 'kosu', 'pilates', 'yuzme', 'agirlik'])] : [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      onboardedAt: random() < 0.85 ? user.createdAt : null,
      notificationsReadAt: shift(between(0, 12)).toISOString(),
    },
    usage: {
      mealCount: user.mealCount,
      customFoodCount: user.customFoodCount,
      measurementCount: user.measurementCount,
      waterDays: water.filter((day) => day.glasses > 0).length,
      greetingsSent: between(0, 40),
      greetingsReceived: between(0, 40),
      afiyetDays: days.filter((day) => day.afiyet).length,
      afiyetWeeks: rhythm.filter((week) => week.days >= week.goal).length,
      currentStreak: (() => {
        let streak = 0
        for (let i = days.length - 1; i >= 0 && days[i].afiyet; i -= 1) streak += 1
        return streak
      })(),
      longestStreak: (() => {
        let best = 0
        let run = 0
        days.forEach((day) => {
          run = day.afiyet ? run + 1 : 0
          best = Math.max(best, run)
        })
        return best
      })(),
      activeDays30: days.slice(-30).filter((day) => day.afiyet).length,
      lastActivityAt: user.lastActivityAt,
    },
    habits: { days, mealsByHour, mealsByType, groupCoverage, topFoods, water, measurements, rhythm },
    sessions: {
      summary: {
        total30d,
        perWeek: Number((total30d / 4.3).toFixed(1)),
        avgDurationSec: total30d ? Math.round(totalSec / total30d) : 0,
        medianScreens: between(2, 6),
        lastSessionAt: recent[0]?.startedAt ?? null,
        fromNotification: Number(random().toFixed(2)) * 0.4,
      },
      daily, byHour: mealsByHour.map((row) => ({ hour: row.hour, count: Math.round(row.count * 1.4) })),
      screens, recent,
    },
    gamification: {
      progress: {
        level, title: level >= 20 ? 'Sofra Ustası' : level >= 10 ? 'Sofra Dostu' : level >= 5 ? 'Denge Yolcusu' : 'Yeni Sofra',
        totalXp, xpIntoLevel: between(0, 120), xpForLevel: 140, xpToNext: between(10, 140),
        ratio: Number(random().toFixed(2)), levelsToNextTitle: between(0, 5),
      },
      xpBySource: Object.keys(XP_SOURCE_LABELS).map((key) => ({
        key, label: label.xpSource(key), count: between(0, 400),
      })).sort((a, b) => b.count - a.count),
      recentXp: Array.from({ length: 10 }, (_, i) => {
        const source = pick(Object.keys(XP_SOURCE_LABELS))
        return {
          source, amount: between(1, 60), occurredOn: iso(shift(i)),
          dedupeKey: `${source}:${iso(shift(i))}`, createdAt: shift(i).toISOString(),
        }
      }),
      quests,
      league: random() < 0.7
        ? {
            tier: pick(['tuz', 'nane', 'kekik', 'sumak', 'safran']),
            seat: between(1, 4), points: between(0, 320), rank: between(1, 25),
            members: 25, seasonStart: iso(shift(new Date().getDate() - 1)),
          }
        : null,
    },
    social: {
      groups: random() < 0.6
        ? [{
            groupId: `demo-group-${user.userId.slice(0, 6)}`,
            name: pick(['Ev sofrası', 'Ofis masası', 'Kuzenler', 'Sabah yürüyüşü']),
            role: random() < 0.4 ? 'owner' : 'member',
            members: between(2, 9),
            joinedAt: shift(between(10, 120)).toISOString(),
            sofraVisible: random() < 0.85,
          }]
        : [],
      friends: between(0, 12),
    },
    notifications: {
      devices: Array.from({ length: between(1, 2) }, () => ({
        platform: pick(['ios', 'android']),
        appVersion: pick(['0.8.4', '0.8.3']),
        enabled: random() < 0.85,
        lastSeenAt: shift(between(0, 9)).toISOString(),
      })),
      preferences: {
        mealReminderEnabled: random() < 0.8,
        mealReminderTime: '19:30',
        weekClosureEnabled: random() < 0.9,
        socialEnabled: random() < 0.75,
        timezone: 'Europe/Istanbul',
        quietStart: '22:00',
        quietEnd: '09:00',
      },
      recent: Array.from({ length: 6 }, (_, i) => ({
        kind: pick(['meal_reminder', 'week_closure', 'greeting', 'friend_request']),
        title: pick(['Bugün ne yedin?', 'Haftan kapandı', 'Sana afiyet olsun dediler', 'Yeni arkadaşlık isteği']),
        status: random() < 0.9 ? 'sent' : 'failed',
        sentAt: shift(i * 2).toISOString(),
        error: null,
      })),
      sent30d: between(4, 30),
      failed30d: between(0, 3),
    },
    audit: [],
  }
}
