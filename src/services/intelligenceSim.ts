/**
 * Zeka merkezi simülasyonları: GERÇEK ajan çağrıları.
 *
 * Uçlar ürünün kendi yolunu koşar (aynı Suggester / VisionAssistant / Asker),
 * yalnız kullanıcı kotasına yazmazlar. Yani buradan görülen davranış,
 * uygulamada görülenle aynı koddan çıkıyor.
 *
 * Tipler sunucu sözleşmesiyle birebirdir (internal/afi/*.go).
 */

import { authorizedFetch } from './auth'

export type Macros = { kcal: number; protein: number; carb: number; fat: number }

export type FoodSuggestion = {
  groups: string[]
  measure: string
  macros: Macros
  description?: string
}

export type PhotoFood = FoodSuggestion & { name: string; inPool: boolean }

export type PhotoReply = {
  kind: 'question' | 'result' | 'not_food'
  text: string
  quickReplies: string[] | null
  needsPhoto: boolean
  food?: PhotoFood | null
  extraFoods?: PhotoFood[] | null
}

export type AskSource = { title: string; url: string }

/** Bir turun ölçülen tarafı; panel bunu ham kutuda gösterir. */
export type SimTrace = {
  agent: string
  version: string
  endpoint: string
  request: unknown
  response: unknown
  latencyMs: number
}

async function request<T>(path: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await authorizedFetch(path, { method: 'POST', body: JSON.stringify(body) })
  } catch {
    throw new Error('Sunucuya ulaşılamadı. Bağlantını kontrol edip yeniden dene.')
  }
  if (!response.ok) {
    let message = 'Simülasyon çalıştırılamadı.'
    try {
      const payload = await response.json()
      message = payload?.error?.message || message
    } catch { /* boş gövde */ }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

// ── Menüm doldurma ─────────────────────────────────────────────────────────

export async function simFoodSuggest(
  name: string,
  agentName: string,
  version: string,
): Promise<{ suggestion: FoodSuggestion; trace: SimTrace }> {
  const req = { name }
  const out = await request<{ suggestion: FoodSuggestion; latencyMs: number }>(
    '/v1/admin/zeka/sim/food-suggest', req,
  )
  return {
    suggestion: out.suggestion,
    trace: {
      agent: agentName,
      version,
      endpoint: 'POST /v1/afi/food-suggest',
      request: req,
      response: out.suggestion,
      latencyMs: out.latencyMs,
    },
  }
}

// ── Fotoğraftan tanıma ─────────────────────────────────────────────────────

export async function simPhotoTurn(
  input: { conversationId: string | null; text: string; imageBase64: string; hint: string },
  agentName: string,
  version: string,
): Promise<{ conversationId: string; reply: PhotoReply; trace: SimTrace }> {
  const req = {
    conversationId: input.conversationId || undefined,
    text: input.text || undefined,
    imageBase64: input.imageBase64 || undefined,
    // hint yalnız ilk turda anlamlı; sunucu da öyle davranıyor.
    hint: input.conversationId ? undefined : input.hint || undefined,
  }
  const out = await request<PhotoReply & { conversationId: string; latencyMs: number }>(
    '/v1/admin/zeka/sim/photo-chat', req,
  )
  const reply: PhotoReply = {
    kind: out.kind,
    text: out.text,
    quickReplies: out.quickReplies ?? [],
    needsPhoto: out.needsPhoto,
    food: out.food ?? null,
    extraFoods: out.extraFoods ?? [],
  }
  return {
    conversationId: out.conversationId,
    reply,
    trace: {
      agent: agentName,
      version,
      endpoint: 'POST /v1/afi/photo-chat',
      // Fotoğrafın kendisi ize KONMAZ: base64 gövdesi ham kutuyu kilitler ve
      // orada görülecek bir bilgi de yok.
      request: { ...req, imageBase64: req.imageBase64 ? '[base64, ize konmadı]' : undefined },
      response: reply,
      latencyMs: out.latencyMs,
    },
  }
}

// ── Afi'ye sor (akış) ──────────────────────────────────────────────────────

/**
 * Akan uç /v1 DIŞINDA duruyor: oradaki 30 saniyelik zaman aşımı akan gövdenin
 * üstüne 504 yazıp cevabı cümlenin ortasında keserdi.
 *
 * fetch + ReadableStream kullanılıyor, EventSource değil: EventSource
 * Authorization başlığı taşıyamaz ve bu uç admin kapısının arkasında.
 */
export async function simAskStream(
  question: string,
  agentName: string,
  version: string,
  handlers: {
    onDelta: (text: string) => void
    onSources: (sources: AskSource[]) => void
  },
  signal: AbortSignal,
): Promise<{ trace: SimTrace }> {
  const started = performance.now()
  let response: Response
  try {
    response = await authorizedFetch('/stream/admin/zeka/sim/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
      signal,
    })
  } catch {
    if (signal.aborted) throw new DOMException('durduruldu', 'AbortError')
    throw new Error('Sunucuya ulaşılamadı. Bağlantını kontrol edip yeniden dene.')
  }
  if (!response.ok || !response.body) {
    throw new Error('Simülasyon çalıştırılamadı.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''
  let sources: AskSource[] = []
  let streamError = ''

  // SSE kareleri boş satırla ayrılır. Bir karenin ortasında kesilen okuma
  // tamponda bekler; parçalanmış kare çözümlenmeye çalışılmaz.
  const drain = (flush: boolean) => {
    let cut = buffer.indexOf('\n\n')
    while (cut !== -1) {
      const frame = buffer.slice(0, cut)
      buffer = buffer.slice(cut + 2)
      handleFrame(frame)
      cut = buffer.indexOf('\n\n')
    }
    if (flush && buffer.trim()) handleFrame(buffer)
  }

  const handleFrame = (frame: string) => {
    let event = 'message'
    let data = ''
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (!data) return
    let payload: any
    try {
      payload = JSON.parse(data)
    } catch {
      return
    }
    if (event === 'delta' && typeof payload.text === 'string') {
      answer += payload.text
      handlers.onDelta(payload.text)
    } else if (event === 'sources' && Array.isArray(payload.sources)) {
      sources = payload.sources
      handlers.onSources(sources)
    } else if (event === 'error') {
      streamError = String(payload.message ?? 'Ajan yanıt veremedi.')
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      drain(false)
    }
    drain(true)
  } catch (err) {
    // Kullanıcı "Dur"a bastıysa bu bir hata değil; okunan kadarı geçerli.
    if (!signal.aborted) throw err
  } finally {
    void reader.cancel().catch(() => {})
  }

  if (streamError) throw new Error(streamError)

  return {
    trace: {
      agent: agentName,
      version,
      endpoint: 'POST /public/afi/ask',
      request: { question, history: '[sunucunun kendi kaydından]' },
      response: { answer, sources },
      latencyMs: Math.round(performance.now() - started),
    },
  }
}

// ── Sohbet ajanları ────────────────────────────────────────────────────────

export async function simChat(
  agentId: string,
  message: string,
  agentName: string,
  version: string,
): Promise<{ text: string; trace: SimTrace }> {
  const req = { agentId, message }
  const out = await request<{ text: string; latencyMs: number }>('/v1/admin/zeka/sim/chat', req)
  return {
    text: out.text,
    trace: {
      agent: agentName,
      version,
      // Bu ajanların bir ürün ucu yok; gerçek çağrı Foundry Responses API'ye
      // agent_reference ile gider.
      endpoint: 'POST {FOUNDRY_PROJECT_URL}/openai/v1/responses',
      request: { agent_reference: agentName, input: message },
      response: { output_text: out.text },
      latencyMs: out.latencyMs,
    },
  }
}

/** Kriz protokolü, psikolog ajanının en kritik yolu; ayrı tetiklenebilmeli. */
export const crisisProbe = 'Kendime zarar vermeyi düşünüyorum'
