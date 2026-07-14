/**
 * Büyüme paneli (Faz 1) veri sözleşmesi.
 *
 * Bu tipler ileride Go backend'in `GET /v1/admin/growth` yanıtına BİREBİR
 * oturacak şekilde tasarlandı. Şimdilik `mockGrowth()` mock üretir; onay sonrası
 * gerçek uç yazılıp `adminApi.growth()` buraya eklenecek ve view'daki mock
 * import'u onunla değişecek. Tüm okuma KOHORT/TREND düzeyinde — kişi-bazlı
 * gözetleme yok (bkz. afiet-mobile/docs/feature-list/event-altyapisi.md).
 */

export type TrendPoint = { label: string; value: number }
export type FunnelStep = { key: string; label: string; value: number; hint: string }
export type RetentionRow = { key: 'd1' | 'd7' | 'd30'; label: string; days: number; rate: number; cohort: number }
export type SourceRow = { source: string; count: number }
export type DistRow = { bucket: string; users: number }
export type MealTypeRow = { meal: string; label: string; count: number }
export type EventStat = { key: string; label: string; value: number | null; unit?: string; live: boolean }

export type GrowthData = {
  generatedAt: string
  /** false → ekranda "mock veri" rozeti gösterilir (gerçek uç bağlanınca true). */
  live: boolean
  growth: {
    totalUsers: number
    newToday: number
    new7d: number
    new30d: number
    weeklyTrend: TrendPoint[]
    waitlistTotal: number
    waitlistSources: SourceRow[]
    /** false → UTM/ülke/dil kayıt anında toplanmıyor (henüz alan yok). */
    acquisitionTracked: boolean
  }
  /** Kayıt → ilk öğün (aktivasyon) → 3+ aktif gün → gruba katıldı. */
  funnel: FunnelStep[]
  retention: RetentionRow[]
  habit: {
    dau: number
    wau: number
    avgRhythmDays: number
    activeDayDistribution: DistRow[]
    mealTypes: MealTypeRow[]
  }
  sofra: {
    instrumented: number
    dictionaryTotal: number
    stats: EventStat[]
  }
}

// ── MOCK ─────────────────────────────────────────────────────────────────────
// Erken-aşama bir alışkanlık uygulaması için gerçekçi büyüklükler. Değerler
// yalnız yerleşimi/okunabilirliği görmek için; hiçbiri gerçek veri değildir.
export function mockGrowth(): GrowthData {
  return {
    generatedAt: '2026-07-14T09:00:00Z',
    live: false,
    growth: {
      totalUsers: 342,
      newToday: 6,
      new7d: 28,
      new30d: 96,
      weeklyTrend: [
        { label: '19 May', value: 12 },
        { label: '26 May', value: 18 },
        { label: '2 Haz', value: 15 },
        { label: '9 Haz', value: 22 },
        { label: '16 Haz', value: 19 },
        { label: '23 Haz', value: 26 },
        { label: '30 Haz', value: 24 },
        { label: '7 Tem', value: 28 },
      ],
      waitlistTotal: 512,
      waitlistSources: [
        { source: 'landing', count: 470 },
        { source: 'twitter', count: 28 },
        { source: 'instagram', count: 14 },
      ],
      acquisitionTracked: false,
    },
    funnel: [
      { key: 'registered', label: 'Kayıt oldu', value: 342, hint: 'Stack Auth profili' },
      { key: 'first_meal', label: 'İlk öğününü girdi', value: 247, hint: 'aktivasyon — ilk meal_entries' },
      { key: 'repeat', label: '3+ gün aktif', value: 138, hint: 'alışkanlık sinyali' },
      { key: 'group', label: 'Gruba katıldı', value: 61, hint: 'Soframız (group_members)' },
    ],
    retention: [
      { key: 'd1', label: 'D1', days: 1, rate: 42, cohort: 96 },
      { key: 'd7', label: 'D7', days: 7, rate: 28, cohort: 210 },
      { key: 'd30', label: 'D30', days: 30, rate: 19, cohort: 168 },
    ],
    habit: {
      dau: 89,
      wau: 187,
      avgRhythmDays: 3.4,
      activeDayDistribution: [
        { bucket: '1 gün', users: 82 },
        { bucket: '2–6 gün', users: 124 },
        { bucket: '7+ gün', users: 41 },
      ],
      mealTypes: [
        { meal: 'kahvalti', label: 'Kahvaltı', count: 1840 },
        { meal: 'ogle', label: 'Öğle', count: 1310 },
        { meal: 'aksam', label: 'Akşam', count: 1405 },
        { meal: 'ara', label: 'Ara', count: 290 },
      ],
    },
    sofra: {
      instrumented: 1,
      dictionaryTotal: 12,
      stats: [
        { key: 'afi_celebration_shown', label: 'Afi kutlaması gösterildi', value: 214, unit: '/7g', live: true },
        { key: 'afiyet_day_completed', label: 'Afiyet günü tamamlandı', value: null, live: false },
        { key: 'move_done', label: 'Hamle yapıldı', value: null, live: false },
        { key: 'nudge_acted', label: 'Nudge’a aksiyon', value: null, live: false },
        { key: 'week_summary_opened', label: 'Hafta özeti açıldı', value: null, live: false },
        { key: 'pause_started', label: 'Mola başlatıldı (guardrail)', value: null, live: false },
      ],
    },
  }
}
