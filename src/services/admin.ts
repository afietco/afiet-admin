import { authorizedFetch, signOut } from './auth'
import type { GrowthData } from './growth'
import type { PushAudience, PushAudiencePreview, PushBroadcast, PushBroadcastInput } from './push'

export type Macros = { kcal: number; protein: number; carb: number; fat: number }
export type Food = {
  id: string
  name: string
  groups: string[]
  category: string
  measure: string
  macros: Macros
  description: string
  active: boolean
  createdAt: string
  updatedAt: string
}
export type FoodInput = Omit<Food, 'id' | 'createdAt' | 'updatedAt'>
export type User = {
  userId: string
  email: string
  displayName: string | null
  emoji: string | null
  createdAt: string
  updatedAt: string
  mealCount: number
  customFoodCount: number
  measurementCount: number
  lastActivityAt: string | null
}
export type WaitlistEntry = { id: number; email: string; source: string; createdAt: string }
export type Summary = { foodCount: number; userCount: number; waitlistCount: number; waitlistLast7d: number }
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number }

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const result = query.toString()
  return result ? `?${result}` : ''
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authorizedFetch(path, init)
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

export const adminApi = {
  summary: () => request<Summary>('/v1/admin/summary'),
  growth: () => request<GrowthData>('/v1/admin/growth'),
  foods: (params: { page: number; pageSize: number; query?: string; category?: string; status?: string }) =>
    request<Page<Food>>(`/v1/admin/foods${queryString(params)}`),
  addFood: (input: FoodInput) => request<Food>('/v1/admin/foods', { method: 'POST', body: JSON.stringify(input) }),
  updateFood: (id: string, input: FoodInput) => request<Food>(`/v1/admin/foods/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteFood: (id: string) => request<void>(`/v1/admin/foods/${id}`, { method: 'DELETE' }),
  users: (params: { page: number; pageSize: number; query?: string }) =>
    request<Page<User>>(`/v1/admin/users${queryString(params)}`),
  waitlist: (params: { page: number; pageSize: number; query?: string }) =>
    request<Page<WaitlistEntry>>(`/v1/admin/waitlist${queryString(params)}`),
  pushBroadcasts: (params: { page: number; pageSize: number }) =>
    request<Page<PushBroadcast>>(`/v1/admin/push/broadcasts${queryString(params)}`),
  pushAudience: (audience: PushAudience) =>
    request<PushAudiencePreview>(`/v1/admin/push/audience${queryString({
      kind: audience.kind,
      identifier: audience.kind === 'user' ? audience.identifier : undefined,
    })}`),
  sendPushBroadcast: (input: PushBroadcastInput) =>
    request<PushBroadcast>('/v1/admin/push/broadcasts', { method: 'POST', body: JSON.stringify(input) }),
  cancelPushBroadcast: (id: string) =>
    request<void>(`/v1/admin/push/broadcasts/${id}`, { method: 'DELETE' }),
}
