/**
 * Görev kademelerinin panel tarafı: adlandırma, varsayılan merdiven ve
 * biçimleyiciler.
 *
 * TİPLER BURADA DEĞİL, `services/admin.ts`te: kademeler ve huni 13 Ağu
 * 2026'da gerçek uçtan gelmeye başladı (`GET /v1/admin/quests`) ve tipin
 * kaynağı uçtur. Bu dosyada bir zamanlar duran yerel `mockReach` üreticisi
 * SİLİNDİ; ekranlar artık `quest.reach`i okuyor, hesaplanamadıysa boş durum
 * gösteriyor.
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
 * ── İkram kesesi birimi ───────────────────────────────────────────────────
 * `pouchReward` PARA DEĞİL. Kese, haftalık Afi sohbeti hakkıdır ve boyutunu
 * lig kademesi belirler; görev ödülü o haftanın kesesine eklenen sohbet
 * hakkı adedidir. Panelde de "sohbet hakkı" diye yazılır, hiçbir yerde
 * "puan" ya da "jeton" denmez.
 */

import type { QuestTier, QuestTierKey } from '../../services/admin'

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
 * Tek eşikten bir merdiven ÖNERİR.
 *
 * Artık yalnız YENİ görev taslağı için: form açıldığında boş üç satır yerine
 * makul bir merdiven gösterilsin diye. Kaydedilen görevlerin merdiveni uçtan
 * gelir ve bu fonksiyon ona dokunmaz.
 *
 * Çarpanlar sunucudaki `DeriveLadder` ile AYNI (afiet-backend,
 * internal/store/admin_quest_tiers.go). İkisi ayrışırsa panelin önerdiği
 * merdiven ile sunucunun tek eşikten türettiği merdiven farklı olur ve aynı
 * görev nereden yaratıldığına göre başka çıkar.
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

/* ── Biçimleyiciler ──────────────────────────────────────────────────────── */

export const percent = (ratio: number) => `%${Math.round(ratio * 100)}`
export const countLabel = (value: number) => value.toLocaleString('tr-TR')
export const pouchLabel = (count: number) => `${count} sohbet hakkı`
export const daysLabel = (days: number | null) =>
  days === null ? 'tamamlanmadı' : `${days} gün`
