import { config } from '../config'
import { authorizedFetchBase, signOut } from './auth'

/**
 * afiet-web (Nuxt) SEO/GEO yönetim API'si istemcisi. Kimlik: kullanıcının
 * elindeki Stack Auth access token'ı aynı `Authorization: Bearer` başlığıyla
 * web API'sine de gider (web tarafı aynı JWT'yi doğrular). Yerel geliştirmede
 * VITE_WEB_ADMIN_DEV_TOKEN varsa Stack token yerine o gönderilir (refresh yok).
 *
 * Tipler web tarafındaki server/utils/seoTypes.ts ile BİREBİR aynıdır —
 * alan eklerken iki ucu birlikte güncelle.
 */

export type SeoGeneral = { siteName: string; baseUrl: string; defaultTitle: string; defaultDescription: string; defaultOgImage: string; ogImageAlt: string; twitterSite: string; locale: string; themeColor: string; verification: { google: string; bing: string; yandex: string } }
export type AiBotInfo = { agent: string; owner: string; purpose: 'egitim' | 'arama' | 'kullanici'; note: string }
export type SeoRobots = { indexable: boolean; aiBots: Record<string, boolean>; extraRules: string }
export type SeoLlms = { enabled: boolean; content: string }
export type SeoSchema = { organization: { enabled: boolean; name: string; url: string; logo: string; sameAs: string[]; contactEmail: string }; website: { enabled: boolean }; mobileApp: { enabled: boolean; name: string; operatingSystem: string; category: string; description: string; appStoreUrl: string; playStoreUrl: string } }
export type FaqItem = { q: string; a: string }
export type SeoFaq = { enabled: boolean; showOnLanding: boolean; title: string; intro: string; items: FaqItem[] }
export type SeoSettings = { general: SeoGeneral; robots: SeoRobots; llms: SeoLlms; schema: SeoSchema; faq: SeoFaq }
export type SettingsKey = keyof SeoSettings
export type PageSitemap = { include: boolean; changefreq: '' | 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'; priority: number | null }
export type PageSeo = { title: string; description: string; ogTitle: string; ogDescription: string; ogImage: string; canonical: string; robots: string; jsonld: Record<string, unknown>[]; sitemap: PageSitemap }
export type SeoRedirect = { from: string; to: string; code: 301 | 302 }
export type AdminSeoPayload = {
  dbConnected: boolean
  overrides: { settings: Partial<Record<SettingsKey, unknown>>; pages: Record<string, unknown>; redirects: SeoRedirect[] }
  updatedAt: Record<string, string> // 'settings:general' / 'page:/gizlilik' → ISO zaman
  effective: { settings: SeoSettings; pages: Record<string, PageSeo>; redirects: SeoRedirect[] }
  defaults: { settings: SeoSettings; pages: Record<string, PageSeo>; aiBots: AiBotInfo[]; knownPaths: string[] }
}

/** Sunucunun çözdüğü nihai meta (/api/seo/meta yanıtı). */
export type ResolvedPageMeta = {
  path: string
  title: string
  description: string
  canonical: string
  robots: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  ogImageAlt: string
  ogUrl: string
  ogSiteName: string
  ogLocale: string
  twitterSite: string
  themeColor: string
  verification: { google: string; bing: string; yandex: string }
  jsonld: Record<string, unknown>[]
  faq: { title: string; intro: string; items: FaqItem[] } | null
}

/** Web API Türkçe hata kodlarını (statusMessage) kullanıcı-dostu mesaja çevir. */
const ERROR_MESSAGES: Record<string, string> = {
  db_bagli_degil: 'Veritabanı bağlı değil',
  admin_yetkisi_gerekli: 'Bu hesapta admin yetkisi yok',
  gecersiz_token: 'Oturum geçersiz',
  bearer_gerekli: 'Oturum gerekli',
  admin_auth_yapilandirilmadi: 'Web API admin auth yapılandırılmamış',
  yonlendirme_dongusu: 'Bu yönlendirme döngü oluşturur',
  bilinmeyen_ayar: 'Bilinmeyen ayar bölümü',
}

export function humanizeSeoError(code: string): string {
  if (!code) return 'İşlem tamamlanamadı.'
  if (code.startsWith('gecersiz_alan:')) return `Geçersiz alan: ${code.slice('gecersiz_alan:'.length)}`
  return ERROR_MESSAGES[code] ?? code
}

// Dev token varsa (yalnız yerelde) refresh döngüsüne girmeden doğrudan onu gönder.
const usingDevToken = () => import.meta.env.DEV && Boolean(config.webAdminDevToken)

async function webFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (usingDevToken()) {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (init.body) headers.set('Content-Type', 'application/json')
    headers.set('Authorization', `Bearer ${config.webAdminDevToken}`)
    return fetch(`${config.webApiUrl}${path}`, { ...init, headers })
  }
  return authorizedFetchBase(config.webApiUrl, path, init)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await webFetch(path, init)
  if (response.status === 401 && !usingDevToken()) signOut()
  if (!response.ok) {
    let code = ''
    try {
      const body = await response.json()
      code = body?.statusMessage || body?.error?.message || body?.message || ''
    } catch { /* boş gövde */ }
    throw new Error(humanizeSeoError(String(code)))
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const q = (params: Record<string, string>) => {
  const search = new URLSearchParams(params).toString()
  return search ? `?${search}` : ''
}

export const webApi = {
  get: () => request<AdminSeoPayload>('/api/admin/seo'),
  putSettings: (key: SettingsKey, value: unknown) =>
    request<AdminSeoPayload>(`/api/admin/seo/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  deleteSettings: (key: SettingsKey) =>
    request<AdminSeoPayload>(`/api/admin/seo/settings/${key}`, { method: 'DELETE' }),
  putPage: (path: string, value: PageSeo) =>
    request<AdminSeoPayload>('/api/admin/seo/page', { method: 'PUT', body: JSON.stringify({ path, value }) }),
  deletePage: (path: string) =>
    request<AdminSeoPayload>(`/api/admin/seo/page${q({ path })}`, { method: 'DELETE' }),
  putRedirect: (redirect: SeoRedirect) =>
    request<AdminSeoPayload>('/api/admin/seo/redirect', { method: 'PUT', body: JSON.stringify(redirect) }),
  deleteRedirect: (from: string) =>
    request<AdminSeoPayload>(`/api/admin/seo/redirect${q({ from })}`, { method: 'DELETE' }),
  // Auth'suz, yan etkisiz önizleme ucu — sunucunun çözdüğü nihai meta.
  meta: (path: string) =>
    fetch(`${config.webApiUrl}/api/seo/meta${q({ path })}`, { headers: { Accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error('Önizleme alınamadı.'); return r.json() as Promise<ResolvedPageMeta> }),
}
