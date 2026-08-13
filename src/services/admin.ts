import { authorizedFetch, signOut } from './auth'
import type { GrowthData } from './growth'
import type {
  PushAudience, PushAudiencePreview, PushBroadcast, PushBroadcastInput,
  PushGlobalPatch, PushOverview, PushPerson, PushTrigger, PushTriggerPatch,
} from './push'

// Besin kataloğu tipleri ve uçları services/foods.ts'te yaşar: 16 alan,
// facet dağılımı ve kendi önbelleği var, bu dosyayı gereksiz şişiriyordu.
export type { Macros, Food, FoodInput } from './foods'

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
export type Quest = {
  id: string
  key: string
  title: string
  detail: string
  /**
   * What Afi says when the quest is opened in the app.
   *
   * `detail` is the one-line label under the title in the list and has to stay
   * short; this is the paragraph behind it, so the rule a quest counts can be
   * rewritten here instead of in a mobile release. Blank is allowed: the app
   * falls back to `detail`.
   */
  narration: string
  /**
   * Görev detayındaki eylem düğmesinin metni ve gideceği ekran.
   *
   * Boş ise uygulama metrik ailesinin varsayılanını kullanır
   * (services/questActions.ts). Hedef serbest rota değil bilinen bir jetondur;
   * mobil tarafın tanımadığı bir jeton gönderilirse düğme çizilmez. İkisi
   * birlikte doldurulur: sunucu da veritabanı da yarım aksiyonu reddeder.
   */
  actionLabel: string
  actionTarget: string
  emoji: string
  metric: string
  scope: string
  target: number
  xpReward: number
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}
/** key is ignored on update — user progress is keyed to it. */
export type QuestInput = Omit<Quest, 'id' | 'createdAt' | 'updatedAt'>
/**
 * The list endpoint ships the allowed metric/scope values with the rows, so the
 * form never hardcodes the quest_metric enum. A metric missing from that list
 * would make its quests unsavable, which is exactly how 7 of the 14 seeded
 * quests were once locked out of this panel.
 */
export type QuestList = {
  quests: Quest[]
  metrics: string[]
  scopes: string[]
  /** Uygulamanın tanıdığı ekran jetonları; form bu listeyi sabit tutmaz. */
  actionTargets: string[]
}
export type Summary = { foodCount: number; userCount: number }
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
  quests: () => request<QuestList>('/v1/admin/quests'),
  addQuest: (input: QuestInput) => request<Quest>('/v1/admin/quests', { method: 'POST', body: JSON.stringify(input) }),
  updateQuest: (id: string, input: QuestInput) => request<Quest>(`/v1/admin/quests/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteQuest: (id: string) => request<void>(`/v1/admin/quests/${id}`, { method: 'DELETE' }),
  users: (params: { page: number; pageSize: number; query?: string }) =>
    request<Page<User>>(`/v1/admin/users${queryString(params)}`),
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
  // Aktif bildirimler: tetikleyici ayarları, izin sayıları, ana anahtar ve
  // sessiz saatler. Dördü de backend'de canlı (server.go > /v1/admin/push/*).
  // Bu not eskiden "uçlar HENÜZ YOK, panel pushMock.ts'e düşer" diyordu;
  // uçlar açıldı, pushMock.ts silindi, not kaldı. Sahte veri yolu YOK.
  pushOverview: () => request<PushOverview>('/v1/admin/push/overview'),
  pushPerson: (userId: string) => request<PushPerson>(`/v1/admin/push/kisi/${userId}`),
  updatePushTrigger: (kind: string, patch: PushTriggerPatch) =>
    request<PushTrigger>(`/v1/admin/push/triggers/${kind}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  updatePushGlobals: (patch: PushGlobalPatch) =>
    request<PushOverview>('/v1/admin/push/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
}
