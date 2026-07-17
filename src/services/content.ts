import { webRequest } from './webApi'

/**
 * İçerik paneli veri sözleşmesi.
 *
 * Bu tipler afiet-web'in `server/utils/contentTypes.ts` dosyasıyla BİREBİR
 * aynıdır (alan eklerken iki ucu birlikte güncelle). Veri `/api/admin/content*`
 * uçlarından canlı gelir. Uç erişilemezse mock ÜRETİLMEZ; boş payload
 * (`emptyContentPayload`) kullanılır ve sayfa placeholder gösterir.
 */

export type Channel = 'blog' | 'instagram' | 'x'
export type ContentStatus = 'fikir' | 'planlandi' | 'uretimde' | 'yayinda' | 'arsiv'

/** İçerik brief'i — "prompt-ready" alanlar. Hepsi opsiyonel doldurulur. */
export type ContentBrief = {
  keywords: string[]
  audience: string
  angle: string
  tone: string
  outline: string[]
  internalLinks: string[]
  cta: string
  sources: string[]
  notes: string
}

export type ContentItem = {
  id: number
  channel: Channel
  title: string
  status: ContentStatus
  /** Yalnız blog kanalı için anlamlı; yazının afiet.co/blog/<slug> yolu. */
  slug: string | null
  brief: ContentBrief
  /** YYYY-MM-DD — hedeflenen yayın günü. */
  plannedDate: string | null
  publishedUrl: string | null
  createdAt: string
  updatedAt: string
}

/** Elle girilen dönemsel ölçüm — aynı (itemId, metricDate) üzerine yazar. */
export type ContentMetric = {
  id: number
  itemId: number
  metricDate: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  notes: string
}

/** afiet.co'da yayınlanmış/taslak blog yazılarının özeti (blog_posts). */
export type BlogPostSummary = {
  slug: string
  title: string
  status: 'taslak' | 'yayinda'
  publishedAt: string | null
  readingMinutes: number | null
  itemId: number | null
  updatedAt: string
}

export type AdminContentPayload = {
  dbConnected: boolean
  /** Canlı uçtan geldi mi? Yalnız gerçek yanıtta true; boş payload'da false (placeholder gösterilir). */
  live: boolean
  items: ContentItem[]
  metrics: ContentMetric[]
  posts: BlogPostSummary[]
}

export type ContentItemInput = {
  id?: number
  channel: Channel
  title: string
  status: ContentStatus
  slug: string | null
  brief: ContentBrief
  plannedDate: string | null
  publishedUrl: string | null
}

export type ContentMetricInput = {
  itemId: number
  metricDate: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  notes: string
}

export const emptyBrief = (): ContentBrief => ({
  keywords: [], audience: '', angle: '', tone: '', outline: [], internalLinks: [], cta: '', sources: [], notes: '',
})

/** Türkçe karakterleri sadeleştirerek URL dostu slug üret. */
export function slugify(value: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (ch) => map[ch] ?? ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

/** Veri gelene kadarki / uç erişilemediğindeki boş durum (mock değil). */
export const emptyContentPayload = (): AdminContentPayload => ({
  dbConnected: false, live: false, items: [], metrics: [], posts: [],
})

export const contentApi = {
  get: () => webRequest<AdminContentPayload>('/api/admin/content'),
  putItem: (item: ContentItemInput) =>
    webRequest<AdminContentPayload>('/api/admin/content/item', { method: 'PUT', body: JSON.stringify(item) }),
  deleteItem: (id: number) =>
    webRequest<AdminContentPayload>(`/api/admin/content/item?id=${id}`, { method: 'DELETE' }),
  putMetric: (metric: ContentMetricInput) =>
    webRequest<AdminContentPayload>('/api/admin/content/metric', { method: 'PUT', body: JSON.stringify(metric) }),
  deleteMetric: (id: number) =>
    webRequest<AdminContentPayload>(`/api/admin/content/metric?id=${id}`, { method: 'DELETE' }),
}
