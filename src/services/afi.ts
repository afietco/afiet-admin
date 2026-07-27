import { authorizedFetch, signOut } from './auth'

// "Afi'ye sor" yönetimi. Tipleri ve uçları admin.ts'e değil buraya koyuyoruz;
// besin kataloğunda da aynı karar verildi, tek dosya gereksiz şişiyordu.

export type Page<T> = { items: T[] | null; total: number; page: number; pageSize: number }

export type AskStats = {
  questions: number
  sessions: number
  answered: number
  unanswered: number
  answerRate: number
  medianMs: number
  p95Ms: number
  turnsPerChat: number
}

export type AskQuestionGroup = {
  normalized: string
  sample: string
  count: number
  answered: number
  lastAsked: string
}

export type AskSession = {
  id: string
  turns: number
  startedAt: string
  lastAt: string
  firstQuestion: string
}

export type AskMessage = {
  seq: number
  role: 'user' | 'afi'
  text: string
  answered: boolean | null
  latencyMs: number | null
  sources: string[] | null
  createdAt: string
}

export type KbDoc = {
  id: string
  slug: string
  title: string
  body: string
  summary: string
  source: string
  sourceRef: string
  url: string
  tags: string[] | null
  status: KbStatus
  locked: boolean
  chunkCount: number
  indexedAt: string | null
  stale: boolean
  updatedBy: string
  updatedAt: string
  createdAt: string
}

export type KbStatus = 'draft' | 'published' | 'archived'

export type KbDocInput = {
  slug: string
  title: string
  body: string
  summary: string
  url: string
  tags: string[]
  status: KbStatus
  locked: boolean
}

export type KbRevision = {
  id: number
  title: string
  body: string
  status: string
  author: string
  reason: string
  createdAt: string
}

export type KbIndexStatus = {
  documents: number
  published: number
  stale: number
  chunks: number
  chunkBytes: number
  lastSynced: string | null
}

export type KbRun = {
  id: string
  trigger: 'scheduler' | 'admin'
  status: 'running' | 'succeeded' | 'failed'
  startedAt: string
  finishedAt: string | null
  docsCreated: number
  docsUpdated: number
  docsArchived: number
  chunksUpserted: number
  chunksDeleted: number
  indexBytes: number | null
  indexDocuments: number | null
  note: string
  error: string
  triggeredBy: string
}

export const kbStatusLabels: Record<KbStatus, string> = {
  draft: 'Taslak',
  published: 'Yayında',
  archived: 'Arşiv',
}

// Belgenin nereden geldiği. 'faq' / 'blog' / 'legal' / 'landing' toplayıcının
// yazdıklarıdır ve elle düzenlenmemeli: bir sonraki tazeleme üzerine yazar.
export const kbSourceLabels: Record<string, string> = {
  faq: 'SSS',
  blog: 'Blog',
  legal: 'Yasal',
  landing: 'Site',
  manual: 'Elle',
  agent: 'Ajan',
}

/** Toplayıcının sahibi olduğu kaynaklar; panelden düzenlemek kalıcı olmaz. */
export const collectedSources = new Set(['faq', 'blog', 'legal', 'landing'])

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const result = query.toString()
  return result ? `?${result}` : ''
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await authorizedFetch(path, init)
  } catch {
    // fetch ağ seviyesinde düşerse "Failed to fetch" fırlatır; baştan sona
    // Türkçe bir panelde bu ham tarayıcı metnini kullanıcıya göstermeyelim.
    throw new Error('Sunucuya ulaşılamadı. Bağlantını kontrol edip yeniden dene.')
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

export type AskRange = '24h' | '7d' | '30d' | '90d'

export const afiApi = {
  stats: (range: AskRange) => request<AskStats>(`/v1/admin/ask/stats${queryString({ range })}`),
  questions: (params: { range: AskRange; mode?: 'unanswered'; page: number; pageSize: number }) =>
    request<Page<AskQuestionGroup>>(`/v1/admin/ask/questions${queryString(params)}`),
  sessions: (params: { page: number; pageSize: number }) =>
    request<Page<AskSession>>(`/v1/admin/ask/sessions${queryString(params)}`),
  transcript: (id: string) =>
    request<{ sessionId: string; messages: AskMessage[] | null }>(`/v1/admin/ask/sessions/${id}`),

  kbStatus: () => request<KbIndexStatus>('/v1/admin/kb/status'),
  kbDocs: (params: { query?: string; status?: string; page: number; pageSize: number }) =>
    request<Page<KbDoc>>(`/v1/admin/kb/docs${queryString(params)}`),
  createKbDoc: (input: KbDocInput) =>
    request<KbDoc>('/v1/admin/kb/docs', { method: 'POST', body: JSON.stringify(input) }),
  updateKbDoc: (id: string, input: KbDocInput) =>
    request<KbDoc>(`/v1/admin/kb/docs/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteKbDoc: (id: string) => request<void>(`/v1/admin/kb/docs/${id}`, { method: 'DELETE' }),
  kbRevisions: (id: string) =>
    request<{ items: KbRevision[] | null }>(`/v1/admin/kb/docs/${id}/revisions`),

  refresh: () => request<{ status: string }>('/v1/admin/kb/tazele', { method: 'POST' }),
  runs: (params: { page: number; pageSize: number }) =>
    request<Page<KbRun>>(`/v1/admin/kb/runs${queryString(params)}`),
}
