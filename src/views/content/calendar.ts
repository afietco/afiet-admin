/**
 * Takvim matematiği - kütüphane yok, saat dilimi SABİT.
 *
 * Plan İstanbul saatine göre yaşar: paneli başka bir saat diliminden açmak
 * "Pzt 12:30" slotunu kaydırmamalı. Bu yüzden tarayıcının yerel saati hiç
 * kullanılmaz; her dönüşüm Europe/Istanbul duvar saatinden geçer.
 *
 * İki temsil var:
 *  - "an" (instant): ISO string, DB'deki timestamptz'in aynısı
 *  - "duvar saati" (wall): İstanbul'daki yıl/ay/gün/saat/dakika
 * Gün anahtarı ('YYYY-MM-DD') hep duvar saatindendir.
 */

export const TZ = 'Europe/Istanbul'

export type Wall = { y: number; m: number; d: number; h: number; mi: number }

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

const pad = (n: number) => String(n).padStart(2, '0')

/** Bir anın İstanbul'daki duvar saati. */
export function toWall(instant: Date): Wall {
  const p: Record<string, string> = {}
  for (const { type, value } of partsFmt.formatToParts(instant)) p[type] = value
  return {
    y: Number(p.year), m: Number(p.month), d: Number(p.day),
    // Bazı ortamlar gece yarısını "24" olarak verir.
    h: Number(p.hour) % 24, mi: Number(p.minute),
  }
}

/**
 * Duvar saati → an. Offset'i iki turda düzelten klasik yöntem: Türkiye'de DST
 * yok (kalıcı UTC+3) ama kural değişirse bu hesap kendini toparlar.
 */
export function fromWall(w: Wall): Date {
  const target = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi)
  let ts = target
  for (let i = 0; i < 2; i += 1) {
    const p = toWall(new Date(ts))
    const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - ts
    ts = target - offset
  }
  return new Date(ts)
}

// ── Gün anahtarları ──────────────────────────────────────────────────────────
export type DayKey = string // 'YYYY-MM-DD' (İstanbul günü)

export const wallToKey = (w: Wall): DayKey => `${w.y}-${pad(w.m)}-${pad(w.d)}`
export const keyToWall = (key: DayKey, h = 0, mi = 0): Wall => {
  const [y, m, d] = key.split('-').map(Number)
  return { y: y!, m: m!, d: d!, h, mi }
}
export const instantToKey = (iso: string): DayKey => wallToKey(toWall(new Date(iso)))
export const todayKey = (): DayKey => wallToKey(toWall(new Date()))
/** Şu anın İstanbul'daki dakikası (bugün çizgisi için). */
export const nowMinutes = (): number => {
  const w = toWall(new Date())
  return w.h * 60 + w.mi
}

/** Anahtarı gün gün kaydır (ay/yıl sınırlarını Date'e bırakır). */
export function addDays(key: DayKey, days: number): DayKey {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export function addMonths(key: DayKey, months: number): DayKey {
  const [y, m] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1 + months, 1))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-01`
}

/** Haftanın günü: 0 = Pazartesi ... 6 = Pazar (Türkiye takvimi). */
export function weekday(key: DayKey): number {
  const [y, m, d] = key.split('-').map(Number)
  return (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7
}

export const startOfWeek = (key: DayKey): DayKey => addDays(key, -weekday(key))

/** Ay ızgarası: pazartesi başlayan 5 ya da 6 tam hafta. */
export function monthGrid(key: DayKey): DayKey[][] {
  const [y, m] = key.split('-').map(Number)
  const first = `${y}-${pad(m!)}-01`
  const daysInMonth = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  const start = startOfWeek(first)
  const needed = weekday(first) + daysInMonth
  const weeks = Math.ceil(needed / 7)
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)),
  )
}

export const weekDays = (key: DayKey): DayKey[] =>
  Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(key), i))

export const sameMonth = (a: DayKey, b: DayKey) => a.slice(0, 7) === b.slice(0, 7)

// ── Biçimlendirme (hepsi tr-TR ve İstanbul) ──────────────────────────────────
const dateFor = (key: DayKey) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!, 12)) // öğle: TZ kaymasından bağımsız etiket
}
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', ...opts })

export const WEEKDAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

export const dayNumber = (key: DayKey) => Number(key.slice(8, 10))
export const weekdayShort = (key: DayKey) => WEEKDAY_SHORT[weekday(key)]!
export const monthTitle = (key: DayKey) => fmt({ month: 'long', year: 'numeric' }).format(dateFor(key))
export const dayTitle = (key: DayKey) => fmt({ day: 'numeric', month: 'long', weekday: 'long' }).format(dateFor(key))
export const dayShort = (key: DayKey) => fmt({ day: 'numeric', month: 'short' }).format(dateFor(key))

/** "27 Tem - 2 Ağu 2026" gibi hafta başlığı. */
export function weekTitle(key: DayKey): string {
  const days = weekDays(key)
  const a = days[0]!
  const b = days[6]!
  const year = fmt({ year: 'numeric' }).format(dateFor(b))
  return `${fmt({ day: 'numeric', month: 'short' }).format(dateFor(a))} - ${fmt({ day: 'numeric', month: 'short' }).format(dateFor(b))} ${year}`
}

/** Saat etiketi: 12:30. */
export const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

/** Bir anın İstanbul saatindeki dakikası (gün içi konum). */
export function minutesOf(iso: string): number {
  const w = toWall(new Date(iso))
  return w.h * 60 + w.mi
}

/** Gün + dakika → ISO an (kaydetmeye hazır). */
export const instantFor = (key: DayKey, minutes: number): string =>
  fromWall(keyToWall(key, Math.floor(minutes / 60), minutes % 60)).toISOString()

/** DatePicker (tarayıcı yerel Date) ↔ gün anahtarı. */
export function keyFromLocalDate(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
export function localDateFromKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!, 12)
}

// ── Çakışma yerleşimi (hafta/gün ızgarası) ───────────────────────────────────
export type Positioned<T> = { item: T; minutes: number; column: number; columns: number }

/**
 * Aynı gün içinde birbirine yakın (varsayılan 45 dk) etkinlikler yan yana
 * dizilir; tek başına olan tam genişlik alır.
 */
export function layoutDay<T>(entries: { item: T; minutes: number }[], windowMinutes = 45): Positioned<T>[] {
  const sorted = [...entries].sort((a, b) => a.minutes - b.minutes)
  const out: Positioned<T>[] = []
  let group: { item: T; minutes: number }[] = []

  const flush = () => {
    group.forEach((entry, index) => {
      out.push({ ...entry, column: index, columns: group.length })
    })
    group = []
  }

  for (const entry of sorted) {
    const last = group[group.length - 1]
    if (last && entry.minutes - last.minutes < windowMinutes) group.push(entry)
    else {
      flush()
      group = [entry]
    }
  }
  flush()
  return out
}
