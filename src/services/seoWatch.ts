import { authorizedFetch } from './auth'

/**
 * SEO nöbetçisi: haftalık rapor ve yürüyen yapılacaklar listesi.
 *
 * Veri afiet-backend'de yaşar (`seo_reports` + yapılacaklar tablosu) ve
 * `/v1/admin/seo/*` uçlarından gelir. Ölçümlerin kendisi afiet-web'in
 * veritabanındadır; backend oraya salt okunur bakar. Panel HİÇBİR SAYI
 * HESAPLAMAZ, yalnız gösterir: raporun sayıları maille giden sayılarla aynı
 * olmak zorunda, o yüzden tek kaynak sunucudaki anlık görüntüdür.
 *
 * YAPILACAKLAR YÜRÜYEN BİR LİSTEDİR: ajan her pazartesi listesini yeniden
 * üretir, sunucu aynı işi ikinci bir satır açmadan tanır; tamamlanmayan madde
 * haftadan haftaya taşınır, tamamlanan çizilir ve altta durur.
 */

/** Maddeyi kim yazdı: haftalık ajan mı, panelden sen mi. */
export type SeoActionSource = 'ajan' | 'elle'

export type SeoAction = {
  id: number
  title: string
  /** Neden şimdi. Ajan maddelerinde ölçümdeki bulguya dayanır. */
  why: string
  /** Hangi repo, panel ya da hesap. Boş olabilir. */
  where: string
  source: SeoActionSource
  done: boolean
  /** Listeye ilk girdiği haftanın pazartesisi (YYYY-MM-DD). */
  firstWeek: string
  /** Ajanın maddeyi son tekrarladığı hafta. */
  lastWeek: string
  /** Kaç haftadır listede. 1 = bu hafta girdi. */
  weeks: number
  doneAt: string | null
}

/** Rapor listesindeki bir satır: hafta seçicinin gördüğü kadarı. */
export type SeoReportSummary = {
  id: number
  /** Haftanın pazartesisi (YYYY-MM-DD, Europe/Istanbul). */
  weekStart: string
  verdict: string
  createdAt: string
  /** Rapor maili gerçekten gitti mi (mail kimliği var mı). */
  mailed: boolean
}

export type SeoPeriod = {
  label: string
  start: string
  end: string
  clicks: number
  impressions: number
  position: number
  /** Gösterim alan ayrı sayfa sayısı. */
  pages: number
  /** Ayrı sorgu sayısı. */
  queries: number
  /** Marka adını içermeyen sorgu sayısı: büyümenin asıl göstergesi. */
  nonBrand: number
}

export type SeoKeyRow = { key: string; clicks: number; impressions: number; position: number }
export type SeoSectionRow = { section: string; indexed: number; total: number }
export type SeoChangeRow = { url: string; from: string; to: string; at: string }
export type SeoBotRow = { bot: string; requests: number; errors: number; lastAt: string }
export type SeoChannelRow = { channel: string; sessions: number }

/**
 * Raporun dayandığı ölçümler. Sunucuda rapora AYNEN saklanır: haftalar sonra
 * açılan bir rapor, o gün okunan sayıları göstermeli.
 */
export type SeoSnapshot = {
  search: {
    current: SeoPeriod
    previous: SeoPeriod
    topQueries: SeoKeyRow[]
    topPages: SeoKeyRow[]
    /** Google'ın verisi bu tarihe kadar tam (yaklaşık iki gün geriden gelir). */
    dataThrough: string
    syncedAt: string
  }
  index: {
    /**
     * Durum sayımı. Anahtarlar afiet-web'in yazdığı dile bağlı olmayan
     * enum'lar (`indexed`, `discovered`, `noindex`, …); Türkçe karşılıkları
     * INDEX_STATE_LABELS'ta.
     */
    now: Record<string, number>
    before: Record<string, number>
    beforeDate: string
    sections: SeoSectionRow[]
    changed: SeoChangeRow[]
    checkedThrough: string
  }
  bots: {
    since: string
    total: number
    errors: number
    rows: SeoBotRow[]
    newBots: string[]
    /** Daha önce gelmiş ama bu hafta susan tarayıcılar. */
    quiet: string[]
    recordingSince: string
  }
  traffic: {
    since: string
    channels: SeoChannelRow[]
    aiSessions: number
  }
}

export type SeoReportDetail = SeoReportSummary & { snapshot: SeoSnapshot }

/** Sekmenin tek çağrıda ihtiyaç duyduğu her şey. */
export type SeoWatchOverview = {
  reports: SeoReportSummary[]
  latest: SeoReportDetail | null
  actions: SeoAction[]
}

/**
 * İndeks durumlarının Türkçe karşılığı. Tek kaynak afiet-web'in
 * `gscIndexStore.ts` dosyasıdır; buradaki kopya YALNIZ görüntü içindir ve
 * sözlükte olmayan bir durum ham adıyla gösterilir (yeni bir durum eklendiğinde
 * sayı kaybolmasın diye).
 */
const INDEX_STATE_LABELS: Record<string, string> = {
  indexed: 'indekste',
  discovered: 'keşfedildi',
  crawled: 'tarandı',
  unknown: 'Google bilmiyor',
  noindex: 'noindex',
  robots_blocked: 'robots engelli',
  other: 'sınıflanamadı',
}

export const indexStateLabel = (state: string) => INDEX_STATE_LABELS[state] ?? state

// ── API ────────────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await authorizedFetch(path, init)
  } catch {
    throw new Error('Sunucuya ulaşılamadı. Bağlantını kontrol edip yeniden dene.')
  }
  if (!response.ok) {
    let message = 'İşlem tamamlanamadı.'
    try {
      const body = await response.json()
      message = body?.error?.message || message
    } catch { /* boş gövde */ }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const seoWatchApi = {
  overview: () => request<SeoWatchOverview>('/v1/admin/seo/raporlar'),
  report: (id: number) => request<SeoReportDetail>(`/v1/admin/seo/raporlar/${id}`),
  /** Haftayı beklemeden rapor üretir. Ayrık koşar; sonucu mail ve bu ekran söyler. */
  run: () => request<{ status: string }>('/v1/admin/seo/rapor/tetikle', { method: 'POST' }),
  addAction: (input: { title: string; why: string; where: string }) =>
    request<SeoAction>('/v1/admin/seo/yapilacaklar', { method: 'POST', body: JSON.stringify(input) }),
  setActionDone: (id: number, done: boolean) =>
    request<SeoAction>(`/v1/admin/seo/yapilacaklar/${id}`, { method: 'PATCH', body: JSON.stringify({ tamamlandi: done }) }),
  /** Yalnız elle eklenen madde silinir; ajan maddesi tamamlanarak kapatılır. */
  deleteAction: (id: number) => request<void>(`/v1/admin/seo/yapilacaklar/${id}`, { method: 'DELETE' }),
}
