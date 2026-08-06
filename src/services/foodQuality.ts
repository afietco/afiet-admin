/**
 * Katalog denetiminin satır kapsamlı kontrollerinin panel aynası.
 *
 * Kaynak: afiet-backend/tools/besin-denetimi (SKILL.md + references/kontroller.md
 * + references/esikler.md). Oradaki 81 kuralın hepsi burada DEĞİL: bu dosya
 * yalnız "tek besne bakan" kuralları taşır, çünkü panel bir besni kaydetmeden
 * önce elindeki tek şey o besindir. Kohort ve katalog kapsamlı kurallar (OUT-*,
 * TAX-10, REACH-*, DRIFT-*) 2007 satırın tamamını ister ve denetim aracının işi
 * olarak kalır.
 *
 * Eşikler denetim aracındakiyle BİREBİR aynı tutuldu; bir eşik orada
 * değişirse burada da değişmeli, yoksa panel "temiz" derken denetim "kirli" der.
 *
 * Bilinmeyen alan ile boş alan aynı şey değildir: `undefined` "bu taslakta bu
 * alan hiç yok" demektir (kullanıcı besinlerinde lif, diyet etiketi, gramaj yok)
 * ve o kuralı YANLIŞ tetiklemek yerine "değerlendirilemedi" listesine düşürür.
 * `null` ise bilinçli boşluktur (katı besinde sıvı katkısı).
 */

import type { Macros } from './foods'

export type Severity = 'kritik' | 'uyari' | 'bilgi'

export type QualityFinding = {
  /** Denetim aracındaki kural kodu; rapor ile panel aynı dili konuşsun. */
  code: string
  severity: Severity
  title: string
  detail: string
}

/** Veri yokluğu yüzünden koşturulamayan kural; sessizce atlanmaz, gösterilir. */
export type PendingCheck = { code: string; title: string; reason: string }

export type QualityReport = {
  findings: QualityFinding[]
  pending: PendingCheck[]
  critical: number
  warning: number
  info: number
}

/**
 * Kataloğda ad/takma ad çakışması aranan komşu kayıt. Panel bunu canlı
 * arama ucundan (/v1/admin/foods?query=) doldurur, elde tutulan bir kopyadan
 * değil; katalog 2007 satır ve tarayıcıya indirilmez.
 */
export type CatalogNeighbor = { id: string; name: string; aliases: string[]; kcal: number }

export type QualityDraft = {
  name: string
  description?: string
  emoji?: string
  category?: string
  measure?: string
  groups?: string[]
  dietTags?: string[]
  suitableMeals?: string[]
  aliases?: string[]
  macros?: Macros | null
  /** 1 ölçünün gram karşılığı. */
  gramPerMeasure?: number | null
  defaultQuantity?: number | null
  fiberG?: number | null
  /** null: katı besin, bilinçli boş. undefined: alan bu taslakta yok. */
  liquidMl?: number | null
}

export type QualityContext = {
  /** Ad çakışması aranacak katalog kayıtları. Kendisi hariç tutulmalı. */
  neighbors?: CatalogNeighbor[]
  /** Komşu araması yapıldı mı; yapılmadıysa IDN/DUP kuralları beklemede kalır. */
  neighborsLoaded?: boolean
}

/** ENR-01 kategori toleransları; esikler.md'deki ölçülen p95 + 2 puan. */
const ENERGY_TOLERANCE: Record<string, number> = {
  ana_yemek: 0.08,
  atistirmalik: 0.12,
  corba: 0.1,
  icecek: 0.3,
  kahvaltilik: 0.1,
  meyve_kuruyemis: 0.2,
  salata_yogurt: 0.12,
  tatli: 0.08,
  temel_gida: 0.1,
  yan: 0.1,
}
const ENERGY_TOLERANCE_DEFAULT = 0.12
const ENERGY_FLOOR_KCAL = 2
const ENERGY_FLOOR_BY_CATEGORY: Record<string, number> = { icecek: 2.5 }

/** DIET-06: glutensiz etiketini şüpheli yapan buğday/arpa/çavdar izleri. */
const WHEAT_WORDS = [
  'buğday', 'bulgur', 'makarna', 'erişte', 'ekmek', 'yufka', 'irmik', 'şehriye',
  'arpa', 'çavdar', 'hamur', 'börek', 'pide', 'lahmacun', 'mantı', 'kadayıf',
  'baklava', 'kek', 'kurabiye', 'bisküvi', 'kraker', 'simit', 'poğaça', 'tost',
  'pizza', 'burger', 'sandviç', 'noodle', 'lazanya', 'spagetti', 'kuskus',
  'tarhana', 'galeta', 'un',
]

const MAX_KCAL_PER_100G = 900
const MIN_KCAL_PER_100G = 5
const MASS_SLACK = 0.05
const MAX_FIBER_RATIO = 0.3
const FIBER_GROUPS = ['sebze', 'meyve', 'bakliyat']
const DRINKABLE_MEASURES = ['bardak', 'fincan']
const LIQUID_MEASURES = ['bardak', 'fincan', 'kase']
const COUNTABLE_MEASURES = ['adet', 'dilim', 'avuc', 'bardak']
const LIQUID_CATEGORIES = ['icecek', 'corba']
const SINGLE_SERVING_MEASURES = ['porsiyon', 'kase']
const MAX_SINGLE_TAP_KCAL = 800
const SIMILARITY_THRESHOLD = 0.65

export const lower = (value: string) => value.toLocaleLowerCase('tr-TR')

/** Ad karşılaştırma anahtarı: küçük harf, tek boşluk, baş/son boşluksuz. */
export const normalizeName = (value: string) => lower(value).replace(/\s+/g, ' ').trim()

/**
 * pg_trgm'in üçlü benzerliği (denetim aracındaki crosschecks.trigrams ile aynı):
 * kelimelere ayır, her kelimeyi iki öndeki ve bir sondaki boşlukla doldur,
 * 3-gram al, Jaccard hesapla. Eşik 0,65; altındaki çiftler harf benzerliği,
 * üstündekiler gerçek ayırt edilemezlik.
 */
export function trigrams(value: string): Set<string> {
  const out = new Set<string>()
  for (const word of normalizeName(value).split(' ')) {
    if (!word) continue
    const padded = `  ${word} `
    for (let i = 0; i + 3 <= padded.length; i += 1) out.add(padded.slice(i, i + 3))
  }
  return out
}

export function similarity(a: string, b: string) {
  const left = trigrams(a)
  const right = trigrams(b)
  if (!left.size || !right.size) return 0
  let shared = 0
  left.forEach((gram) => { if (right.has(gram)) shared += 1 })
  return shared / (left.size + right.size - shared)
}

function hasWheatWord(name: string) {
  const text = lower(name)
  return WHEAT_WORDS.some((word) => {
    // Kelime sınırı şart: sınırsız "un" deseni Kavun ve Kavurma'yı yakalıyor.
    if (word === 'un') return /(^|[^\p{L}])un($|[^\p{L}])/u.test(text)
    return text.includes(word)
  })
}

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
const gramText = (value: number) => `${round(value).toLocaleString('tr-TR')} g`
const kcalText = (value: number) => `${round(value).toLocaleString('tr-TR')} kcal`

/**
 * Taslağı kural kural geçer. Sıra rapor sırası değil; çağıran şiddete göre
 * gruplayarak gösterir.
 */
export function runFoodChecks(draft: QualityDraft, context: QualityContext = {}): QualityReport {
  const findings: QualityFinding[] = []
  const pending: PendingCheck[] = []

  const add = (code: string, severity: Severity, title: string, detail: string) =>
    findings.push({ code, severity, title, detail })
  const wait = (code: string, title: string, reason: string) => pending.push({ code, title, reason })

  const macros = draft.macros ?? null
  const groups = draft.groups
  const category = draft.category
  const measure = draft.measure
  const gram = draft.gramPerMeasure
  const fiber = draft.fiberG
  const liquid = draft.liquidMl
  const dietTags = draft.dietTags
  const meals = draft.suitableMeals
  const quantity = draft.defaultQuantity

  const macroMass = macros ? macros.protein + macros.carb + macros.fat : 0
  const derivedKcal = macros ? macros.protein * 4 + macros.carb * 4 + macros.fat * 9 : 0
  /**
   * Dört değer de sıfırsa besin "sıfır kalorili" değil, henüz yazılmamıştır.
   * Bu ayrım olmadan boş form "enerji yoğunluğu çok düşük" diye bağırıyordu.
   */
  const macroFilled = macros ? macros.kcal > 0 || macroMass > 0 : false
  const kcalPer100 = macros && macroFilled && gram ? (macros.kcal / gram) * 100 : null

  // --- ENR: enerji tutarlılığı ---
  if (!macros) {
    wait('ENR-01', 'Atwater enerji tutarlılığı', 'Makro değerleri yok.')
  } else {
    const tolerance = (category ? ENERGY_TOLERANCE[category] : undefined) ?? ENERGY_TOLERANCE_DEFAULT
    const floor = (category ? ENERGY_FLOOR_BY_CATEGORY[category] : undefined) ?? ENERGY_FLOOR_KCAL
    const delta = Math.abs(derivedKcal - macros.kcal)
    const base = macros.kcal || derivedKcal
    if (macros.kcal > 0 && macroMass === 0) {
      add('ENR-02', 'uyari', 'Makro dökümü boş ama enerji var',
        `${kcalText(macros.kcal)} yazılı, protein/karbonhidrat/yağ üçü de sıfır. Enerji nereden geliyor belli değil.`)
    } else if (macros.kcal === 0 && macroMass > 0) {
      add('ENR-03', 'kritik', 'Makro var ama enerji sıfır',
        `Makrolardan ${kcalText(derivedKcal)} çıkıyor, kayıtlı enerji 0. Günlük toplam bu besni hiç saymaz.`)
    } else if (base > 0 && delta >= floor && delta / base > tolerance) {
      const percent = Math.round((delta / base) * 100)
      add('ENR-01', 'uyari', 'Atwater enerji tutarsızlığı',
        `Makrolardan ${kcalText(derivedKcal)} çıkıyor, kayıtlı değer ${kcalText(macros.kcal)}. Sapma %${percent}` +
        `${category ? `, bu kategoride kabul sınırı %${Math.round(tolerance * 100)}` : ''}.`)
    }
  }

  // --- MAS: kütle korunumu ---
  if (macros && gram !== undefined && gram !== null && gram > 0) {
    if (macroMass > gram * (1 + MASS_SLACK)) {
      add('MAS-01', 'kritik', 'Makro kütlesi porsiyon kütlesini aşıyor',
        `Protein + karbonhidrat + yağ ${gramText(macroMass)}, oysa 1 ölçü ${gramText(gram)}.`)
    }
  } else if (macros) {
    wait('MAS-01', 'Makro kütlesi porsiyon kütlesini aşıyor', 'Ölçü gramajı yok.')
  }

  if (fiber === undefined) {
    wait('MAS-02', 'Lif karbonhidrattan fazla', 'Lif alanı bu kayıtta yok.')
  } else if (fiber !== null && macros) {
    if (fiber > macros.carb) {
      add('MAS-02', 'kritik', 'Lif karbonhidrattan fazla',
        `Lif ${gramText(fiber)}, karbonhidrat ${gramText(macros.carb)}. Lif karbonhidratın alt kümesidir.`)
    }
    if (gram && fiber / gram > MAX_FIBER_RATIO) {
      add('MAS-03', 'bilgi', 'Lif oranı çok yüksek',
        `Lif porsiyonun %${Math.round((fiber / gram) * 100)}'i. Saf kepek dışında bu oran beklenmez.`)
    }
    if (fiber === 0 && groups?.some((group) => FIBER_GROUPS.includes(group))) {
      add('MAS-04', 'uyari', 'Sebze, meyve ya da bakliyatta lif sıfır',
        'Bu gruplarda lif sıfır olamaz; boş bırakılmış olma ihtimali yüksek.')
    }
  }

  // --- DEN: enerji yoğunluğu ---
  if (kcalPer100 === null) {
    wait('DEN-01', 'Enerji yoğunluğu', 'Ölçü gramajı ya da makro değerleri girilmemiş.')
  } else {
    if (kcalPer100 > MAX_KCAL_PER_100G) {
      add('DEN-01', 'kritik', 'Enerji yoğunluğu fiziksel olarak imkânsız',
        `100 gramda ${kcalText(kcalPer100)}. Saf yağ bile 900 kcal; ölçü gramajı ya da enerji yanlış.`)
    } else if (kcalPer100 < MIN_KCAL_PER_100G && liquid === null) {
      add('DEN-02', 'uyari', 'Katı besinde enerji yoğunluğu çok düşük',
        `100 gramda ${kcalText(kcalPer100)}. Sıvı katkısı boş bırakıldığına göre bu bir katı besin.`)
    }
  }

  // --- POR / GRAM: porsiyon gerçekçiliği ---
  if (measure && gram !== undefined && gram !== null) {
    if (measure === 'fincan' && (gram < 50 || gram > 120)) {
      add('POR-01', 'uyari', 'Fincan gramajı fincan ölçüsüne uymuyor',
        `${gramText(gram)} yazılı. Türk fincanı 70-90 ml'lik bir kap; kupa gramajı taşıyor olabilir.`)
    }
    if (measure === 'kasik' && gram > 30) {
      add('POR-02', 'uyari', 'Kaşık gramajı çok yüksek', `${gramText(gram)} bir yemek kaşığına sığmaz.`)
    }
    if (measure === 'avuc' && gram > 60) {
      add('POR-03', 'bilgi', 'Avuç gramajı çok yüksek', `${gramText(gram)} bir avuçtan fazla görünüyor.`)
    }
    if (measure === 'gram' && gram !== 1) {
      add('GRAM-01', 'kritik', 'Gram ölçüsünde gramaj 1 değil',
        `Gram ölçüsünde makrolar 1 gram içindir, gramaj 1 olmalı; ${gramText(gram)} yazılı.`)
    }
  }
  if (measure === 'gram' && quantity !== undefined && quantity !== null && (quantity < 5 || quantity > 400)) {
    add('GRAM-02', 'uyari', 'Gram ölçüsünde varsayılan miktar gerçekçi değil',
      `Varsayılan ${round(quantity).toLocaleString('tr-TR')} g. Tek dokunuşta eklenen miktar 5 ile 400 g arasında olmalı.`)
  }
  if (category === 'temel_gida' && measure && COUNTABLE_MEASURES.includes(measure)) {
    add('GRAM-03', 'uyari', 'Temel gıda kategorisinde ama ölçüsü sayılabilir',
      'Temel gıdalar gram ölçüsüyle tutulur; sayılabilir ölçü tarif içinde yanlış toplar.')
  }
  if (macroFilled && macros && quantity !== undefined && quantity !== null && macros.kcal * quantity > MAX_SINGLE_TAP_KCAL) {
    add('POR-05', 'uyari', 'Varsayılan miktar tek dokunuşta çok yüksek enerji',
      `Varsayılan miktarla ${kcalText(macros.kcal * quantity)} ekleniyor. Kullanıcı fark etmeden günü doldurur.`)
  }
  if (measure && SINGLE_SERVING_MEASURES.includes(measure) && quantity !== undefined && quantity !== null && quantity > 1) {
    add('POR-06', 'bilgi', 'Porsiyon ya da kâse ölçüsünde varsayılan miktar birden büyük',
      'Bu ölçüler zaten bir servisi anlatır; varsayılanın 1 olması beklenir.')
  }
  if (quantity === undefined) wait('POR-05', 'Varsayılan miktar kontrolü', 'Varsayılan miktar alanı bu kayıtta yok.')

  // --- LIQ: sıvı tutarlılığı ---
  if (liquid === undefined) {
    wait('LIQ-05', 'Sıvı katkısı tutarlılığı', 'Sıvı katkısı alanı bu kayıtta yok.')
  } else {
    if (liquid !== null && category && !LIQUID_CATEGORIES.includes(category)) {
      add('LIQ-01', 'uyari', 'İçecek ya da çorba olmayan besin su takibine sayılıyor',
        'Sıvı katkısı yalnız içecek ve çorbada doldurulur.')
    }
    if (liquid === null && measure && DRINKABLE_MEASURES.includes(measure)) {
      add('LIQ-02', 'kritik', 'Bardak ya da fincanla içilen besin su takibine sayılmıyor',
        'Bu ölçüyle içilen bir besnin sıvı katkısı boş kalırsa kullanıcının su takibi eksik toplar.')
    }
    if (liquid !== null && gram !== undefined && gram !== null && gram > 0 && liquid > gram * (1 + MASS_SLACK)) {
      add('LIQ-03', 'kritik', 'Sıvı hacmi porsiyon kütlesini aşıyor',
        `${round(liquid)} ml sıvı, ${gramText(gram)} porsiyon.`)
    }
    if (liquid !== null && measure && !LIQUID_MEASURES.includes(measure)) {
      add('LIQ-04', 'uyari', 'İçilmeyen bir ölçü su takibine sayılıyor',
        'Bardak, fincan ve kâse dışındaki ölçülerde sıvı katkısı beklenmez.')
    }
    if (liquid === null && category && LIQUID_CATEGORIES.includes(category)) {
      add('LIQ-05', 'kritik', 'İçecek ya da çorbada sıvı katkısı tanımsız',
        'İçecek ve çorbanın su takibine katkısı her zaman yazılır.')
    }
  }

  // --- DIET: diyet etiketi mantığı ---
  if (dietTags === undefined) {
    wait('DIET-01', 'Diyet etiketi çelişkileri', 'Diyet etiketi alanı bu kayıtta yok.')
  } else {
    const vegan = dietTags.includes('vegan')
    const vejetaryen = dietTags.includes('vejetaryen')
    const laktozsuz = dietTags.includes('laktozsuz')
    const glutensiz = dietTags.includes('glutensiz')
    const milk = groups?.includes('sut') ?? false
    const protein = groups?.includes('protein') ?? false
    if (vegan && !vejetaryen) add('DIET-01', 'kritik', 'Vegan ama vejetaryen değil', 'Vegan olan her besin aynı zamanda vejetaryendir.')
    if (vegan && milk) add('DIET-02', 'kritik', 'Vegan ama süt grubunda', 'Süt grubundaki bir besin vegan olamaz.')
    if (vegan && !laktozsuz) add('DIET-03', 'kritik', 'Vegan ama laktozsuz değil', 'Vegan besinde hayvansal süt yoktur, laktozsuz etiketi de olmalı.')
    if (laktozsuz && milk) add('DIET-04', 'kritik', 'Laktozsuz ama süt grubunda', 'İkisi birlikte doğruysa gerekçesi açıklamada yazmalı.')
    if (milk && !vejetaryen && !protein) add('DIET-05', 'uyari', 'Süt grubunda ama vejetaryen etiketi yok', 'Et taşımıyorsa vejetaryen etiketi eksik kalmış olabilir.')
    if (glutensiz && hasWheatWord(draft.name)) {
      add('DIET-06', 'uyari', 'Glutensiz etiketi buğday içeren besinde',
        'Adında buğday, arpa ya da çavdar izi var. Glutensiz etiketi çölyak kullanıcısını yanıltır.')
    }
    if (!dietTags.length) add('DIET-07', 'bilgi', 'Diyet etiketi yok', 'Diyet filtrelerinde bu besin hiç çıkmaz.')
  }

  // --- TAX: taksonomi ---
  if (groups === undefined) {
    wait('TAX-01', 'Besin grubu kontrolü', 'Besin grubu alanı bu kayıtta yok.')
  } else {
    if (!groups.length) add('TAX-01', 'uyari', 'Besin grubu atanmamış', 'Grupsuz besin denge pusulasına hiç katkı vermez.')
    if (category === 'icecek' && !groups.includes('icecek')) add('TAX-03', 'uyari', 'İçecek kategorisinde ama içecek grubu yok', 'Kategori ile grup aynı şeyi söylemeli.')
    if (groups.includes('icecek') && category && category !== 'icecek') add('TAX-04', 'uyari', 'İçecek grubunda ama içecek kategorisinde değil', 'Kategori ile grup aynı şeyi söylemeli.')
    if (category === 'tatli' && !groups.includes('tatli')) add('TAX-05', 'uyari', 'Tatlı kategorisinde ama tatlı grubu yok', 'Kategori ile grup aynı şeyi söylemeli.')
    if (category === 'meyve_kuruyemis' && !groups.includes('meyve') && !groups.includes('kuruyemis')) {
      add('TAX-07', 'uyari', 'Meyve ve kuruyemiş kategorisinde ama grubu yok', 'Meyve ya da kuruyemiş grubundan biri atanmalı.')
    }
  }
  if (meals === undefined) {
    wait('TAX-02', 'Uygun öğün kontrolü', 'Uygun öğün alanı bu kayıtta yok.')
  } else if (!meals.length) {
    add('TAX-02', 'kritik', 'Uygun öğün atanmamış', 'Hiçbir öğün önerisinde çıkmaz; kullanıcı ancak arayarak bulur.')
  }
  if (category === 'corba' && measure && measure !== 'kase') {
    add('TAX-06', 'uyari', 'Çorba kâse ölçüsünde değil', 'Çorbalar kâse ile tutulur; başka ölçü porsiyon algısını bozar.')
  }

  // --- IDN: kimlik ve metin ---
  if (draft.emoji !== undefined && !draft.emoji.trim()) {
    add('IDN-08', 'uyari', 'Emoji atanmamış', 'Uygulamada besin kartı emojisiyle tanınır; boş kalırsa hepsi aynı görünür.')
  }
  if (draft.description !== undefined) {
    const description = draft.description.trim()
    if (/[–—]/.test(description)) {
      add('IDN-11', 'kritik', 'Açıklamada uzun tire var', 'Marka dili uzun tire kullanmaz; nokta ya da virgülle ayır.')
    }
    if (description && (description.length < 40 || !/[.!?…]$/.test(description))) {
      add('IDN-12', 'bilgi', 'Açıklama çok kısa ya da noktalama ile bitmiyor', 'Açıklama tam bir cümle olmalı.')
    }
  }

  // --- Katalog komşuluğu: ad ve takma ad çakışması ---
  if (!context.neighborsLoaded) {
    wait('IDN-03', 'Ad ve takma ad çakışması', 'Katalog araması yapılmadı.')
  } else {
    const neighbors = context.neighbors ?? []
    const key = normalizeName(draft.name)
    const sameName = neighbors.find((item) => normalizeName(item.name) === key)
    if (sameName) {
      add('IDN-03', 'kritik', 'Katalogda aynı adlı besin var',
        `"${sameName.name}" zaten katalogda. Benzersiz ad indeksi ikinci kaydı reddeder.`)
    }
    const aliasOwner = neighbors.find((item) => item.aliases.some((alias) => normalizeName(alias) === key))
    if (aliasOwner && aliasOwner.name !== sameName?.name) {
      add('IDN-04', 'uyari', 'Bu ad başka bir besnin takma adı',
        `"${aliasOwner.name}" bu adı takma ad olarak kullanıyor. Fotoğraftan tanınan ad yanlış makroya bağlanabilir.`)
    }
    if (!sameName) {
      for (const item of neighbors) {
        const score = similarity(draft.name, item.name)
        if (score < SIMILARITY_THRESHOLD) continue
        const kcal = draft.macros?.kcal ?? 0
        const ratio = Math.max(kcal, item.kcal) > 0
          ? Math.abs(kcal - item.kcal) / Math.max(kcal, item.kcal)
          : 0
        if (kcal && item.kcal && ratio > 0.5) {
          add('DUP-03', 'uyari', 'Benzer adlı besnin enerjisi çok farklı',
            `"${item.name}" ile ad benzerliği %${Math.round(score * 100)}, enerji farkı %${Math.round(ratio * 100)}. İkisinden biri yanlış olabilir.`)
        } else {
          add('DUP-02', 'bilgi', 'Katalogda çok benzer adlı besin var',
            `"${item.name}" ile ad benzerliği %${Math.round(score * 100)}. Aynı besnin ikinci kaydı olabilir.`)
        }
      }
    }
  }

  return {
    findings,
    pending,
    critical: findings.filter((f) => f.severity === 'kritik').length,
    warning: findings.filter((f) => f.severity === 'uyari').length,
    info: findings.filter((f) => f.severity === 'bilgi').length,
  }
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  kritik: 'Kritik',
  uyari: 'Uyarı',
  bilgi: 'Bilgi',
}

/** Şiddet sırası: kritik önce. Rapor listesini bununla sırala. */
export const SEVERITY_ORDER: Severity[] = ['kritik', 'uyari', 'bilgi']
