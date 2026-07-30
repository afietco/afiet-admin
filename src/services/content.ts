import { webRequest } from './webApi'

/**
 * İçerik takvimi veri sözleşmesi.
 *
 * Bu tipler afiet-web'in `server/utils/contentTypes.ts` dosyasıyla BİREBİR
 * aynıdır (alan eklerken iki ucu birlikte güncelle). Veri `/api/admin/content*`
 * uçlarından canlı gelir. Uç erişilemezse mock ÜRETİLMEZ; boş payload
 * (`emptyContentPayload`) kullanılır ve sayfa placeholder gösterir.
 *
 * İSİMLENDİRME: `channel` alanı UI'da "platform" olarak görünür (DB kolonu
 * tarihsel olarak channel kaldı). İkinci eksen `format`tır.
 */

export type Channel = 'blog' | 'instagram' | 'x' | 'tiktok' | 'youtube'
export type ContentFormat = 'yazi' | 'reel' | 'carousel' | 'story' | 'post' | 'shorts' | 'video'
export type ContentStatus = 'fikir' | 'planlandi' | 'uretimde' | 'yayinda' | 'arsiv'
export type MetricSource = 'elle' | 'csv' | 'instagram' | 'youtube' | 'tiktok' | 'x'
export type AttachmentStatus = 'bekliyor' | 'hazir'
export type AttachmentKind = 'video' | 'gorsel' | 'pdf'

/** Hangi platformda hangi biçimler anlamlı - web tarafı da aynı listeyi doğrular. */
export const FORMATS_BY_CHANNEL: Record<Channel, ContentFormat[]> = {
  blog: ['yazi'],
  instagram: ['reel', 'carousel', 'story', 'post'],
  x: ['post', 'video'],
  tiktok: ['video'],
  youtube: ['shorts', 'video'],
}

/** İçerik brief'i - "prompt-ready" alanlar. Hepsi opsiyonel doldurulur. */
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

export type ContentMusic = { title: string; artist: string; license: string; url: string }

export type ContentItem = {
  id: number
  channel: Channel
  format: ContentFormat
  title: string
  status: ContentStatus
  /** Yalnız blog kanalı için anlamlı; yazının afiet.co/blog/<slug> yolu. */
  slug: string | null
  brief: ContentBrief
  /** Takvimdeki an (ISO). Tüm-gün ise saat anlamsızdır. */
  plannedAt: string | null
  allDay: boolean
  /** plannedAt'in İstanbul günü (YYYY-MM-DD) - sunucu türetir, salt okunur. */
  plannedDate: string | null
  publishedUrl: string | null
  caption: string
  hashtags: string[]
  firstComment: string
  hook: string
  series: string
  seriesCode: string
  altText: string
  captionsReady: boolean
  music: ContentMusic
  platformPostId: string | null
  createdAt: string
  updatedAt: string
}

/** Elle girilen dönemsel ölçüm - aynı (itemId, metricDate) üzerine yazar. */
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
  /** Platformdan gelen tekil erişim (elle girişte 0). */
  reach: number
  /** Platformun "total_interactions" karşılığı (elle girişte 0). */
  interactions: number
  notes: string
  source: MetricSource
}

export type ContentAttachment = {
  id: number
  itemId: number
  fileName: string
  mime: string
  kind: AttachmentKind
  sizeBytes: number
  status: AttachmentStatus
  objectKey: string
  createdAt: string
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
  /** Canlı uçtan geldi mi? Boş payload'da false (placeholder gösterilir). */
  live: boolean
  /** Ek yükleme/indirme açık mı (web tarafında GCS anahtarı var mı). */
  storageReady: boolean
  items: ContentItem[]
  metrics: ContentMetric[]
  attachments: ContentAttachment[]
  posts: BlogPostSummary[]
}

export type ContentItemInput = Omit<ContentItem, 'id' | 'plannedDate' | 'createdAt' | 'updatedAt'> & { id?: number }

export type ContentMetricInput = Omit<ContentMetric, 'id'>

export type AttachmentUploadTicket = {
  attachmentId: number
  objectKey: string
  uploadUrl: string
  expiresIn: number
  contentType: string
}

export const emptyBrief = (): ContentBrief => ({
  keywords: [], audience: '', angle: '', tone: '', outline: [], internalLinks: [], cta: '', sources: [], notes: '',
})

export const emptyMusic = (): ContentMusic => ({ title: '', artist: '', license: '', url: '' })

// ── Ek dosya kuralları (web tarafındaki contentTypes.ts ile aynı) ────────────
export const ATTACHMENT_MAX_BYTES = 200 * 1024 * 1024
export const ATTACHMENT_MAX_PER_ITEM = 20
/** Dosya seçicinin accept listesi ve tür eşlemesi. */
export const ALLOWED_MIME: Record<string, { kind: AttachmentKind; ext: string[] }> = {
  'video/mp4': { kind: 'video', ext: ['mp4'] },
  'video/quicktime': { kind: 'video', ext: ['mov'] },
  'image/png': { kind: 'gorsel', ext: ['png'] },
  'image/jpeg': { kind: 'gorsel', ext: ['jpg', 'jpeg'] },
  'image/webp': { kind: 'gorsel', ext: ['webp'] },
  'image/gif': { kind: 'gorsel', ext: ['gif'] },
  'application/pdf': { kind: 'pdf', ext: ['pdf'] },
}
export const ACCEPT_ATTR = Object.keys(ALLOWED_MIME).join(',')

/**
 * Tarayıcının verdiği tür güvenilmez olabilir (özellikle .mov ve bazı .mp4'ler
 * boş `type` gelir): uzantıdan da türetip listeyle karşılaştırırız.
 */
export function mimeForFile(file: File): string | null {
  if (ALLOWED_MIME[file.type]) return file.type
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  const found = Object.entries(ALLOWED_MIME).find(([, v]) => v.ext.includes(ext))
  return found ? found[0] : null
}

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
  dbConnected: false, live: false, storageReady: false, items: [], metrics: [], attachments: [], posts: [],
})

export const contentApi = {
  get: () => webRequest<AdminContentPayload>('/api/admin/content'),
  putItem: (item: ContentItemInput) =>
    webRequest<AdminContentPayload>('/api/admin/content/item', { method: 'PUT', body: JSON.stringify(item) }),
  deleteItem: (id: number) =>
    webRequest<AdminContentPayload>(`/api/admin/content/item?id=${id}`, { method: 'DELETE' }),
  /** Sürükle-bırak: yalnız zaman taşınır, diğer alanlara dokunulmaz. */
  move: (id: number, plannedAt: string, allDay: boolean) =>
    webRequest<AdminContentPayload>('/api/admin/content/move', {
      method: 'PUT',
      body: JSON.stringify({ id, plannedAt, allDay }),
    }),
  putMetric: (metric: ContentMetricInput) =>
    webRequest<AdminContentPayload>('/api/admin/content/metric', { method: 'PUT', body: JSON.stringify(metric) }),
  deleteMetric: (id: number) =>
    webRequest<AdminContentPayload>(`/api/admin/content/metric?id=${id}`, { method: 'DELETE' }),
  /** Dosyadan gelen ölçümleri tek istekte yazar (panelde eşleştirilmiş satırlar). */
  importMetrics: (metrics: ContentMetricInput[]) =>
    webRequest<{ yazilan: number; payload: AdminContentPayload }>('/api/admin/content/metrics-import', {
      method: 'PUT',
      body: JSON.stringify({ metrics }),
    }),
  // ── Ekler: bilet al → doğrudan kovaya PUT → doğrula ───────────────────────
  ticket: (input: { itemId: number; fileName: string; mime: string; sizeBytes: number }) =>
    webRequest<AttachmentUploadTicket>('/api/admin/content/attachment', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  confirmAttachment: (id: number) =>
    webRequest<AdminContentPayload>('/api/admin/content/attachment', { method: 'PUT', body: JSON.stringify({ id }) }),
  deleteAttachment: (id: number) =>
    webRequest<AdminContentPayload>(`/api/admin/content/attachment?id=${id}`, { method: 'DELETE' }),
  attachmentUrl: (id: number, mod: 'indir' | 'onizleme') =>
    webRequest<{ url: string; expiresIn: number; fileName: string; mime: string }>(
      `/api/admin/content/attachment-url?id=${id}&mod=${mod}`,
    ),
}

/**
 * Dosyayı imzalı URL ile DOĞRUDAN kovaya yükler (sunucudan geçmez; Vercel'in
 * ~4.5MB gövde sınırı reel videolarını taşımaz). İlerleme yüzdesi için XHR
 * kullanılır - fetch upload progress vermiyor.
 */
export function uploadToBucket(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Kovaya yüklenemedi (${xhr.status}). ${xhr.responseText.slice(0, 200)}`))
    xhr.onerror = () => reject(new Error('Yükleme sırasında ağ hatası. Bağlantını kontrol et.'))
    xhr.ontimeout = () => reject(new Error('Yükleme zaman aşımına uğradı.'))
    xhr.send(file)
  })
}
