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
/** rate: eylem yaptı (öğün/ölçüm/su) · openRate: uygulamayı açtı (session_start). */
export type RetentionRow = { key: 'd1' | 'd7' | 'd30'; label: string; days: number; rate: number; openRate: number; cohort: number }
export type DistRow = { bucket: string; users: number }
export type MealTypeRow = { meal: string; label: string; count: number }
export type EventStat = { key: string; label: string; value: number | null; unit?: string; live: boolean }
/** Oturum telemetrisi alışkanlık metrikleri; telemetri yayılmadıysa hepsi 0. */
export type SessionStats = {
  dau: number
  wau: number
  avgSessionSec: number
  sessionsPerActive: number
  fromNotificationPct: number
}
/** Ekran/sheet/dokunuş kullanım satırı (son 7 gün); avgSec süresizlerde yok. */
export type UsageRow = { key: string; count: number; avgSec?: number | null }

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
    /** false → UTM/ülke/dil kayıt anında toplanmıyor (henüz alan yok). */
    acquisitionTracked: boolean
  }
  /** Kayıt → ilk ölçüm (aktivasyon) → gruba katıldı → 3+ aktif gün (öğün bazlı). */
  funnel: FunnelStep[]
  retention: RetentionRow[]
  habit: {
    dau: number
    wau: number
    avgRhythmDays: number
    activeDayDistribution: DistRow[]
    mealTypes: MealTypeRow[]
    sessions: SessionStats
  }
  sofra: {
    instrumented: number
    dictionaryTotal: number
    stats: EventStat[]
    topScreens: UsageRow[]
    topSheets: UsageRow[]
    topTaps: UsageRow[]
  }
}
