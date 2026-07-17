/**
 * Büyüme paneli veri sözleşmesi.
 *
 * Bu tipler Go backend'in `GET /v1/admin/growth` yanıtıyla BİREBİR aynıdır;
 * veri `adminApi.growth()` ile canlı uçtan gelir. Uç erişilemezse view mock
 * ÜRETMEZ, boş/placeholder durum gösterir. Tüm okuma KOHORT/TREND düzeyinde:
 * kişi-bazlı gözetleme yok (bkz. afiet-mobile/docs/feature-list/event-altyapisi.md).
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
  /** Canlı uçtan geldi mi? Backend gerçek yanıtta true döner; view erişemezse veri null kalır. */
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
