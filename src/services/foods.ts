import { authorizedFetch, signOut } from './auth'

export type Macros = { kcal: number; protein: number; carb: number; fat: number }

/** Backend store.AdminFood ile birebir; 16 içerik alanının tamamı. */
export type Food = {
  id: string
  name: string
  groups: string[]
  category: string
  measure: string
  macros: Macros
  description: string
  active: boolean
  gramPerMeasure: number
  fiberG: number
  suitableMeals: string[]
  dietTags: string[]
  emoji: string
  defaultQuantity: number
  aliases: string[]
  liquidMl: number | null
  lighterAlternative: string | null
  createdAt: string
  updatedAt: string
}

export type FoodInput = Omit<Food, 'id' | 'createdAt' | 'updatedAt'>

export type FoodPage = { items: Food[]; total: number; page: number; pageSize: number }

export type FacetValue = { value: string; count: number }
/** key: category | group | dietTag | meal | measure — filtre parametresinin adı. */
export type FacetDimension = { key: string; values: FacetValue[] }

export type FoodCoverage = {
  emoji: number
  aliases: number
  dietTags: number
  suitableMeals: number
  fiber: number
  liquidMl: number
  lighterAlternative: number
  description: number
  distinctEmoji: number
  aliasTotal: number
  lighterTargets: number
}

export type FoodFacets = {
  total: number
  active: number
  inactive: number
  dimensions: FacetDimension[]
  sortKeys: string[]
  coverage: FoodCoverage
}

/**
 * Filtre durumu. Boş dize "bu boyutta filtre yok" demektir ve sorgu dizesine
 * hiç yazılmaz; backend de aynı sözleşmeyi kullanıyor.
 */
export type FoodFilters = {
  query: string
  category: string
  group: string
  dietTag: string
  meal: string
  measure: string
  status: string
  hasLighter: string
  sort: string
  order: string
}

export const emptyFilters = (): FoodFilters => ({
  query: '', category: '', group: '', dietTag: '', meal: '',
  measure: '', status: '', hasLighter: '', sort: 'name', order: 'asc',
})

export function activeFilterCount(filters: FoodFilters) {
  const dimensions: (keyof FoodFilters)[] = ['category', 'group', 'dietTag', 'meal', 'measure', 'status', 'hasLighter']
  return dimensions.filter((key) => filters[key] !== '').length
}

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const result = query.toString()
  return result ? `?${result}` : ''
}

/** İstek iptal edildiğinde atılır; çağıran bunu hata olarak GÖSTERMEZ. */
export class AbortedError extends Error {
  constructor() {
    super('istek iptal edildi')
    this.name = 'AbortedError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await authorizedFetch(path, init)
  } catch (err) {
    // fetch yalnız ağ hatasında ve iptalde reject eder; iptali ayırmazsak
    // kullanıcı her tuş vuruşunda kırmızı toast görür.
    if (err instanceof DOMException && err.name === 'AbortError') throw new AbortedError()
    throw err
  }
  if (response.status === 401) signOut()
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

/**
 * Kısa ömürlü sonuç önbelleği. Facet raylarında filtre ileri geri tıklanıyor;
 * TTL içinde aynı sorguya dönüldüğünde ağa çıkılmaz. Katalog global ve nadiren
 * değişir, backend zaten aynı gerekçeyle 60 sn önbellekliyor.
 */
const CACHE_TTL = 30_000
const CACHE_LIMIT = 40
const cache = new Map<string, { at: number; value: unknown }>()

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL) return Promise.resolve(hit.value as T)
  return load().then((value) => {
    // Map ekleme sırasını korur; en eski girdi ilk anahtardır.
    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(key, { at: Date.now(), value })
    return value
  })
}

/** Katalog yazımından sonra çağrılır; bayat sayfa ve dağılım gösterilmesin. */
export function invalidateFoodCache() {
  cache.clear()
}

export const foodsApi = {
  list(filters: FoodFilters, page: number, pageSize: number, signal?: AbortSignal) {
    const path = `/v1/admin/foods${queryString({ ...filters, query: filters.query.trim(), page, pageSize })}`
    return cached(path, () => request<FoodPage>(path, { signal }))
  },
  facets(signal?: AbortSignal) {
    return cached('/v1/admin/foods/facets', () => request<FoodFacets>('/v1/admin/foods/facets', { signal }))
  },
  add(input: FoodInput) {
    return request<Food>('/v1/admin/foods', { method: 'POST', body: JSON.stringify(input) })
      .finally(invalidateFoodCache)
  },
  update(id: string, input: FoodInput) {
    return request<Food>(`/v1/admin/foods/${id}`, { method: 'PUT', body: JSON.stringify(input) })
      .finally(invalidateFoodCache)
  },
  remove(id: string) {
    return request<void>(`/v1/admin/foods/${id}`, { method: 'DELETE' }).finally(invalidateFoodCache)
  },
}
