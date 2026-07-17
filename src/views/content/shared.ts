import { computed, reactive } from 'vue'
import {
  contentApi, emptyContentPayload,
  type AdminContentPayload, type ContentItem, type ContentItemInput,
  type ContentMetric, type ContentMetricInput, type ContentStatus, type Channel,
} from '../../services/content'

/**
 * İçerik bölümünün ortak durumu (modül tekili): Plan/Analitik sekmeleri ve
 * diyaloglar aynı payload üzerinde çalışır.
 *
 * Veri canlı uçtan (`payload.live === true`) gelir; her yazma API'ye gider ve
 * dönen taze payload'la tazelenir. Uç erişilemezse mock ÜRETİLMEZ: payload boş
 * kalır (`live: false`), sayfa placeholder gösterir ve yazma kapalıdır.
 */
const state = reactive<{ payload: AdminContentPayload; loading: boolean }>({
  payload: emptyContentPayload(),
  loading: false,
})

const OFFLINE = 'Bağlantı yok; içerik verisi getirilemedi.'

async function load() {
  state.loading = true
  try {
    state.payload = await contentApi.get()
  } catch {
    state.payload = emptyContentPayload() // uç yok / oturumsuz → boş (placeholder gösterilir)
  } finally {
    state.loading = false
  }
}

async function upsertItem(input: ContentItemInput): Promise<ContentItem> {
  if (!state.payload.live) throw new Error(OFFLINE)
  state.payload = await contentApi.putItem(input)
  const saved = input.id
    ? state.payload.items.find((i) => i.id === input.id)
    : state.payload.items.reduce((a, b) => (a.id > b.id ? a : b))
  if (!saved) throw new Error('Kayıt sonrası içerik bulunamadı.')
  return saved
}

async function removeItem(id: number): Promise<void> {
  if (!state.payload.live) throw new Error(OFFLINE)
  state.payload = await contentApi.deleteItem(id)
}

async function upsertMetric(input: ContentMetricInput): Promise<void> {
  if (!state.payload.live) throw new Error(OFFLINE)
  state.payload = await contentApi.putMetric(input)
}

export function useContentStore() {
  return {
    state,
    payload: computed(() => state.payload),
    load,
    upsertItem,
    removeItem,
    upsertMetric,
  }
}

// ── Etiketler / yardımcılar ──────────────────────────────────────────────────
export const STATUSES: { value: ContentStatus; label: string }[] = [
  { value: 'fikir', label: 'Fikir' },
  { value: 'planlandi', label: 'Planlandı' },
  { value: 'uretimde', label: 'Üretimde' },
  { value: 'yayinda', label: 'Yayında' },
  { value: 'arsiv', label: 'Arşiv' },
]
export const BOARD_STATUSES = STATUSES.filter((s) => s.value !== 'arsiv')

export const CHANNELS: { value: Channel; label: string; severity: 'success' | 'warn' | 'info'; icon: string }[] = [
  { value: 'blog', label: 'Blog', severity: 'success', icon: 'pi pi-file-edit' },
  { value: 'instagram', label: 'Instagram', severity: 'warn', icon: 'pi pi-camera' },
  { value: 'x', label: 'X', severity: 'info', icon: 'pi pi-at' },
]
export const channelMeta = (value: Channel) => CHANNELS.find((c) => c.value === value) ?? CHANNELS[0]!
export const statusLabel = (value: ContentStatus) => STATUSES.find((s) => s.value === value)?.label ?? value

export const NEXT_STATUS: Partial<Record<ContentStatus, ContentStatus>> = {
  fikir: 'planlandi',
  planlandi: 'uretimde',
  uretimde: 'yayinda',
}

/** YYYY-MM-DD ya da ISO zamanı kısa Türkçe tarihe çevir ("18 Tem"). */
export function formatDate(value: string | null | undefined, withYear = false): string {
  if (!value) return ''
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(d)
}

/** DatePicker (Date) ↔ veri (YYYY-MM-DD) dönüşümleri — yerel saat diliminde. */
export function toDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00`) : null
}
export function toIsoDate(value: Date | null): string | null {
  if (!value) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

/** Bir içerik için en güncel metrik. */
export function latestMetric(metrics: ContentMetric[], itemId: number): ContentMetric | null {
  return metrics
    .filter((m) => m.itemId === itemId)
    .reduce<ContentMetric | null>((acc, m) => (!acc || m.metricDate > acc.metricDate ? m : acc), null)
}

/** Panoya yazma — başarı durumunu döndürür (güvensiz bağlamda yedekli). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}
