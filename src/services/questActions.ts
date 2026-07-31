/**
 * Görev aksiyonu: görev detayında Afi'nin altında duran tek düğme.
 *
 * Mobil tarafın aynası — afiet-mobile/src/features/progress/questGuide.ts.
 * Rotalar uygulamanın işidir ve veritabanına yazılmaz (bir ekran taşındığında
 * kayıt çürür), o yüzden panel serbest rota değil BİLİNEN HEDEF seçer:
 * `target` bir jeton, karşılığı olan rota mobilde durur. Yeni bir ekran
 * eklendiğinde iki dosya birlikte güncellenir; mobilde karşılığı olmayan bir
 * jeton gönderilirse düğme hiç çizilmez.
 *
 * Etiket ise içeriktir ve buradan yazılır: "Öğün ekle" ile "Hadi başlayalım"
 * arasındaki fark bir uygulama sürümü beklememeli.
 */

export type QuestActionTarget = {
  value: string
  label: string
  /** Panelde hedefin ne yaptığını anlatan tek satır. */
  hint: string
}

export const QUEST_ACTION_TARGETS: QuestActionTarget[] = [
  { value: 'ekle', label: 'Öğün ekle', hint: 'Bugün ekranına gider ve besin ekleme sayfasını açar' },
  { value: 'bugun', label: 'Bugün', hint: 'Bugün sekmesini açar' },
  { value: 'beslenme', label: 'Beslenme', hint: 'Denge halkası ve geçmiş' },
  { value: 'menum', label: 'Menüm', hint: 'Kullanıcının kendi öğrettiği yemekler' },
  { value: 'besinler', label: 'Besin rehberi', hint: 'Katalog araması' },
  { value: 'grubum', label: 'Grubum', hint: 'Grup ekranı; selam ve katılma buradan' },
  { value: 'arkadaslarim', label: 'Arkadaşlarım', hint: 'Arkadaş listesi ve istekler' },
  { value: 'vucudum', label: 'Vücudum', hint: 'Ölçüm girişi ve ritim hedefi' },
  { value: 'gorevlerim', label: 'Görevlerim', hint: 'Görev listesine döner' },
]

const targetMap = new Map(QUEST_ACTION_TARGETS.map((target) => [target.value, target]))
export const questTargetLabel = (value: string) => targetMap.get(value)?.label ?? value
export const questTargetHint = (value: string) => targetMap.get(value)?.hint ?? ''

/**
 * Metrik ailesine göre varsayılan aksiyon.
 *
 * Uygulama bugün aksiyonu buradan türetiyor: aynı metriğin her eşiği aynı
 * hamleyle ilerlediği için ("ilk afiyet günü" de "yüzüncüsü" de bir öğün
 * ister) panelden eklenen yeni bir görev, hiçbir şey yazılmasa da doğru
 * düğmeyi alıyor. Panelde aksiyon boş bırakılırsa bu tablo geçerli olur.
 */
export const DEFAULT_QUEST_ACTIONS: Record<string, { label: string; target: string }> = {
  afiyet_day: { label: 'Öğün ekle', target: 'ekle' },
  afiyet_week: { label: 'Öğün ekle', target: 'ekle' },
  meal_entry: { label: 'Öğün ekle', target: 'ekle' },
  distinct_food: { label: 'Yeni bir besin ekle', target: 'ekle' },
  distinct_group: { label: 'Öğün ekle', target: 'ekle' },
  custom_food: { label: "Menüm'e yemek öğret", target: 'menum' },
  group_join: { label: 'Grubuma git', target: 'grubum' },
  greeting: { label: 'Grubuma git', target: 'grubum' },
  measurement: { label: 'Ölçümümü gir', target: 'vucudum' },
  water_goal: { label: 'Suyumu işaretle', target: 'bugun' },
}

export type EffectiveAction = {
  label: string
  target: string
  /** Panelden yazıldı mı, yoksa metrik ailesinden mi geldi. */
  custom: boolean
}

/** Görevin uygulamada göstereceği düğme; hiç yoksa null. */
export function effectiveAction(quest: { metric: string; actionLabel?: string; actionTarget?: string }): EffectiveAction | null {
  const label = quest.actionLabel?.trim()
  const target = quest.actionTarget?.trim()
  if (label && target) return { label, target, custom: true }
  const fallback = DEFAULT_QUEST_ACTIONS[quest.metric]
  return fallback ? { ...fallback, custom: false } : null
}
