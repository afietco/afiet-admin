import { webRequest } from './webApi'

/**
 * Web analitiği (afiet.co) veri sözleşmesi.
 *
 * Veri afiet-web'in (Nuxt/Nitro + Neon) `GET /api/admin/analytics` ucundan
 * canlı gelir; toplama birinci-taraf beacon (`POST /api/track`) ile yapılır. Tüm
 * okuma TOPLU/kohort düzeyinde: kişi-bazlı gözetleme yok. Uç erişilemezse mock
 * ÜRETİLMEZ; `data` null kalır ve sayfa placeholder gösterir.
 */

export type Range = '7d' | '30d' | '90d'
export const RANGES: { value: Range; label: string; days: number }[] = [
  { value: '7d', label: '7 gün', days: 7 },
  { value: '30d', label: '30 gün', days: 30 },
  { value: '90d', label: '90 gün', days: 90 },
]

export type SeriesPoint = { date: string; views: number; visitors: number }
export type PageRow = { path: string; title: string; views: number; visitors: number; avgSeconds: number }
export type BlogRow = { slug: string; title: string; views: number; visitors: number; avgReadSeconds: number; publishedAt: string | null }
export type ChannelKey = 'direct' | 'search' | 'social' | 'referral' | 'campaign'
export type ChannelRow = { key: ChannelKey; label: string; visits: number }
export type SourceRow = { source: string; visits: number }
export type UtmRow = { value: string; visits: number }
export type BreakdownRow = { key: string; label: string; visits: number }

export type AnalyticsData = {
  generatedAt: string
  /** true → canlı uçtan; false → boş/placeholder. */
  live: boolean
  range: Range
  totals: {
    views: number
    visitors: number
    viewsPerVisit: number
    /** Ortalama oturum süresi (sn). */
    avgDuration: number
    /** Aralıktaki waitlist kaydı. */
    conversions: number
    /** conversions / visitors (%). */
    conversionRate: number
    deltaViews: number
    deltaVisitors: number
  }
  series: SeriesPoint[]
  topPages: PageRow[]
  blog: BlogRow[]
  channels: ChannelRow[]
  referrers: SourceRow[]
  utm: { source: UtmRow[]; medium: UtmRow[]; campaign: UtmRow[] }
  devices: BreakdownRow[]
  browsers: BreakdownRow[]
  countries: BreakdownRow[]
}

export const analyticsApi = {
  get: (range: Range) => webRequest<AnalyticsData>(`/api/admin/analytics?range=${range}`),
}

