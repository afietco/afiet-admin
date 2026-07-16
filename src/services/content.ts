import { webRequest } from './webApi'

/**
 * İçerik paneli (Faz A) veri sözleşmesi.
 *
 * Bu tipler ileride afiet-web'in `server/utils/contentTypes.ts` dosyasına
 * BİREBİR oturacak şekilde tasarlandı — alan eklerken iki ucu birlikte güncelle.
 * Şimdilik `mockContent()` mock üretir; Faz B'de web tarafındaki
 * `/api/admin/content*` uçları yazılıp `contentApi` canlıya bağlanacak,
 * mock yalnız uç yok / oturumsuz durumunda devreye girecek.
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
  /** false → ekranda "mock veri" rozeti gösterilir (gerçek uç bağlanınca true). */
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

// ── MOCK ─────────────────────────────────────────────────────────────────────
// Yerleşimi/akışı görmek için gerçekçi Türkçe örnekler; hiçbiri gerçek veri değildir.
export function mockContent(): AdminContentPayload {
  return {
    dbConnected: true,
    live: false,
    items: [
      {
        id: 1, channel: 'blog', title: 'Kalori saymadan dengeli beslenme: dilim, kase, avuç rehberi',
        status: 'uretimde', slug: 'kalori-saymadan-dengeli-beslenme',
        brief: {
          keywords: ['kalori saymadan beslenme', 'dengeli beslenme', 'porsiyon ölçüleri', 'el ölçüsü porsiyon'],
          audience: 'Diyet uygulamalarından yorulmuş, pratik denge arayan 25–45 yaş yetişkinler',
          angle: 'Kalori saymak sürdürülemez; günlük hayattaki doğal ölçüler (dilim, kase, avuç) yeterli ve nazik bir alternatif',
          tone: 'Sıcak, yargısız, bilimsel ama sohbet gibi',
          outline: [
            'Neden kalori saymak çoğu kişide sürmüyor?',
            'Doğal ölçüler: dilim, kase, kaşık, avuç',
            'Tabağı renklerle dengelemek (besin grupları)',
            'Günlük hayatta 3 örnek sofra',
            'Sık sorulanlar',
          ],
          internalLinks: ['/', '/blog'],
          cta: 'afiet ile saymadan dengele — bekleme listesine katıl',
          sources: ['https://www.who.int/news-room/fact-sheets/detail/healthy-diet'],
          notes: 'Uygulamanın dilim/kase/avuç ölçüleriyle birebir örtüşen örnekler ver.',
        },
        plannedDate: '2026-07-18', publishedUrl: null,
        createdAt: '2026-07-10T09:00:00Z', updatedAt: '2026-07-14T14:20:00Z',
      },
      {
        id: 2, channel: 'blog', title: 'Aile sofrasında 5 renk: çocuklarla renkli tabak oyunu',
        status: 'planlandi', slug: 'aile-sofrasinda-5-renk',
        brief: {
          keywords: ['çocuklarda sağlıklı beslenme', 'renkli tabak', 'aile sofrası'],
          audience: 'Küçük çocuklu ebeveynler',
          angle: 'Beslenmeyi kural değil oyun yapmak; renk çeşitliliği = besin çeşitliliği',
          tone: 'Neşeli, pratik',
          outline: ['Renk = besin grubu ilişkisi', '5 renk oyununun kuralları', 'Seçici yiyen çocuklar için ipuçları', 'Sık sorulanlar'],
          internalLinks: ['/blog/kalori-saymadan-dengeli-beslenme'],
          cta: 'Soframız özelliğiyle ailecek dengeleyin',
          sources: [],
          notes: '',
        },
        plannedDate: '2026-07-25', publishedUrl: null,
        createdAt: '2026-07-11T10:00:00Z', updatedAt: '2026-07-12T08:00:00Z',
      },
      {
        id: 3, channel: 'blog', title: 'Afiyet günü nedir? Haftada 5 gün ritmiyle denge',
        status: 'fikir', slug: null,
        brief: { ...emptyBrief(), notes: 'Oyunlaştırma çalışmasındaki "5 afiyet günü/hafta" ritmini anlatan tanıtım yazısı.' },
        plannedDate: null, publishedUrl: null,
        createdAt: '2026-07-13T11:00:00Z', updatedAt: '2026-07-13T11:00:00Z',
      },
      {
        id: 4, channel: 'blog', title: 'Su içmeyi hatırlamanın nazik yolları',
        status: 'yayinda', slug: 'su-icmeyi-hatirlamanin-nazik-yollari',
        brief: {
          keywords: ['su içmeyi unutmak', 'günlük su ihtiyacı', 'su içme alışkanlığı'],
          audience: 'Gün içinde su içmeyi unutan yoğun çalışanlar',
          angle: 'Zorlamadan, ortam tasarımıyla hatırlamak',
          tone: 'Nazik, pratik',
          outline: ['Neden unutuyoruz?', 'Ortam tasarımı önerileri', 'afiet su takibi nasıl çalışır', 'Sık sorulanlar'],
          internalLinks: ['/'],
          cta: 'afiet ile suyu da dengele',
          sources: [],
          notes: '',
        },
        plannedDate: '2026-07-08', publishedUrl: 'https://afiet.co/blog/su-icmeyi-hatirlamanin-nazik-yollari',
        createdAt: '2026-07-01T09:00:00Z', updatedAt: '2026-07-08T09:30:00Z',
      },
      {
        id: 5, channel: 'instagram', title: '5 renk sofra challenge — carousel',
        status: 'planlandi', slug: null,
        brief: {
          keywords: ['renkli tabak', 'challenge'],
          audience: 'IG takipçileri — genç aileler',
          angle: '7 günlük mini challenge; her gün tabağa bir renk ekle',
          tone: 'Enerjik, davetkâr',
          outline: ['Kapak: "Tabağında kaç renk var?"', '5 slayt: her renk bir grup', 'Son slayt: challenge daveti'],
          internalLinks: [], cta: 'Kaydet & bir arkadaşını etiketle', sources: [], notes: 'Afi maskotu görselleriyle.',
        },
        plannedDate: '2026-07-21', publishedUrl: null,
        createdAt: '2026-07-12T13:00:00Z', updatedAt: '2026-07-12T13:00:00Z',
      },
      {
        id: 6, channel: 'instagram', title: 'Afi ile tanışın: maskotumuzun hikâyesi',
        status: 'fikir', slug: null,
        brief: { ...emptyBrief(), notes: 'Reels — Afi animasyonları + "Sayma, dengele." mesajı.' },
        plannedDate: null, publishedUrl: null,
        createdAt: '2026-07-14T09:00:00Z', updatedAt: '2026-07-14T09:00:00Z',
      },
      {
        id: 7, channel: 'instagram', title: '1 kase ne kadar? El ölçüleriyle porsiyon — reels',
        status: 'yayinda', slug: null,
        brief: {
          keywords: ['porsiyon ölçüsü', 'el ölçüsü'],
          audience: 'IG keşfet — beslenme ilgilileri',
          angle: 'Mutfakta 30 saniyede el ölçüsü göstermek',
          tone: 'Hızlı, samimi',
          outline: ['Hook: "Tartıya gerek yok"', '4 ölçü örneği', 'Kapanış: afiet logosu'],
          internalLinks: [], cta: 'Profildeki linkten bekleme listesi', sources: [], notes: '',
        },
        plannedDate: '2026-07-05', publishedUrl: 'https://www.instagram.com/p/ornek-reels/',
        createdAt: '2026-06-28T09:00:00Z', updatedAt: '2026-07-05T18:00:00Z',
      },
      {
        id: 8, channel: 'x', title: 'Neden kalori saymıyoruz? — thread',
        status: 'uretimde', slug: null,
        brief: {
          keywords: ['kalori sayma', 'beslenme uygulaması'],
          audience: 'X\'te ürün/sağlık teknolojisi takipçileri',
          angle: 'Ürün felsefesi: sayı takıntısı yerine denge; afiet\'in tasarım kararları',
          tone: 'Düşünceli, kurucu sesi',
          outline: ['Hook: kalori saymayı bırakınca ne oldu?', '5–6 tweet: felsefe + ekran görüntüleri', 'Kapanış: beta daveti'],
          internalLinks: [], cta: 'Beta için DM / linke tıkla', sources: [], notes: '',
        },
        plannedDate: '2026-07-17', publishedUrl: null,
        createdAt: '2026-07-13T15:00:00Z', updatedAt: '2026-07-14T10:00:00Z',
      },
      {
        id: 9, channel: 'x', title: 'Beta öğrenimleri: 3 hafta, ilk kullanıcılar',
        status: 'fikir', slug: null,
        brief: { ...emptyBrief(), notes: 'TestFlight betasından anonim/kohort düzeyi öğrenimler.' },
        plannedDate: null, publishedUrl: null,
        createdAt: '2026-07-15T08:00:00Z', updatedAt: '2026-07-15T08:00:00Z',
      },
      {
        id: 10, channel: 'blog', title: 'Yaz sofraları mini serisi',
        status: 'arsiv', slug: null,
        brief: { ...emptyBrief(), notes: 'Sezonu geçti — gelecek yaz tekrar değerlendir.' },
        plannedDate: null, publishedUrl: null,
        createdAt: '2026-06-01T09:00:00Z', updatedAt: '2026-06-20T09:00:00Z',
      },
    ],
    metrics: [
      { id: 1, itemId: 4, metricDate: '2026-07-08', views: 120, likes: 0, comments: 0, shares: 2, saves: 0, clicks: 9, notes: 'İlk gün' },
      { id: 2, itemId: 4, metricDate: '2026-07-14', views: 480, likes: 0, comments: 0, shares: 6, saves: 0, clicks: 31, notes: '' },
      { id: 3, itemId: 7, metricDate: '2026-07-07', views: 2100, likes: 148, comments: 12, shares: 22, saves: 64, clicks: 18, notes: 'Reels ilk 48 saat' },
      { id: 4, itemId: 7, metricDate: '2026-07-14', views: 5400, likes: 310, comments: 25, shares: 41, saves: 152, clicks: 44, notes: '' },
    ],
    posts: [
      {
        slug: 'su-icmeyi-hatirlamanin-nazik-yollari', title: 'Su içmeyi hatırlamanın nazik yolları',
        status: 'yayinda', publishedAt: '2026-07-08T09:30:00Z', readingMinutes: 4, itemId: 4, updatedAt: '2026-07-08T09:30:00Z',
      },
    ],
  }
}
