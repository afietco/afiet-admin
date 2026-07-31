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
    /** Aralıktaki beta başvurusu. */
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

// ── Instagram (kaynak: içerik ölçümleri; afiet-web content_metrics aynası) ──

export type InstagramPost = {
  itemId: number
  title: string
  format: string
  publishedAt: string | null
  /** Son anlık görüntünün tarihi; tablodaki sayılar o günün ömür toplamıdır. */
  measuredAt: string
  views: number
  reach: number
  likes: number
  comments: number
  saved: number
  shares: number
}
export type InstagramData = {
  generatedAt: string
  live: boolean
  range: Range
  totals: { views: number; reach: number; interactions: number; posts: number }
  series: { date: string; views: number; reach: number }[]
  posts: InstagramPost[]
}

// ── Mağaza (elle/CSV; afiet-web store_metrics aynası) ───────────────────────

export type StorePlatform = 'ios' | 'android'
export type StoreEntry = {
  id: number
  metricDate: string
  platform: StorePlatform
  downloads: number
  pageViews: number | null
  note: string
  source: 'elle' | 'csv'
}
export type StoreEntryInput = Omit<StoreEntry, 'id'>
export type StoreData = {
  generatedAt: string
  live: boolean
  range: Range
  totals: { ios: number; android: number; pageViews: number; conversionPct: number }
  series: { date: string; ios: number; android: number }[]
  entries: StoreEntry[]
}

// ── Arama performansı (GSC kopyası; afiet-web gsc_daily/gsc_rows aynası) ────

export type GscRow = { key: string; clicks: number; impressions: number; ctr: number; position: number }
export type GscData = {
  generatedAt: string
  live: boolean
  range: Range
  /** false = servis hesabı yapılandırılmamış; panel kurulum yönergesi gösterir. */
  connected: boolean
  lastSyncAt: string | null
  totals: { clicks: number; impressions: number; ctrPct: number; position: number }
  series: { date: string; clicks: number; impressions: number }[]
  queries: GscRow[]
  pages: GscRow[]
}

export const analyticsApi = {
  get: (range: Range) => webRequest<AnalyticsData>(`/api/admin/analytics?range=${range}`),
  instagram: (range: Range) => webRequest<InstagramData>(`/api/admin/analytics/instagram?range=${range}`),
  store: (range: Range) => webRequest<StoreData>(`/api/admin/analytics/store?range=${range}`),
  storePut: (entry: StoreEntryInput, range: Range) =>
    webRequest<StoreData>('/api/admin/analytics/store', { method: 'PUT', body: JSON.stringify({ ...entry, range }) }),
  storeDelete: (id: number, range: Range) =>
    webRequest<StoreData>(`/api/admin/analytics/store?id=${id}&range=${range}`, { method: 'DELETE' }),
  storeImport: (entries: StoreEntryInput[], range: Range) =>
    webRequest<{ yazilan: number; payload: StoreData }>('/api/admin/analytics/store-import', {
      method: 'PUT',
      body: JSON.stringify({ entries, range }),
    }),
  search: (range: Range) => webRequest<GscData>(`/api/admin/analytics/search?range=${range}`),
}

