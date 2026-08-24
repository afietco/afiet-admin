import { webRequest, webRequestText } from './webApi'

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
/** utm_content (kreatif) satırı: ziyaret + o kreatiften gelen ziyaretçilerin web dönüşümleri (son giriş). */
export type ContentRow = { value: string; visits: number; magaza: number; bulten: number }
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
    /**
    * İki dönüşüm AYRI durur (kullanıcı kararı, 25 Ağu 2026); afiet-web'in
    * `server/utils/analyticsReport.ts` tipinin aynasıdır, biri değişirse ikisi
    * birlikte değişir.
    *
    * Beta başvurusu 24 Ağu'da emekli oldu ve tek bir `conversions` alanı
    * kalmıştı; o alan bugünden sonra sonsuza kadar 0 okuyacaktı.
    *
    * Mağaza tıklaması ürünün asıl dönüşümüdür ama ÇEREZ ONAYININ ARKASINDADIR,
    * yani gerçek sayı gösterilenden yüksektir. Bülten kaydı sunucu tarafında
    * düşer ve onaya bağlı değildir, bu yüzden ücretli trafiğin daha güvenilir
    * sayacıdır. İkisi tek sayıya toplanırsa bu fark gizlenir.
    */
    storeClicks: number
    /** storeClicks / visitors (%). */
    storeClickRate: number
    newsletter: number
    /** newsletter / visitors (%). */
    newsletterRate: number
    deltaViews: number
    deltaVisitors: number
  }
  series: SeriesPoint[]
  topPages: PageRow[]
  blog: BlogRow[]
  channels: ChannelRow[]
  referrers: SourceRow[]
  utm: { source: UtmRow[]; medium: UtmRow[]; campaign: UtmRow[]; term: UtmRow[]; content: ContentRow[] }
  /** Web dönüşümleri: mağaza tıklaması (mağazaya göre), bülten kaydı; reklam tıklama kimliğiyle eşlenen pay. */
  webConversions: { magazaPlay: number; magazaAppstore: number; bulten: number; withClickId: number }
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

// ── Mağaza (afiet-web store_metrics aynası) ─────────────────────────────────
// Kaynak üç yerden gelir: 'elle' (panelden), 'csv' (mağaza dışa aktarımı),
// 'api' (App Store Connect senkronu, her sabah 07:30). API elle girilmiş bir
// günü EZMEZ, kural afiet-web'in store'unda.

export type StorePlatform = 'ios' | 'android'
export type StoreSource = 'elle' | 'csv' | 'api'
export type StoreEntry = {
  id: number
  metricDate: string
  platform: StorePlatform
  downloads: number
  pageViews: number | null
  /** Mağaza gösterimi; yalnız API ölçer, elle girişte null. */
  impressions: number | null
  note: string
  source: StoreSource
}
export type StoreEntryInput = Omit<StoreEntry, 'id'>
/** Apple'ın kaynak türü kırılımı; `sourceType` HAM etikettir ("App Store Search"). */
export type StoreTrafficSource = { sourceType: string; impressions: number; pageViews: number }
export type StoreData = {
  generatedAt: string
  live: boolean
  range: Range
  totals: { ios: number; android: number; pageViews: number; impressions: number; conversionPct: number }
  series: { date: string; ios: number; android: number }[]
  entries: StoreEntry[]
  trafficSources: StoreTrafficSource[]
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

/**
 * AI tarayıcı erişim kaydı (afiet-web `ai_bot_hits`). Alan adları uçla BİREBİR
 * aynadır (`server/api/admin/ai-bots.get.ts`), Türkçe olmaları oradan gelir.
 *
 * `kapsam` bilerek verinin yanında taşınır: sayfa bazlı sayılar ISR cache'i
 * yüzünden ALT SINIRDIR ve bu uyarı ekranda görünmezse tablolar "demek ki az
 * geliyor" diye yanlış okunur.
 */
export type AiBotRow = {
  bot: string
  sahip: string | null
  amac: 'arama' | 'egitim' | 'kullanici' | null
  istek: number
  ilk: string
  son: string
  ok: number
  bulunamadi: number
  kisitlandi: number
  sunucuHatasi: number
}

export type AiBotData = {
  generatedAt: string
  range: Range
  toplam: number
  botlar: AiBotRow[]
  gunluk: { gun: string; bot: string; istek: number }[]
  yollar: { path: string; istek: number; bot_sayisi: number }[]
  nabiz: { path: string; istek: number; bot_sayisi: number }[]
  sonHatalar: { ts: string; bot: string; path: string; status: number }[]
  kapsam: { tamKapsananYollar: string[]; nabizYollari: string[]; not: string }
}

/**
 * buyur.afiet.co funnel sayfası (afiet-web `GET /api/admin/analytics/buyur`).
 *
 * ÖLÇÜM ÇEREZSİZ: o sayfada ziyaretçi kimliği yok. Bu yüzden burada "tekil
 * ziyaretçi" alanı da YOKTUR ve panelde öyle bir sayı gösterilmez; soru
 * "kaç kişi" değil, "kaç görüntüleme, hangi bağlantıya kaç tık".
 *
 * `live: false` = `buyur_events` tablosu henüz hiç yok, yani sayfa tek bir
 * ziyaret bile almamış. Bağlantı hatasından ayrı bir durumdur.
 */
export type BuyurGrup = 'magaza' | 'icerik' | 'sosyal' | 'diger'

export type BuyurData = {
  generatedAt: string
  live: boolean
  range: Range
  totals: { goruntuleme: number; tik: number; tikOrani: number; deltaGoruntuleme: number; deltaTik: number }
  seri: { gun: string; goruntuleme: number; tik: number }[]
  baglantilar: { anahtar: string; etiket: string; grup: BuyurGrup; tik: number; pay: number }[]
  gruplar: { grup: BuyurGrup; label: string; tik: number }[]
  cihazlar: { key: string; label: string; sayi: number }[]
  isletimSistemleri: { key: string; label: string; sayi: number }[]
  ulkeler: { key: string; label: string; sayi: number }[]
  kaynaklar: { host: string; label: string; sayi: number }[]
}

export const analyticsApi = {
  get: (range: Range) => webRequest<AnalyticsData>(`/api/admin/analytics?range=${range}`),
  aiBots: (range: Range) => webRequest<AiBotData>(`/api/admin/ai-bots?range=${range}`),
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
  buyur: (range: Range) => webRequest<BuyurData>(`/api/admin/analytics/buyur?range=${range}`),
  search: (range: Range) => webRequest<GscData>(`/api/admin/analytics/search?range=${range}`),
  /** Google Ads offline conversion CSV'si (metin); panel dosya olarak indirtir. */
  adsConversionsCsv: (range: Range) => webRequestText(`/api/admin/analytics/ads-conversions?range=${range}`),
}

