/**
 * Görev kademeleri ve kademe metrikleri (MOCK).
 *
 * ── Neden bu dosya var ────────────────────────────────────────────────────
 * Bugün sunucu tek eşikli görev döner: bir `target`, bir `xpReward`. Kullanıcı
 * "her görev üç kademeli olsun, her kademede tecrübe ve ikram kesesi artsın"
 * dedi. Bu dosya o öneriyi TİP olarak yazar ve panelin bugün gösterdiği
 * sayıları YEREL olarak üretir. Hiçbir uç çağrılmaz, API sözleşmesi
 * değişmez; ekranda "veri canlı değil" rozetiyle birlikte durur.
 *
 * ── Adlandırma kararı ─────────────────────────────────────────────────────
 * Kademe adları zorluk sözcüğü değil (easy/medium/hard ekranda hiç geçmez).
 * afiet'in dili mutfak dilidir; kademeler mutfakta ustalaşmanın bilinen üç
 * basamağını ödünç alır:
 *
 *   Çırak → Kalfa → Usta
 *
 * Üçü de aynı metriği sayar; değişen yalnız eşiğin büyüklüğüdür. Bu yüzden
 * aksiyon düğmesi de üç kademede aynıdır (bkz. questActions.ts).
 *
 * ── BACKEND BUNU ŞÖYLE DÖNMELİ ────────────────────────────────────────────
 * GET /v1/admin/quests bugünkü gövdeyi korur, iki alan ekler:
 *
 *   quests[].tiers: QuestTier[]        // tam 3 satır, artan sırada
 *   quests[].reach: QuestReach | null  // kademe metrikleri, hesaplanmadıysa null
 *
 * Kurallar:
 *  1. `tiers` her zaman 3 uzunluğunda ve `key` sırası cirak → kalfa →
 *     usta. Sıra dizinin kendisinden okunur, ayrı bir `order` alanı yok.
 *  2. `target`, `xpReward`, `pouchReward` üç kademede de KESİN ARTAN. Sunucu
 *     bunu doğrulamalı; eşit ya da azalan bir merdiven 422 dönmeli, çünkü
 *     ikinci kademesi birincisinden ucuz bir görev kullanıcıda geri gitme
 *     hissi yaratır.
 *  3. `metric` ve `scope` görevin kendisinde kalır: kademeler aynı sayacı
 *     paylaşır, yalnız eşiği değiştirir. Kademe başına metrik YOK.
 *  4. Kullanıcı ilerlemesi tek sayaçtır; hangi kademede olduğu sayacın hangi
 *     eşiği geçtiğiyle belirlenir. Yani mevcut `quest_progress` tablosu
 *     değişmeden kalabilir, yalnız "alındı" kaydı kademe anahtarını taşımalı.
 *  5. Mevcut tek eşikli görevler göçte birinci kademeye yerleşir
 *     (target/xpReward olduğu gibi cirak olur); üst iki kademe migration'da
 *     üretilir ya da panelden yazılır.
 *
 * POST/PUT gövdesi `tiers` alır; `target` ve `xpReward` kök alanları geriye
 * dönük uyum için birinci kademenin aynası olarak kalabilir.
 *
 * ── İkram kesesi birimi ───────────────────────────────────────────────────
 * `pouchReward` PARA DEĞİL. Kese, haftalık Afi sohbeti hakkıdır ve boyutunu
 * lig kademesi belirler; görev ödülü o haftanın kesesine eklenen sohbet
 * hakkı adedidir. Panelde de "sohbet hakkı" diye yazılır, hiçbir yerde
 * "puan" ya da "jeton" denmez.
 */

export type QuestTierKey = 'cirak' | 'kalfa' | 'usta'

/** Kademe tanımı. Görev başına tam üç tane, artan sırada. */
export type QuestTier = {
  key: QuestTierKey
  /** Aynı metrik, artan eşik. çırak < kalfa < usta. */
  target: number
  /** Kademe alındığında yazılan tecrübe. Artan. */
  xpReward: number
  /** O haftanın ikram kesesine eklenen Afi sohbeti hakkı adedi. Artan. */
  pouchReward: number
}

/**
 * Kademe başına admin metrikleri.
 *
 * Huni tanımı (sunucu da bunu hesaplamalı): bir kademeye "erişen", bir
 * önceki kademeyi TAMAMLAMIŞ kullanıcıdır. Birinci kademeye erişen ise
 * görevi listede görmüş herkes. Böylece erişim sayıları doğası gereği azalan
 * olur ve oranlar kendi paydasına göre okunur.
 */
export type QuestTierStats = {
  /** Bu kademenin kilidi açılmış kullanıcı sayısı. */
  reachedUsers: number
  /** reachedUsers / audience (0..1). "Kullanıcıların % kaçı buraya geldi." */
  reachedShare: number
  /** Bu kademeyi tamamlayıp ödülü almış kullanıcı sayısı. */
  completedUsers: number
  /** completedUsers / reachedUsers (0..1). Erişenlerin içindeki tamamlama. */
  completionRate: number
  /** Erişimden tamamlamaya geçen ortanca gün; kimse tamamlamadıysa null. */
  medianDaysToComplete: number | null
}

export type QuestTierWithStats = QuestTier & { stats: QuestTierStats }

export type QuestReach = {
  /** Oranların paydası: görevi görebilen aktif kullanıcı havuzu. */
  audience: number
  tiers: QuestTierWithStats[]
  /** Sunucu hesabının tazeliği; panel "şu tarihten beri" yazabilsin diye. */
  computedAt: string
}

export const TIER_ORDER: QuestTierKey[] = ['cirak', 'kalfa', 'usta']

export const TIER_META: Record<QuestTierKey, { label: string; glyph: string; blurb: string }> = {
  cirak: {
    label: 'Çırak',
    glyph: '🥄',
    blurb: 'İlk kademe. Bir oturuşta erişilir, alışkanlığın kapısını aralar.',
  },
  kalfa: {
    label: 'Kalfa',
    glyph: '🍳',
    blurb: 'Eli işe alışmış kademe. Birkaç haftalık ritim ister.',
  },
  usta: {
    label: 'Usta',
    glyph: '👨‍🍳',
    blurb: 'En geniş kademe. Uzun soluklu, anlatmaya değer.',
  },
}

export const tierLabel = (key: QuestTierKey) => TIER_META[key].label

/** Eşikleri okunur sayılara yuvarlar: 27 yerine 25, 83 yerine 80. */
function roundNice(value: number) {
  if (value <= 12) return Math.round(value)
  if (value <= 60) return Math.round(value / 5) * 5
  return Math.round(value / 10) * 10
}

/**
 * Tek eşikten üç eşitlik merdiveni türetir.
 *
 * Panel bugün kademeleri kaydedemediği için merdiven mevcut `target` ve
 * `xpReward`'dan hesaplanır: mevcut değer birinci kademe olur, üstü çarpanla
 * açılır. Backend kademeleri döndüğünde bu fonksiyon yalnız YENİ görev
 * taslağı için varsayılan üretmeye devam eder.
 */
export function tierLadder(target: number, xpReward: number): QuestTier[] {
  const baseTarget = Math.max(1, Math.round(target || 1))
  const baseXp = Math.max(5, Math.round(xpReward || 5))
  const targets = [baseTarget, roundNice(baseTarget * 3), roundNice(baseTarget * 8)]
  const xps = [baseXp, roundNice(baseXp * 2.5), roundNice(baseXp * 6)]
  const pouches = [1, 2, 4]
  return TIER_ORDER.map((key, index) => ({
    key,
    // Kesin artan olmalı: küçük tabanlarda yuvarlama iki kademeyi eşitleyebilir.
    target: Math.max(targets[index], index === 0 ? 1 : targets[index - 1] + 1),
    xpReward: Math.max(xps[index], index === 0 ? 5 : xps[index - 1] + 5),
    pouchReward: pouches[index],
  }))
}

/* ── Mock huni ───────────────────────────────────────────────────────────── */

/** FNV-1a: aynı görev her yüklemede aynı sayıları göstersin diye. */
function seedOf(text: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Görev için sahte erişim hunisi üretir.
 *
 * Deterministik: anahtar aynıysa sayı da aynı, sayfa her yenilendiğinde
 * oynamaz. Model dürüst kurulur (bir kademeye erişen = bir öncekini
 * tamamlayan), böylece ekrandaki oranlar canlı veriye geçtiğinde okuma
 * alışkanlığı değişmez.
 */
export function mockReach(quest: { key: string; target: number; xpReward: number }): QuestReach {
  const random = mulberry32(seedOf(quest.key || 'gorev'))
  const tiers = tierLadder(quest.target, quest.xpReward)
  const audience = 380 + Math.floor(random() * 520)

  let reached = Math.round(audience * (0.55 + random() * 0.32))
  let rate = 0.6 + random() * 0.28
  let days = 2 + Math.round(random() * 6)

  const withStats = tiers.map((tier, index) => {
    if (index > 0) {
      rate *= 0.5 + random() * 0.28
      days = Math.round(days * (2 + random()))
    }
    const completed = Math.round(reached * rate)
    const stats: QuestTierStats = {
      reachedUsers: reached,
      reachedShare: audience > 0 ? reached / audience : 0,
      completedUsers: completed,
      completionRate: reached > 0 ? completed / reached : 0,
      medianDaysToComplete: completed > 0 ? days : null,
    }
    // Sıradaki kademeye ancak bunu tamamlayan erişir.
    reached = completed
    return { ...tier, stats }
  })

  return { audience, tiers: withStats, computedAt: new Date().toISOString() }
}

/* ── Biçimleyiciler ──────────────────────────────────────────────────────── */

export const percent = (ratio: number) => `%${Math.round(ratio * 100)}`
export const countLabel = (value: number) => value.toLocaleString('tr-TR')
export const pouchLabel = (count: number) => `${count} sohbet hakkı`
export const daysLabel = (days: number | null) =>
  days === null ? 'tamamlanmadı' : `${days} gün`
