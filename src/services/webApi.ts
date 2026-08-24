import { config } from '../config'
import { authorizedFetchBase } from './auth'

/**
 * afiet-web (Nuxt) admin API istemcisi: analitik, içerik, beta, sosyal ve
 * sürüm kapısı servisleri bu taşıyıcıyı kullanır. Kimlik: kullanıcının
 * elindeki Stack Auth access token'ı aynı `Authorization: Bearer` başlığıyla
 * web API'sine de gider (web tarafı aynı JWT'yi doğrular). Yerel geliştirmede
 * VITE_WEB_ADMIN_DEV_TOKEN varsa Stack token yerine o gönderilir (refresh yok).
 *
 * SEO ayar uçları (`/api/admin/seo*`) burada DEĞİL: panelden düzenleme 24
 * Ağustos 2026'da kaldırıldı, uçlar web tarafında duruyor ama panel onlara
 * gitmiyor (bkz. views/analytics/SeoTab.vue).
 */

/** Web API Türkçe hata kodlarını (statusMessage) kullanıcı-dostu mesaja çevir. */
const ERROR_MESSAGES: Record<string, string> = {
  db_bagli_degil: 'Veritabanı bağlı değil',
  admin_yetkisi_gerekli: 'Bu hesapta admin yetkisi yok',
  gecersiz_token: 'Oturum geçersiz',
  bearer_gerekli: 'Oturum gerekli',
  admin_auth_yapilandirilmadi: 'Web API admin auth yapılandırılmamış',
}

export function humanizeWebError(code: string): string {
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

/** Web API'sine kimlikli istek — diğer web-kaynaklı servisler de (içerik) bunu kullanır. */
export async function webRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await webFetch(path, init)
  if (!response.ok) {
    let code = ''
    try {
      const body = await response.json()
      code = body?.statusMessage || body?.error?.message || body?.message || ''
    } catch { /* boş gövde */ }
    throw new Error(humanizeWebError(String(code)))
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

/**
 * Web API'sinden dosya indirme (CSV vb.): kimlikli istek, ham metin döner.
 * JSON değil, o yüzden webRequest'ten ayrı; hata gövdesi yine JSON olabilir.
 */
export async function webRequestText(path: string): Promise<string> {
  const response = await webFetch(path)
  if (!response.ok) {
    let code = ''
    try {
      const body = await response.json()
      code = body?.statusMessage || body?.error?.message || body?.message || ''
    } catch { /* boş gövde */ }
    throw new Error(humanizeWebError(String(code)))
  }
  return response.text()
}
