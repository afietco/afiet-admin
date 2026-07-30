import { computed, reactive } from 'vue'
import {
  contentApi, emptyContentPayload, mimeForFile, uploadToBucket,
  type AdminContentPayload, type AttachmentKind, type Channel, type ContentAttachment, type ContentFormat,
  type ContentItem, type ContentItemInput, type ContentMetric, type ContentMetricInput, type ContentStatus,
} from '../../services/content'

/**
 * İçerik bölümünün ortak durumu (modül tekili): Takvim/Plan/Analitik sekmeleri
 * ve diyaloglar aynı payload üzerinde çalışır.
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
const NO_STORAGE = 'Ek deposu bağlı değil (web tarafında GCS anahtarı yok).'

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

/** Sürükle-bırak: yalnız zamanı taşır (diğer alanlar kazara ezilmesin). */
async function moveItem(id: number, plannedAt: string, allDay: boolean): Promise<void> {
  if (!state.payload.live) throw new Error(OFFLINE)
  state.payload = await contentApi.move(id, plannedAt, allDay)
}

async function upsertMetric(input: ContentMetricInput): Promise<void> {
  if (!state.payload.live) throw new Error(OFFLINE)
  state.payload = await contentApi.putMetric(input)
}

/**
 * Ek yükleme üç adım: bilet al → dosyayı DOĞRUDAN kovaya PUT et → doğrula.
 * Ortadaki adım bizim sunucumuzdan geçmez; yarıda kalırsa doğrulama adımı
 * bekleyen satırı temizler (uç 422 döner).
 */
async function uploadAttachment(itemId: number, file: File, onProgress?: (p: number) => void): Promise<void> {
  if (!state.payload.live) throw new Error(OFFLINE)
  if (!state.payload.storageReady) throw new Error(NO_STORAGE)
  const mime = mimeForFile(file)
  if (!mime) throw new Error(`"${file.name}" desteklenmiyor. mp4, mov, png, jpg, webp, gif ya da pdf olmalı.`)

  const ticket = await contentApi.ticket({ itemId, fileName: file.name, mime, sizeBytes: file.size })
  await uploadToBucket(ticket.uploadUrl, file, ticket.contentType, onProgress)
  state.payload = await contentApi.confirmAttachment(ticket.attachmentId)
}

async function removeAttachment(id: number): Promise<void> {
  if (!state.payload.live) throw new Error(OFFLINE)
  state.payload = await contentApi.deleteAttachment(id)
}

/** İmzalı URL alıp tarayıcıya açtırır (indir: kaydeder, önizleme: sekmede açar). */
async function openAttachment(id: number, mod: 'indir' | 'onizleme'): Promise<void> {
  const { url } = await contentApi.attachmentUrl(id, mod)
  if (mod === 'indir') {
    const link = document.createElement('a')
    link.href = url
    link.rel = 'noopener'
    link.click()
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

/** Görsel önizlemesi için imzalı URL (15 dk geçerli). */
async function previewUrl(id: number): Promise<string> {
  const { url } = await contentApi.attachmentUrl(id, 'onizleme')
  return url
}

export function useContentStore() {
  return {
    state,
    payload: computed(() => state.payload),
    load,
    upsertItem,
    removeItem,
    moveItem,
    upsertMetric,
    uploadAttachment,
    removeAttachment,
    openAttachment,
    previewUrl,
  }
}

// ── Düzenleyici (tek diyalog, iki sekme onu çağırır) ─────────────────────────
/**
 * Etkinlik diyaloğu ContentView'da BİR kez render edilir; Takvim ve Plan
 * sekmeleri bu durumu açar. Yeni kayıtta `defaults` takvimde tıklanan
 * slotu (platform + an) taşır.
 */
export type EditorDefaults = { channel?: Channel; plannedAt?: string | null; allDay?: boolean }

const editor = reactive<{ open: boolean; item: ContentItem | null; defaults: EditorDefaults }>({
  open: false,
  item: null,
  defaults: {},
})

export function openEditor(item: ContentItem | null, defaults: EditorDefaults = {}) {
  editor.item = item
  editor.defaults = defaults
  editor.open = true
}

export function useEditor() {
  return editor
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

/**
 * Platformlar. `tone` takvimdeki renk sınıfını verir (CSS'te .pf-<tone>),
 * `severity` PrimeVue Tag'i içindir.
 */
export const CHANNELS: {
  value: Channel
  label: string
  severity: 'success' | 'warn' | 'info' | 'danger' | 'secondary'
  icon: string
  tone: string
}[] = [
  { value: 'instagram', label: 'Instagram', severity: 'warn', icon: 'pi pi-camera', tone: 'insta' },
  { value: 'blog', label: 'Blog', severity: 'success', icon: 'pi pi-file-edit', tone: 'blog' },
  { value: 'x', label: 'X', severity: 'info', icon: 'pi pi-at', tone: 'x' },
  { value: 'tiktok', label: 'TikTok', severity: 'secondary', icon: 'pi pi-music', tone: 'tiktok' },
  { value: 'youtube', label: 'YouTube', severity: 'danger', icon: 'pi pi-youtube', tone: 'youtube' },
]

export const FORMATS: { value: ContentFormat; label: string; icon: string }[] = [
  { value: 'yazi', label: 'Yazı', icon: 'pi pi-file-edit' },
  { value: 'reel', label: 'Reel', icon: 'pi pi-video' },
  { value: 'carousel', label: 'Carousel', icon: 'pi pi-images' },
  { value: 'story', label: 'Story', icon: 'pi pi-mobile' },
  { value: 'post', label: 'Gönderi', icon: 'pi pi-comment' },
  { value: 'shorts', label: 'Shorts', icon: 'pi pi-video' },
  { value: 'video', label: 'Video', icon: 'pi pi-play' },
]

export const channelMeta = (value: Channel) => CHANNELS.find((c) => c.value === value) ?? CHANNELS[0]!
export const formatMeta = (value: ContentFormat) => FORMATS.find((f) => f.value === value) ?? FORMATS[0]!
export const statusLabel = (value: ContentStatus) => STATUSES.find((s) => s.value === value)?.label ?? value

export const NEXT_STATUS: Partial<Record<ContentStatus, ContentStatus>> = {
  fikir: 'planlandi',
  planlandi: 'uretimde',
  uretimde: 'yayinda',
}

/** Marka kuralı: bir gönderide en fazla 5 etiket (üstü panelde uyarı olur). */
export const HASHTAG_SOFT_LIMIT = 5

export const ATTACHMENT_ICON: Record<AttachmentKind, string> = {
  video: 'pi pi-video',
  gorsel: 'pi pi-image',
  pdf: 'pi pi-file-pdf',
}

/** 1.2 MB / 940 KB gibi kısa boyut. */
export function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/** YYYY-MM-DD ya da ISO zamanı kısa Türkçe tarihe çevir ("18 Tem"). */
export function formatDate(value: string | null | undefined, withYear = false): string {
  if (!value) return ''
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(d)
}

/** DatePicker (Date) ↔ veri (YYYY-MM-DD) dönüşümleri - yerel saat diliminde. */
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

/** Bir içeriğe bağlı ekler (bekleyenler dahil, sırayla). */
export function attachmentsFor(attachments: ContentAttachment[], itemId: number): ContentAttachment[] {
  return attachments.filter((a) => a.itemId === itemId)
}

/** Panoya yazma - başarı durumunu döndürür (güvensiz bağlamda yedekli). */
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
