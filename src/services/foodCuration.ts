/**
 * Kullanıcı besinlerinden katalog kürasyonu.
 *
 * Kullanıcılar mobilde kendi besinlerini ekliyor (custom_foods tablosu, "Menüm").
 * Bu dosya o havuzu adaya çeviren admin ucunun İSTEMCİ TARAFI. Uç backend'de
 * HENÜZ YOK: /v1/admin altında custom_foods'a bakan tek bir rota bile
 * bulunmuyor (server.go'daki /custom-foods rotaları kullanıcının kendi
 * menüsüdür, admin değil). Panel bu yüzden veri UYDURMAZ; liste ucu 404
 * dönerse ekran dürüst boş duruma düşer ve aşağıdaki sözleşmeyi gösterir.
 *
 * ── Beklenen sözleşme ────────────────────────────────────────────────────────
 *
 * GET /v1/admin/custom-foods
 *   Sorgu: query, status, minUsers, sort, order, page, pageSize
 *     query    ad ya da takma ad parçası (boş: filtre yok)
 *     status   '' | 'bekliyor' | 'kabul' | 'red' | 'birlesik'
 *     minUsers tamsayı; en az kaç FARKLI kullanıcı eklemiş olsun
 *     sort     'kullanici' | 'giris' | 'yeni' | 'ad'   (varsayılan kullanici)
 *     order    'asc' | 'desc'                          (varsayılan desc)
 *   Yanıt: { items: CustomFoodCandidate[], total, page, pageSize, summary }
 *
 *   Satırlar custom_foods.name'in NORMALİZE hâline göre gruplanır
 *   (lower(name), tek boşluk). "Ev makarnası" ile "ev makarnası" tek adaydır;
 *   yazım farkları `variants` içinde döner. Gruplama anahtarı `key` alanıdır ve
 *   karar uçlarında yol parçası olarak kullanılır.
 *
 *   entryCount meal_entries'ten gelir: lower(food_name) = key olan satır sayısı.
 *   meal_entries.food_name serbest metindir, bu yüzden bu sayı "besin gerçekten
 *   yeniyor mu" sorusunun tek doğrudan cevabıdır.
 *
 *   matches katalogla çakışmayı gösterir: foods içinde lower(name) = key olan
 *   kayıt (kind 'ad'), takma adı eşleşen kayıt (kind 'takma_ad') ve pg_trgm
 *   similarity(name, key) >= 0,65 olan kayıtlar (kind 'benzer').
 *
 * POST /v1/admin/custom-foods/{key}/decision
 *   Gövde: { action: 'kataloga_al' | 'reddet' | 'birlestir', foodId?, note? }
 *     kataloga_al  panel önce POST /v1/admin/foods ile kaydı yaratır, dönen id'yi
 *                  foodId olarak yollar. Uç yalnız kararı yazar, besin YARATMAZ.
 *     birlestir    foodId zorunlu; aday mevcut katalog kaydına eşlenir.
 *     reddet       foodId yok; note serbest gerekçe.
 *   Yanıt: güncellenmiş CustomFoodCandidate.
 *
 * DELETE /v1/admin/custom-foods/{key}/decision
 *   Kararı geri alır, aday yeniden 'bekliyor' olur. Katalog kaydını SİLMEZ;
 *   yanlışlıkla kataloğa alınan besin panelin katalog sekmesinden pasife
 *   çekilir ya da silinir.
 *
 *   Kararlar yeni bir tabloda durmalı (custom_food_decisions): key TEXT PRIMARY
 *   KEY, status TEXT, food_id UUID NULL REFERENCES foods(id), note TEXT,
 *   decided_by TEXT, decided_at TIMESTAMPTZ. Karar ada bağlıdır, satıra değil:
 *   aynı adı yarın başka bir kullanıcı eklerse karar hâlâ geçerlidir. Her yazma
 *   admin_actions'a da satır düşürmeli (panelin geri kalanıyla aynı kural).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { authorizedFetch, signOut } from './auth'
import { AbortedError, emptyFilters, foodsApi, type Food } from './foods'
import type { CatalogNeighbor } from './foodQuality'

export type CandidateStatus = 'bekliyor' | 'kabul' | 'red' | 'birlesik'

/** Aynı adayın farklı yazımları; hangisinin kataloğa gireceğine admin karar verir. */
export type CandidateVariant = { name: string; userCount: number }

/** Kullanıcıların girdiği değerin dağılımı. Aralık genişse ad birden çok şeyi anlatıyor. */
export type MacroStat = { median: number; min: number; max: number }

export type CandidateMacros = {
  kcal: MacroStat
  protein: MacroStat
  carb: MacroStat
  fat: MacroStat
  /** Kaç kullanıcı makro doldurmuş; custom_foods.macros NULL olabiliyor. */
  filled: number
}

export type CandidateMatch = {
  foodId: string
  name: string
  kind: 'ad' | 'takma_ad' | 'benzer'
  /** pg_trgm similarity; 'ad' eşleşmesinde 1. */
  similarity: number
  kcal: number
}

export type CandidateDecision = {
  status: Exclude<CandidateStatus, 'bekliyor'>
  decidedAt: string
  decidedBy: string
  note: string
  /** kabul: yaratılan katalog kaydı. birlestir: eşlenen kayıt. reddet: null. */
  foodId: string | null
  foodName: string | null
}

export type CustomFoodCandidate = {
  /** Normalize ad; karar anahtarı ve liste anahtarı. */
  key: string
  /** En çok kullanıcının yazdığı hâli. */
  name: string
  variants: CandidateVariant[]
  /** Kaç FARKLI kullanıcı eklemiş. Kataloğa alma sinyalinin ta kendisi. */
  userCount: number
  /** meal_entries'te bu adla kaç öğün kaydı var. */
  entryCount: number
  /** En yaygın ölçü ve o ölçüde uzlaşma oranı (0..1). */
  measure: string | null
  measureAgreement: number
  /** Kullanıcıların yarısından fazlasının seçtiği gruplar. */
  groups: string[]
  macros: CandidateMacros | null
  /** İlk ve son eklenme; eski ve tek seferlik adları ayırt eder. */
  firstSeenAt: string
  lastSeenAt: string
  matches: CandidateMatch[]
  decision: CandidateDecision | null
}

export type CurationSummary = {
  /** Farklı ad sayısı (satır değil). */
  candidates: number
  pending: number
  accepted: number
  rejected: number
  merged: number
  /** En az bir besin eklemiş kullanıcı sayısı. */
  contributors: number
  /** custom_foods satır sayısı. */
  customFoods: number
}

export type CandidatePage = {
  items: CustomFoodCandidate[]
  total: number
  page: number
  pageSize: number
  summary: CurationSummary
}

export type CurationFilters = {
  query: string
  status: '' | CandidateStatus
  minUsers: number
  sort: 'kullanici' | 'giris' | 'yeni' | 'ad'
  order: 'asc' | 'desc'
}

export const emptyCurationFilters = (): CurationFilters => ({
  query: '', status: 'bekliyor', minUsers: 2, sort: 'kullanici', order: 'desc',
})

export type DecisionInput = {
  action: 'kataloga_al' | 'reddet' | 'birlestir'
  foodId?: string
  note?: string
}

/**
 * Uç henüz açılmamış. Ağ hatasından ve yetki hatasından AYRI tutulur: ekranın
 * göstereceği metin ("backend bunu şöyle dönmeli") yalnız bu durumda doğrudur.
 */
export class MissingEndpointError extends Error {
  constructor(public path: string) {
    super('Bu uç backend tarafında henüz yok.')
    this.name = 'MissingEndpointError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await authorizedFetch(path, init)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw new AbortedError()
    throw err
  }
  if (response.status === 401) signOut()
  if (response.status === 404) throw new MissingEndpointError(path)
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

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 0) query.set(key, String(value))
  })
  const result = query.toString()
  return result ? `?${result}` : ''
}

export const CURATION_LIST_PATH = '/v1/admin/custom-foods'

export const curationApi = {
  list(filters: CurationFilters, page: number, pageSize: number, signal?: AbortSignal) {
    const path = `${CURATION_LIST_PATH}${queryString({ ...filters, query: filters.query.trim(), page, pageSize })}`
    return request<CandidatePage>(path, { signal })
  },
  decide(key: string, input: DecisionInput) {
    return request<CustomFoodCandidate>(
      `${CURATION_LIST_PATH}/${encodeURIComponent(key)}/decision`,
      { method: 'POST', body: JSON.stringify(input) },
    )
  },
  undo(key: string) {
    return request<CustomFoodCandidate>(
      `${CURATION_LIST_PATH}/${encodeURIComponent(key)}/decision`,
      { method: 'DELETE' },
    )
  },
}

/**
 * Bir ad için katalogdaki komşu kayıtlar. Katalog arama ucu GERÇEK ve bugün
 * çalışıyor; kürasyon ucu açılmadan önce bile "bu ad zaten katalogda mı"
 * sorusunu cevaplayabiliyoruz.
 *
 * İki arama yapılır: tam ad ve adın en uzun kelimesi. Backend araması
 * substring ILIKE olduğu için tam ad "Mercimek çorbası" ararken
 * "Yeşil mercimek çorbası" kaydını GETİRMEZ; kelime araması getirir.
 */
export async function catalogNeighbors(name: string, signal?: AbortSignal): Promise<CatalogNeighbor[]> {
  const trimmed = name.trim()
  if (trimmed.length < 2) return []
  const words = trimmed.split(/\s+/).filter((word) => word.length >= 4)
  const longest = words.sort((a, b) => b.length - a.length)[0]
  const queries = longest && longest !== trimmed ? [trimmed, longest] : [trimmed]

  const pages = await Promise.all(queries.map((query) =>
    foodsApi.list({ ...emptyFilters(), query }, 1, 30, signal)))

  const seen = new Map<string, Food>()
  pages.forEach((page) => page.items.forEach((food) => seen.set(food.id, food)))
  return [...seen.values()].map((food) => ({
    id: food.id,
    name: food.name,
    aliases: food.aliases,
    kcal: food.macros.kcal,
  }))
}

/**
 * Havuzun büyüklüğü: kaç kullanıcı kendi besnini eklemiş ve toplam kaç kayıt var.
 *
 * Bu sayı GERÇEK ve bugün okunabiliyor, çünkü /v1/admin/users her satırda
 * customFoodCount taşıyor. Aday listesi açılana kadar ekranın elindeki tek
 * gerçek veri budur: kürasyonun ne kadar iş olduğunu gösterir, hangi besnin
 * alınacağını göstermez.
 *
 * Kullanıcı listesi sayfalıdır ve backend pageSize'ı 500'de kırpar. Dört
 * sayfadan fazlası çekilmez; kapsanmayan kullanıcı kalırsa `truncated` true
 * döner ve ekran sayıyı "en az" diye okur.
 */
export type CustomFoodPool = {
  /** Kaç kullanıcı incelendi. */
  scanned: number
  /** Toplam kullanıcı (backend'in verdiği total). */
  total: number
  /** En az bir özel besni olan kullanıcı sayısı. */
  contributors: number
  /** İncelenen kullanıcılardaki özel besin toplamı. */
  customFoods: number
  top: { userId: string; email: string; displayName: string | null; count: number }[]
  truncated: boolean
}

const POOL_PAGE_SIZE = 500
const POOL_MAX_PAGES = 4

export async function customFoodPool(): Promise<CustomFoodPool> {
  const { adminApi } = await import('./admin')
  const pool: CustomFoodPool = {
    scanned: 0, total: 0, contributors: 0, customFoods: 0, top: [], truncated: false,
  }
  const rows: CustomFoodPool['top'] = []
  for (let page = 1; page <= POOL_MAX_PAGES; page += 1) {
    const result = await adminApi.users({ page, pageSize: POOL_PAGE_SIZE })
    pool.total = result.total
    pool.scanned += result.items.length
    result.items.forEach((user) => {
      if (user.customFoodCount <= 0) return
      pool.contributors += 1
      pool.customFoods += user.customFoodCount
      rows.push({
        userId: user.userId, email: user.email, displayName: user.displayName, count: user.customFoodCount,
      })
    })
    if (pool.scanned >= result.total || !result.items.length) break
  }
  pool.truncated = pool.scanned < pool.total
  pool.top = rows.sort((a, b) => b.count - a.count).slice(0, 6)
  return pool
}

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  bekliyor: 'Bekliyor',
  kabul: 'Kataloğa alındı',
  red: 'Reddedildi',
  birlesik: 'Mevcut kayda bağlandı',
}

export const CANDIDATE_SORT_LABELS: Record<CurationFilters['sort'], string> = {
  kullanici: 'Kullanıcı sayısına göre',
  giris: 'Öğün kaydına göre',
  yeni: 'Son eklenmeye göre',
  ad: 'Ada göre',
}
