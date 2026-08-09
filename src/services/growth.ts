/**
 * Büyüme paneli veri sözleşmesi.
 *
 * Bu tipler Go backend'in `GET /v1/admin/growth` yanıtıyla BİREBİR aynıdır;
 * veri `adminApi.growth()` ile canlı uçtan gelir. Uç erişilemezse view mock
 * ÜRETMEZ, boş/placeholder durum gösterir. Tüm okuma KOHORT/TREND düzeyinde:
 * kişi-bazlı gözetleme yok (bkz. afiet-mobile/docs/feature-list/event-altyapisi.md).
 */

export type TrendPoint = { label: string; value: number }
export type FunnelStep = { key: string; label: string; value: number; hint: string }
/** rate: eylem yaptı (öğün/ölçüm/su) · openRate: uygulamayı açtı (session_start). */
export type RetentionRow = { key: 'd1' | 'd7' | 'd30'; label: string; days: number; rate: number; openRate: number; cohort: number }
export type DistRow = { bucket: string; users: number }
export type MealTypeRow = { meal: string; label: string; count: number }
export type EventStat = { key: string; label: string; value: number | null; unit?: string; live: boolean }
/** Oturum telemetrisi alışkanlık metrikleri; telemetri yayılmadıysa hepsi 0. */
export type SessionStats = {
  dau: number
  wau: number
  /**
   * ORTANCA oturum süresi (sn). Ortalama DEĞİL: duration_sec üst sınırsız,
   * arka plana atılıp ertesi gün dönülen tek bir oturum saatlerce görünüyor.
   * 9 Ağu 2026 denetiminde 130 oturumun 2'si ortalamayı 584 sn'ye çıkarmıştı,
   * ortanca oturum 59 sn'ydi. Etiketler "ortanca" demeli.
   */
  medianSessionSec: number
  sessionsPerActive: number
  fromNotificationPct: number
}
/** Ekran/sheet/dokunuş kullanım satırı (son 7 gün); medianSec süresizlerde yok. */
export type UsageRow = { key: string; count: number; medianSec?: number | null }

export type GrowthData = {
  generatedAt: string
  /** Canlı uçtan geldi mi? Backend gerçek yanıtta true döner; view erişemezse veri null kalır. */
  live: boolean
  growth: {
    totalUsers: number
    newToday: number
    new7d: number
    new30d: number
    weeklyTrend: TrendPoint[]
    /** false → UTM/ülke/dil kayıt anında toplanmıyor (henüz alan yok). */
    acquisitionTracked: boolean
  }
  /** Kayıt → ilk ölçüm (aktivasyon) → gruba katıldı → 3+ aktif gün (öğün bazlı). */
  funnel: FunnelStep[]
  retention: RetentionRow[]
  habit: {
    dau: number
    wau: number
    avgRhythmDays: number
    activeDayDistribution: DistRow[]
    mealTypes: MealTypeRow[]
    sessions: SessionStats
  }
  sofra: {
    instrumented: number
    dictionaryTotal: number
    stats: EventStat[]
    topScreens: UsageRow[]
    topSheets: UsageRow[]
    topTaps: UsageRow[]
  }
}

// ── Sofra paneli türetmesi ───────────────────────────────────────────────────
//
// GEÇMİŞ: Uç bir zamanlar `sofra.instrumented` 23/37 derken `sofra.stats`
// yalnız 6 satır döndürüyordu (elle yazılmış bir "öne çıkanlar" listesi).
// Panel o boşluğu, yanıtın içinde zaten duran event izlerinden türeterek
// kapatıyordu. Uç artık sözlüğün tamamını döndürüyor, dolayısıyla sayım
// kartları türetilmiyor: `hasCounter()` kapısı, uçta sayaç varsa türetilmişi
// hiç üretmiyor. Kapı bilerek duruyor, çünkü türetilmiş sayı ilk N'lik
// listeden toplandığı için ALT SINIR, uçtaki sayaç ise tam.
//
// Türetmeye devam eden İKİ kart var, ikisi de sayım değil SÜRE, yani uçta
// karşılıkları yok:
//
//   sheet_dwell    → topSheets içindeki medianSec (alt sayfada kalış)
//   session_length → habit.sessions.medianSessionSec (ortanca oturum süresi)
//
// Bunlar "türetilmiş" (origin: 'derived') olarak işaretlenir ve kartta kaynağı
// yazar. Uydurma sayı yok: atılmamış event atılmamış diye görünür.

/** Kart grubu. Sözlükte olup bu listede olmayan ad 'diger'e düşer. */
export type SofraCategory = 'oturum' | 'dongu' | 'denge' | 'sosyal' | 'afi' | 'bildirim' | 'diger'

export const SOFRA_CATEGORY_LABELS: Record<SofraCategory, string> = {
  oturum: 'Oturum ve gezinme',
  dongu: 'Kayıt döngüsü',
  denge: 'Denge ve ritim',
  sosyal: 'Sofra ve sosyal',
  afi: 'Afi',
  bildirim: 'Bildirim',
  diger: 'Diğer',
}

/**
 * Event adı → kategori. Backend'in `eventDictionary` listesinin tamamı burada
 * karşılanır; uç yarın 6 yerine 37 satır dönerse gruplama kendiliğinden çalışır.
 */
const CATEGORY_OF: Record<string, SofraCategory> = {
  session_start: 'oturum', session_end: 'oturum', screen_view: 'oturum',
  sheet_view: 'oturum', sheet_closed: 'oturum', ui_tap: 'oturum',
  meal_logged: 'dongu', water_logged: 'dongu', onboarding_completed: 'dongu',
  measurement_added: 'dongu',
  balance_viewed: 'denge', afiyet_day_completed: 'denge',
  move_offered: 'denge', move_done: 'denge', move_dismissed: 'denge',
  week_summary_opened: 'denge', rhythm_week_completed: 'denge',
  pause_started: 'denge', pause_ended: 'denge',
  nudge_shown: 'bildirim', nudge_acted: 'bildirim', greeting_sent: 'bildirim',
  reaction_sent: 'sosyal',
  group_public_on: 'sosyal', group_public_off: 'sosyal',
  sofra_visibility_on: 'sosyal', sofra_visibility_off: 'sosyal',
  afi_celebration_shown: 'afi', afi_assist_used: 'afi',
  afi_suggestion_accepted: 'afi', afi_suggestion_rejected: 'afi',
  afi_guide_started: 'afi', afi_guide_step_shown: 'afi',
  afi_guide_completed: 'afi', afi_guide_ended: 'afi',
  afi_food_suggest: 'afi', afi_photo_turn: 'afi',
}

export type SofraCard = {
  key: string
  label: string
  category: SofraCategory
  /** null → uçta sayı yok; kart "—" gösterir. */
  value: number | null
  unit: string
  /** 'duration' olanlar saniyedir, view `duration()` ile biçimler. */
  format: 'count' | 'duration'
  live: boolean
  /** 'stat' → uçtaki sayaç · 'derived' → yanıttan türetildi (kaynağı note'ta). */
  origin: 'stat' | 'derived'
  /** true → gösterilen sayı bir ALT SINIR (ilk 8'lik listeden toplandı). */
  atLeast: boolean
  note: string
}

export type SofraGroup = { key: SofraCategory; label: string; cards: SofraCard[] }

export type SofraRatio = { key: string; label: string; value: number; hint: string; atLeast: boolean }

export type SofraBoard = {
  groups: SofraGroup[]
  /** Uçtan `live: false` gelen sözlük kartları (soluk bölümde durur). */
  dark: SofraCard[]
  instrumented: number
  dictionaryTotal: number
  /** Panelde izi (sayısı ya da süresi) görünen tekil event adı sayısı. */
  visible: number
  /** Bağlı ama uç sayısını döndürmediği için panelde adı bile geçmeyen event. */
  countedButHidden: number
  /** Sözlükte olup hiç atılmamış event. */
  neverFired: number
  ratios: SofraRatio[]
  /** İlk 8 ekranın toplam screen_view içindeki payı (%); hesaplanamazsa null. */
  topScreenShare: number | null
}

/** Backend'in kullanım sorgularındaki `LIMIT 8`. Liste tam 8 satırsa toplam kesilmiştir. */
const USAGE_LIMIT = 8

const sumCount = (rows: UsageRow[]) => rows.reduce((s, r) => s + r.count, 0)

/**
 * Süre taşıyan satırların, açılış sayısıyla ağırlıklı tipik süresi (sn).
 *
 * Girdilerin her biri artık ortanca olduğu için sonuç aykırı değere dayanıklı:
 * tek bir uzun kalış yalnız kendi satırının ortancasını oynatabilir, tahtanın
 * tamamını değil. Satırlar arası ağırlık açılış sayısıdır, yani çok açılan alt
 * sayfa sonucu daha çok belirler.
 */
function weightedSec(rows: UsageRow[]): number | null {
  let num = 0
  let den = 0
  for (const r of rows) {
    if (r.medianSec == null || r.count <= 0) continue
    num += r.medianSec * r.count
    den += r.count
  }
  return den > 0 ? Math.round(num / den) : null
}

/**
 * Oran biçimi: 1'in altındaki değerler 1 ondalığa yuvarlanınca "0" görünüp
 * "hiç yok" gibi okunuyordu (3 dokunuş ÷ 94 oturum = 0,03). Küçük oranlarda
 * iki ondalık tutulur.
 */
const roundRatio = (n: number) => (n < 1 ? Math.round(n * 100) / 100 : Math.round(n * 10) / 10)

/**
 * Sofra panelinin kart tahtası. Kaynak YALNIZ `/v1/admin/growth` yanıtıdır;
 * hiçbir sayı uydurulmaz, türetilenlerin kaynağı kartta yazar.
 */
export function buildSofraBoard(d: GrowthData): SofraBoard {
  const s = d.sofra
  const cards: SofraCard[] = []
  const dark: SofraCard[] = []

  for (const stat of s.stats) {
    const card: SofraCard = {
      key: stat.key,
      label: stat.label,
      category: CATEGORY_OF[stat.key] ?? 'diger',
      value: stat.value,
      unit: stat.unit ?? '',
      format: 'count',
      live: stat.live,
      origin: 'stat',
      atLeast: false,
      note: 'uçtaki sayaç',
    }
    if (stat.live) cards.push(card)
    else dark.push(card)
  }

  // ── Yanıtın içinde duran, kart olarak çizilmemiş event izleri ──
  //
  // Sayım kartları YALNIZ uç o event için sayaç döndürmüyorsa türetilir. Uç
  // sözlüğün tamamını döndürmeye başlayınca (afiet-backend, sofra sözlüğü)
  // türetilmiş sayım kartı gereksizleşti ve aynı event iki kez çizilmişti;
  // üstelik türetilmiş değer ilk N'lik listeden toplandığı için ALT SINIR,
  // uçtaki sayaç ise tam. Süre kartları farklı: onlar bir sayım değil, uçta
  // hiç karşılığı olmayan ayrı bir ölçü, o yüzden kalıyorlar.
  const hasCounter = (key: string) => s.stats.some((st) => st.key === key && st.live)

  const sheetRows = s.topSheets
  if (sheetRows.length) {
    if (!hasCounter('sheet_view')) {
      cards.push({
        key: 'sheet_view', label: 'Alt sayfa açıldı', category: 'oturum',
        value: sumCount(sheetRows), unit: '/7g', format: 'count', live: true, origin: 'derived',
        atLeast: sheetRows.length >= USAGE_LIMIT,
        note: 'alt sayfa listesinden toplandı',
      })
    }
    const sec = weightedSec(sheetRows)
    if (sec !== null) {
      cards.push({
        key: 'sheet_dwell', label: 'Alt sayfada kalış', category: 'oturum',
        value: sec, unit: '', format: 'duration', live: true, origin: 'derived',
        atLeast: false,
        note: 'açılış sayısıyla ağırlıklı ortanca süre',
      })
    }
  }
  if (s.topTaps.length && !hasCounter('ui_tap')) {
    cards.push({
      key: 'ui_tap', label: 'Dokunuş', category: 'oturum',
      value: sumCount(s.topTaps), unit: '/7g', format: 'count', live: true, origin: 'derived',
      atLeast: s.topTaps.length >= USAGE_LIMIT,
      note: 'dokunuş listesinden toplandı',
    })
  }
  if (d.habit.sessions.medianSessionSec > 0) {
    cards.push({
      key: 'session_length', label: 'Ortanca oturum süresi', category: 'oturum',
      value: d.habit.sessions.medianSessionSec, unit: '', format: 'duration', live: true, origin: 'derived',
      atLeast: false,
      note: 'oturum telemetrisinden ortanca',
    })
  }

  const order: SofraCategory[] = ['oturum', 'dongu', 'denge', 'sosyal', 'afi', 'bildirim', 'diger']
  const groups: SofraGroup[] = order
    .map((key) => ({ key, label: SOFRA_CATEGORY_LABELS[key], cards: cards.filter((c) => c.category === key) }))
    .filter((g) => g.cards.length > 0)

  const visible = new Set(cards.map((c) => c.key)).size
  const byKey = (key: string) => cards.find((c) => c.key === key)
  const starts = byKey('session_start')?.value ?? 0

  const ratios: SofraRatio[] = []
  if (starts > 0) {
    const per = (card: SofraCard | undefined, label: string, hint: string) => {
      if (!card || card.value === null) return
      ratios.push({ key: card.key, label, value: roundRatio(card.value / starts), hint, atLeast: card.atLeast })
    }
    per(byKey('screen_view'), 'Ekran / oturum', 'screen_view / session_start')
    per(byKey('sheet_view'), 'Alt sayfa / oturum', 'sheet_view / session_start')
    per(byKey('ui_tap'), 'Dokunuş / oturum', 'ui_tap / session_start')
  }

  const screenTotal = byKey('screen_view')?.value ?? 0
  const topScreenShare = screenTotal > 0 && s.topScreens.length
    ? Math.round((sumCount(s.topScreens) / screenTotal) * 100)
    : null

  return {
    groups,
    dark,
    instrumented: s.instrumented,
    dictionaryTotal: s.dictionaryTotal,
    visible,
    countedButHidden: Math.max(0, s.instrumented - visible),
    neverFired: Math.max(0, s.dictionaryTotal - s.instrumented),
    ratios,
    topScreenShare,
  }
}
