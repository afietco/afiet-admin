import { computed, reactive } from 'vue'
import { analyticsApi, type AnalyticsData, type Range } from '../../services/analytics'

/**
 * Analitik bölümünün ortak durumu (modül tekili). Sekmeler aynı `data` üzerinde
 * çalışır; aralık (7/30/90 gün) değişince yeniden yüklenir. Veri canlı uçtan
 * gelir; uç erişilemezse mock ÜRETİLMEZ, `data` null kalır ve sayfa placeholder
 * gösterir.
 */
const state = reactive<{ data: AnalyticsData | null; range: Range; loading: boolean }>({
  data: null,
  range: '30d',
  loading: false,
})

async function load() {
  state.loading = true
  try {
    state.data = await analyticsApi.get(state.range)
  } catch {
    state.data = null // uç yok / oturumsuz → placeholder gösterilir
  } finally {
    state.loading = false
  }
}

function setRange(range: Range) {
  if (range === state.range) return
  state.range = range
  load()
}

export function useAnalyticsStore() {
  return {
    state,
    data: computed(() => state.data),
    load,
    setRange,
  }
}

// ── Görsel yardımcılar ───────────────────────────────────────────────────────
export const fmt = (n: number) => n.toLocaleString('tr-TR')
export const pct = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 100) : 0)

/** Saniyeyi "1d 14sn" / "48sn" biçimine çevir. */
export function duration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}sn`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return s ? `${m}d ${s}sn` : `${m}d`
}

/** YYYY-MM-DD → kısa Türkçe tarih ("12 Tem"). */
export function shortDate(value: string, withYear = false): string {
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(d)
}

export const CHANNEL_TONE: Record<string, string> = {
  search: 'green', direct: 'blue', social: 'violet', referral: 'coral', campaign: 'amber',
}
