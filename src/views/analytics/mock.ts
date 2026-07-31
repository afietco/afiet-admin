import { RANGES, type Range } from '../../services/analytics'

/**
 * ÖNİZLEME VERİSİ - UI onay fazı (çalışma akışı: önce UI, onay, sonra backend).
 * Buradaki tipler afiet-web'de açılacak uçların birebir taslağıdır; uçlar
 * bağlandığında bu dosya SİLİNİR, tipler servis katmanına taşınır.
 * Üretim deterministiktir (Math.random yok): ekran görüntüleri stabil kalır.
 */

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function dayList(days: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function rangeDays(range: Range): number {
  return RANGES.find((r) => r.value === range)?.days ?? 30
}

// ── Instagram ────────────────────────────────────────────────────────────────
// Gerçek kaynak: afiet-web `content_metrics` (source: elle/csv/instagram) +
// `social_posts`. Meta app onayı gelince günlük cron otomatik doldurur.

export type InstagramDaily = { date: string; views: number; reach: number }
export type InstagramPost = {
  title: string
  format: 'reel' | 'carousel' | 'story' | 'post'
  publishedAt: string
  views: number
  reach: number
  likes: number
  comments: number
  saved: number
  shares: number
}
export type InstagramData = {
  totals: { views: number; reach: number; interactions: number; posts: number }
  series: InstagramDaily[]
  posts: InstagramPost[]
}

export function instagramMock(range: Range): InstagramData {
  const rnd = seeded(11)
  const series = dayList(rangeDays(range)).map((date, i) => {
    const spike = i % 9 === 4 ? 2.6 : 1 // reel günleri
    const views = Math.round((40 + rnd() * 220) * spike)
    return { date, views, reach: Math.round(views * (0.55 + rnd() * 0.2)) }
  })
  const posts: InstagramPost[] = [
    { title: 'El ölçüsüyle porsiyon: avuç, kase, dilim', format: 'reel', publishedAt: '2026-07-24', views: 1840, reach: 1210, likes: 96, comments: 14, saved: 41, shares: 22 },
    { title: 'Sofrada denge: tabağın yarısı sebze', format: 'carousel', publishedAt: '2026-07-19', views: 620, reach: 480, likes: 44, comments: 6, saved: 19, shares: 5 },
    { title: 'afiet beta açıldı 🎉', format: 'post', publishedAt: '2026-07-12', views: 415, reach: 350, likes: 38, comments: 9, saved: 7, shares: 11 },
    { title: 'Kahvaltıda tek kase kuralı', format: 'story', publishedAt: '2026-07-27', views: 210, reach: 198, likes: 12, comments: 0, saved: 0, shares: 2 },
  ]
  const views = series.reduce((s, p) => s + p.views, 0)
  const reach = series.reduce((s, p) => s + p.reach, 0)
  const interactions = posts.reduce((s, p) => s + p.likes + p.comments + p.saved + p.shares, 0)
  return { totals: { views, reach, interactions, posts: posts.length }, series, posts }
}

// ── Mağaza (App Store / Google Play) ─────────────────────────────────────────
// Karar (31 Tem): şimdilik elle/CSV girişi; mağaza yayını sonrası App Store
// Connect + Play API'leri ayrı fazda bağlanır.

export type StoreEntry = {
  date: string
  platform: 'ios' | 'android'
  downloads: number
  pageViews: number | null
  note: string | null
  source: 'elle' | 'csv'
}
export type StoreData = {
  totals: { ios: number; android: number; pageViews: number; conversionPct: number }
  series: { date: string; ios: number; android: number }[]
  entries: StoreEntry[]
}

export function storeMock(range: Range): StoreData {
  const rnd = seeded(23)
  const series = dayList(rangeDays(range)).map((date, i) => ({
    date,
    ios: Math.round(rnd() * 4 + (i % 7 === 5 ? 3 : 0)), // TestFlight dalgası
    android: 0, // Play'e henüz yüklenmedi
  }))
  const entries: StoreEntry[] = [
    { date: '2026-07-29', platform: 'ios', downloads: 6, pageViews: 31, note: 'Beta davet maili gönderildi', source: 'elle' },
    { date: '2026-07-22', platform: 'ios', downloads: 2, pageViews: 12, note: null, source: 'elle' },
    { date: '2026-07-15', platform: 'ios', downloads: 1, pageViews: 8, note: null, source: 'elle' },
  ]
  const ios = series.reduce((s, p) => s + p.ios, 0)
  // Dönüşüm yalnız sayfa görüntülemesi BİLİNEN kayıtlardan hesaplanır; tüm
  // seri indirmesini 3 kaydın görüntülemesine bölmek %100'ü aşan saçma oran verir.
  const withViews = entries.filter((e) => e.pageViews !== null)
  const pageViews = withViews.reduce((s, e) => s + (e.pageViews ?? 0), 0)
  const downloadsWithViews = withViews.reduce((s, e) => s + e.downloads, 0)
  return {
    totals: { ios, android: 0, pageViews, conversionPct: pageViews > 0 ? Math.round((downloadsWithViews / pageViews) * 100) : 0 },
    series,
    entries,
  }
}

// ── Google Search Console ────────────────────────────────────────────────────
// Karar (31 Tem): servis hesabı + günlük cron (Cloud Scheduler) → Neon.
// Mülk: sc-domain:afiet.co. GSC verisi ~2 gün gecikmeli gelir.

export type GscDaily = { date: string; clicks: number; impressions: number }
export type GscRow = { key: string; clicks: number; impressions: number; ctr: number; position: number }
export type GscData = {
  totals: { clicks: number; impressions: number; ctrPct: number; position: number }
  series: GscDaily[]
  queries: GscRow[]
  pages: GscRow[]
}

export function gscMock(range: Range): GscData {
  const rnd = seeded(37)
  const series = dayList(rangeDays(range)).map((date, i) => {
    const growth = 1 + i / 28 // indeksleme oturdukça yavaş artış
    const impressions = Math.round((14 + rnd() * 60) * growth)
    return { date, impressions, clicks: Math.round(impressions * (0.01 + rnd() * 0.05)) }
  })
  const queries: GscRow[] = [
    { key: 'el ölçüsü porsiyon', clicks: 9, impressions: 210, ctr: 4.3, position: 8.2 },
    { key: 'kalori saymadan kilo verme', clicks: 5, impressions: 480, ctr: 1.0, position: 14.7 },
    { key: 'afiet uygulama', clicks: 4, impressions: 55, ctr: 7.3, position: 2.1 },
    { key: 'porsiyon ölçüleri', clicks: 3, impressions: 320, ctr: 0.9, position: 18.4 },
    { key: 'dengeli beslenme uygulaması', clicks: 2, impressions: 260, ctr: 0.8, position: 21.0 },
  ]
  const pages: GscRow[] = [
    { key: '/blog/porsiyon-olculeri-el-olcusu', clicks: 12, impressions: 640, ctr: 1.9, position: 11.3 },
    { key: '/', clicks: 8, impressions: 410, ctr: 2.0, position: 9.8 },
    { key: '/beta', clicks: 3, impressions: 120, ctr: 2.5, position: 6.4 },
    { key: '/blog', clicks: 1, impressions: 90, ctr: 1.1, position: 16.2 },
  ]
  const clicks = series.reduce((s, p) => s + p.clicks, 0)
  const impressions = series.reduce((s, p) => s + p.impressions, 0)
  return {
    totals: { clicks, impressions, ctrPct: impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0, position: 12.6 },
    series,
    queries,
    pages,
  }
}
