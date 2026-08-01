import type { ContentItem, ContentMetricInput } from '../../services/content'

/**
 * Dışa aktarım dosyasından ölçüm okuma (Meta Business Suite > Insights >
 * Content > Export Data).
 *
 * Neden panelde ayrıştırıyoruz: dosya küçük, sunucuya göndermeye gerek yok ve
 * eşleştirmeyi kullanıcı ONAYLAMADAN hiçbir şey yazılmıyor.
 *
 * Gerçek dünya kırılganlıkları (hepsi burada karşılanır):
 *  - ayraç virgül OLMAYABİLİR: Türkçe Excel ';', bazı dışa aktarımlar sekme
 *  - başlıklar hesabın diline göre değişir (Views / Görüntülemeler …)
 *  - sayılar binlik ayraçlı gelir ("1.234", "1,234") ve "-" boş demektir
 *  - alanlar tırnaklı ve içinde ayraç/satır sonu olabilir (caption!)
 *  - dosya BOM ile başlayabilir
 *
 * Başlık tanınmazsa SESSİZ GEÇMEZ: bulunan başlıkları geri döndürür, panel
 * bunları gösterir (mapping'i genişletmek için gereken tek bilgi budur).
 */

// ── CSV ayrıştırma ───────────────────────────────────────────────────────────
/** Ayracı ilk satırdaki adaylara bakarak seçer. */
function sniffDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'))
  const counts = [',', ';', '\t'].map((d) => ({ d, n: firstLine.split(d).length - 1 }))
  return counts.sort((a, b) => b.n - a.n)[0]!.n > 0 ? counts.sort((a, b) => b.n - a.n)[0]!.d : ','
}

/** RFC 4180 benzeri ayrıştırma: tırnak içinde ayraç ve satır sonu korunur. */
export function parseDelimited(raw: string): string[][] {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const delimiter = sniffDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

// ── Başlık eşleme ────────────────────────────────────────────────────────────
/**
 * Bilinen başlık karşılıkları (küçük harfe indirgenmiş, kısmi eşleşme).
 * Dosyanın dili hesabın diline bağlı; ikisini de tanırız.
 */
const HEADERS: Record<string, string[]> = {
  permalink: ['permalink', 'link', 'post link', 'bağlantı', 'baglanti', 'gönderi bağlantısı', 'url'],
  postId: ['post id', 'media id', 'gönderi kimliği', 'gonderi kimligi', 'id'],
  publishedAt: ['publish time', 'date', 'yayınlanma', 'yayinlanma', 'tarih', 'publish date'],
  caption: ['description', 'caption', 'açıklama', 'aciklama', 'başlık', 'baslik'],
  views: ['views', 'plays', 'görüntüleme', 'goruntuleme', 'izlenme', 'gösterim'],
  reach: ['reach', 'accounts reached', 'erişim', 'erisim'],
  likes: ['likes', 'beğeni', 'begeni'],
  comments: ['comments', 'yorum'],
  shares: ['shares', 'sends', 'paylaşım', 'paylasim'],
  saves: ['saves', 'saved', 'kaydetme', 'kaydedilme'],
}

const norm = (value: string) => value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ')

/** Başlık satırındaki kolon adlarını alan adlarına bağlar. */
export function mapHeaders(header: string[]): Record<string, number> {
  const found: Record<string, number> = {}
  header.forEach((raw, index) => {
    const cell = norm(raw)
    if (!cell) return
    for (const [field, aliases] of Object.entries(HEADERS)) {
      if (field in found) continue
      if (aliases.some((alias) => cell === alias || cell.includes(alias))) found[field] = index
    }
  })
  return found
}

/**
 * Meta bazen üstte başlık/boş satırlar koyuyor: gerçek başlık satırı, en çok
 * alanı tanıyabildiğimiz ilk 5 satırdır.
 */
export function findHeaderRow(rows: string[][]): { index: number; map: Record<string, number> } {
  let best = { index: 0, map: {} as Record<string, number>, score: -1 }
  rows.slice(0, 5).forEach((row, index) => {
    const map = mapHeaders(row)
    const score = Object.keys(map).length
    if (score > best.score) best = { index, map, score }
  })
  return { index: best.index, map: best.map }
}

/** "1.234" / "1,234" / "-" / "" → sayı. Ölçümler tam sayı, ayraçlar atılır. */
export function parseCount(value: string | undefined): number {
  if (!value) return 0
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = Number(digits)
  return Number.isFinite(n) ? n : 0
}

/**
 * Gönderi bağlantısını karşılaştırılabilir hale getirir.
 *
 * Instagram bağlantısı kısa koda indirgenir: aynı gönderi www'lu/www'suz,
 * şemalı/şemasız, kullanıcı adlı (instagram.com/afiet.co/reel/KOD) ya da
 * sorgulu (?igsh=…) biçimde yapıştırılabiliyor; Meta dışa aktarımı ise hep
 * https://www.instagram.com/reel/KOD/ yazar. Tam dize karşılaştırması bu
 * varyantların hepsinde sessizce 0 eşleşme üretir (1 Ağu aktarımı: 0/10).
 * Instagram dışı bağlantılarda şema, www, sorgu ve sondaki '/' atılır.
 */
export function normalizeLink(value: string | null | undefined): string {
  if (!value) return ''
  const raw = value.trim().split('?')[0]!.replace(/\/+$/, '').toLowerCase()
  if (!raw) return ''
  const shortcode = raw.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([a-z0-9_-]+)/)
  if (shortcode) return `ig:${shortcode[1]}`
  return raw.replace(/^https?:\/\//, '').replace(/^www\./, '')
}

// ── Eşleştirme ───────────────────────────────────────────────────────────────
export type ImportRow = {
  /** Dosyadaki satır numarası (kullanıcıya göstermek için). */
  line: number
  permalink: string
  postId: string
  caption: string
  views: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  /** Eşleşen takvim etkinliği (yoksa null). */
  item: ContentItem | null
}

export type ImportResult = {
  rows: ImportRow[]
  matched: ImportRow[]
  unmatched: ImportRow[]
  /** Dosyada bulunan başlıklar - eşleme tutmazsa kullanıcıya gösterilir. */
  headers: string[]
  mapped: string[]
  /** Ayrıştırma hiç yürümediyse sebebi. */
  error: string | null
}

/**
 * Dosyayı çözümler ve satırları takvim etkinlikleriyle eşler.
 * Eşleştirme yalnız gönderi bağlantısı / platform kimliği ile yapılır -
 * başlık benzerliğine BAKILMAZ (yanlış eşleşme eşleşmemekten kötüdür).
 */
export function buildImport(text: string, items: ContentItem[]): ImportResult {
  const rows = parseDelimited(text)
  if (!rows.length) {
    return { rows: [], matched: [], unmatched: [], headers: [], mapped: [], error: 'Dosya boş görünüyor.' }
  }
  const { index, map } = findHeaderRow(rows)
  const headers = (rows[index] ?? []).map((h) => h.trim()).filter(Boolean)
  const mapped = Object.keys(map)

  if (map.permalink === undefined && map.postId === undefined) {
    return {
      rows: [], matched: [], unmatched: [], headers, mapped,
      error: 'Dosyada gönderi bağlantısı (permalink) ya da gönderi kimliği kolonu bulunamadı.',
    }
  }
  if (map.views === undefined && map.reach === undefined && map.likes === undefined) {
    return { rows: [], matched: [], unmatched: [], headers, mapped, error: 'Dosyada ölçüm kolonu bulunamadı.' }
  }

  const byLink = new Map<string, ContentItem>()
  const byId = new Map<string, ContentItem>()
  for (const item of items) {
    const link = normalizeLink(item.publishedUrl)
    if (link) byLink.set(link, item)
    if (item.platformPostId) byId.set(item.platformPostId, item)
  }

  const cell = (row: string[], key: string) => (map[key] === undefined ? '' : (row[map[key]!] ?? '').trim())
  const out: ImportRow[] = []
  rows.slice(index + 1).forEach((row, offset) => {
    const permalink = cell(row, 'permalink')
    const postId = cell(row, 'postId')
    if (!permalink && !postId) return
    const item = byId.get(postId) ?? byLink.get(normalizeLink(permalink)) ?? null
    out.push({
      line: index + offset + 2,
      permalink,
      postId,
      caption: cell(row, 'caption'),
      views: parseCount(cell(row, 'views')),
      reach: parseCount(cell(row, 'reach')),
      likes: parseCount(cell(row, 'likes')),
      comments: parseCount(cell(row, 'comments')),
      shares: parseCount(cell(row, 'shares')),
      saves: parseCount(cell(row, 'saves')),
      item,
    })
  })

  return {
    rows: out,
    matched: out.filter((r) => r.item),
    unmatched: out.filter((r) => !r.item),
    headers,
    mapped,
    error: out.length ? null : 'Dosyada okunabilir satır bulunamadı.',
  }
}

/** Eşleşen satırları yazmaya hazır ölçümlere çevir (anlık görüntü tarihi verilir). */
export function toMetrics(rows: ImportRow[], metricDate: string): ContentMetricInput[] {
  return rows
    .filter((r) => r.item)
    .map((r) => ({
      itemId: r.item!.id,
      metricDate,
      views: r.views,
      likes: r.likes,
      comments: r.comments,
      shares: r.shares,
      saves: r.saves,
      clicks: 0,
      reach: r.reach,
      interactions: r.likes + r.comments + r.shares + r.saves,
      notes: '',
      source: 'csv' as const,
    }))
}
